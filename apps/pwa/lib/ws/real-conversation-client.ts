import { wsServerMessageSchema, type WsServerMessage } from '@aisie/shared';
import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/auth/session-store';
import type {
  ConnectionState,
  ConversationClient,
  ConversationClientOptions,
} from './conversation-client';

// ws_universal backend sends JSON control messages as text and PCM chunks
// as binary. Binary frames MUST be paired with a preceding tts_chunk_start
// JSON so we know the sample rate — the browser can't read sample rate off
// raw PCM bytes. We track the last tts_chunk_start here.
type TtsStream = {
  sampleRate: number;
  format: 'pcm';
};

const WS_PATH = '/api/v1/conversations/ws/universal';

export class RealConversationClient implements ConversationClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private currentTts: TtsStream | null = null;
  private readonly opts: ConversationClientOptions;

  constructor(opts: ConversationClientOptions) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.ws) return;
    this.opts.onState('connecting');

    const token = getAccessToken();
    if (!token) {
      this.opts.onState('error');
      throw new Error('Oturum bilgisi bulunamadı, lütfen tekrar giriş yapın.');
    }

    // WS handshake can't carry an Authorization header reliably (browsers
    // drop custom headers on new WebSocket()), so the gateway expects the
    // token as a query parameter — same contract we've used since Faz 1.
    const base = env.wsBaseUrl.replace(/\/$/, '');
    const url = `${base}${WS_PATH}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
      };
      const onOpen = () => {
        cleanup();
        console.log('[WS] open', { url: url.replace(/token=[^&]+/, 'token=***') });
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Sunucuya bağlanılamadı.'));
      };
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onError, { once: true });
    });

    ws.addEventListener('message', (ev) => this.handleMessage(ev.data));
    ws.addEventListener('close', (ev) => this.handleClose(ev));
    ws.addEventListener('error', () => {
      this.opts.onError(new Error('WebSocket hatası'));
    });

    // ALB idle timeout is 60s by default (we raise to 3600s in prod, but the
    // client ping keeps us safe either way). 30s is well under both.
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    this.opts.onState('connected');
  }

  async disconnect(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      try {
        this.ws.close(1000, 'client-disconnect');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.currentTts = null;
    this.opts.onState('closed');
  }

  sendPcm(frame: Int16Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    // Send the raw bytes of the Int16Array. `.buffer` carries the whole
    // ArrayBuffer but slicing to byteOffset/byteLength guarantees we don't
    // include padding from a shared backing store.
    this.ws.send(
      frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength),
    );
  }

  sendSpeechStart(): void {
    console.log('[CLIENT] send_speech_start');
    this.sendControl({ type: 'speech_start' });
  }

  sendEndOfUtterance(): void {
    this.sendControl({ type: 'end_of_utterance' });
  }

  sendBargeIn(): void {
    this.sendControl({ type: 'barge_in' });
  }

  sendReplayLast(): void {
    console.log('[CLIENT] send_replay_last');
    this.sendControl({ type: 'replay_last' });
  }

  private sendControl(payload: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(raw: unknown): void {
    if (raw instanceof ArrayBuffer) {
      // Binary frames belong to the current TTS stream. If we get one
      // without a preceding tts_chunk_start something is off — log by
      // emitting an error and drop.
      if (!this.currentTts) {
        this.opts.onError(
          new Error('Unexpected binary frame outside a TTS stream'),
        );
        return;
      }
      // Defend against an odd-byte chunk sneaking through (HTTP transfer
      // boundaries don't know about 16-bit sample alignment). The backend
      // already buffers leftovers, but we keep the runtime guard here so
      // a bug on the wire surfaces as silence instead of a crash.
      const aligned = raw.byteLength - (raw.byteLength % 2);
      if (aligned === 0) return;
      const pcm = new Int16Array(raw, 0, aligned / 2);
      this.opts.onAudio(pcm, this.currentTts.sampleRate);
      return;
    }

    if (typeof raw !== 'string') {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    // The "pong" reply to our keepalive isn't part of the shared schema —
    // handle it before validation so Zod doesn't treat it as an error.
    if (typeof parsed === 'object' && parsed !== null && (parsed as { type?: string }).type === 'pong') {
      return;
    }

    const result = wsServerMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.opts.onError(
        new Error(`Invalid server message: ${result.error.message}`),
      );
      return;
    }

    const msg: WsServerMessage = result.data;
    if (msg.type === 'tts_chunk_start') {
      this.currentTts = { sampleRate: msg.sample_rate, format: 'pcm' };
    } else if (msg.type === 'tts_end') {
      this.currentTts = null;
    }

    // Log all control messages except high-frequency partial_transcripts to keep
    // the console readable — partials fire on every STT delta (dozens per turn).
    if (msg.type !== 'partial_transcript') {
      console.log('[WS] message_in', msg.type, msg);
    }

    this.opts.onMessage(msg);
  }

  private handleClose(ev: CloseEvent): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws = null;
    this.currentTts = null;
    console.log('[WS] close', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
    this.opts.onState('closed');
    // Clean shutdown → nothing to surface. Non-1000 closes (e.g. 1008 auth
    // failure, 1013 rate limit) bubble up as errors so the UI can show them.
    if (ev.code !== 1000 && ev.code !== 1001) {
      this.opts.onError(new Error(`WS closed (${ev.code}): ${ev.reason || 'unknown'}`));
    }
  }

  // Kept for diagnostics — allows the ConnectionState enum to stay in
  // sync with WebSocket.readyState during dev debugging.
  get readyState(): ConnectionState {
    if (!this.ws) return 'idle';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'closed';
    }
  }
}
