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
  // Pong watchdog: set on every ping send, cleared on the matching pong receive.
  // If it fires the network is presumed dead and `onNetworkLoss` fires once. The
  // outer ConversationView treats this as a 15s-tolerance pre-pause signal.
  private pongWatchdog: ReturnType<typeof setTimeout> | null = null;
  private currentTts: TtsStream | null = null;
  // After sendBargeIn() fires, TTS PCM frames already in transit on the WS
  // would otherwise reach handleMessage() and play out *after* the
  // PlaybackEngine.stop() that the barge-in handler triggered — leaking a
  // fragment of stale TTS into the user's ear. We drop binary frames while
  // this flag is set, and clear it on the next tts_chunk_start (= a fresh
  // TTS turn whose audio we *do* want to play). Pattern documented in
  // Pipecat issue #3077.
  private bargeInDropActive = false;
  private readonly opts: ConversationClientOptions;

  constructor(opts: ConversationClientOptions) {
    this.opts = opts;
  }

  async connect(conversationId?: string): Promise<void> {
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
    // `conversation_id` is the optional resume hint — when present the backend
    // rehydrates the matching Conversation from MongoDB instead of starting fresh.
    const base = env.wsBaseUrl.replace(/\/$/, '');
    const params = new URLSearchParams({ token });
    if (conversationId) params.set('conversation_id', conversationId);
    const url = `${base}${WS_PATH}?${params.toString()}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    // 20 s ceiling on WS handshake. Browser default is ~60 s which leaves the
    // user staring at the connecting animation for an unreasonable amount of
    // time when the gateway is unreachable. On timeout we force-close the
    // half-open WS so the underlying TCP socket is released — without this the
    // browser would keep the connection in CONNECTING state until its own
    // default timeout. Failure surfaces as the same Error subclass the open/
    // error listeners produce, so the catch in startSession handles it
    // identically to a real connection refusal.
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        if (timeoutId !== null) clearTimeout(timeoutId);
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
      const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
        cleanup();
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error('Bağlantı zaman aşımına uğradı.'));
      }, 20_000);
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
    // Each ping arms a 15s pong watchdog: if the backend doesn't reply within the
    // grace window, the transport is presumed dead and we surface
    // `onNetworkLoss`. The 15s value matches the user-facing pause-resume design
    // (auto-pause after 15s of network silence) — see CLAUDE.md.
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify({ type: 'ping' }));
      if (this.pongWatchdog) {
        // A previous ping never got its pong AND we are about to send another:
        // collapse the misses into a single onNetworkLoss event by re-arming the
        // watchdog rather than firing twice.
        clearTimeout(this.pongWatchdog);
      }
      this.pongWatchdog = setTimeout(() => {
        this.pongWatchdog = null;
        console.warn('[WS] pong_watchdog_fired — no pong within 15s after ping');
        this.opts.onNetworkLoss?.();
      }, 15_000);
    }, 30_000);

    this.opts.onState('connected');
  }

  async disconnect(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongWatchdog) {
      clearTimeout(this.pongWatchdog);
      this.pongWatchdog = null;
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
    this.bargeInDropActive = false;
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
    // Arm the in-flight TTS drop window before the control message goes out
    // so that any binary frames the receive loop processes between now and
    // the next tts_chunk_start are discarded (see bargeInDropActive comment).
    this.bargeInDropActive = true;
    this.sendControl({ type: 'barge_in' });
  }

  sendReplayLast(): void {
    console.log('[CLIENT] send_replay_last');
    this.sendControl({ type: 'replay_last' });
  }

  sendCloseSession(): void {
    console.log('[CLIENT] send_close_session');
    this.sendControl({ type: 'close_session' });
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
      if (this.bargeInDropActive) {
        // In-flight TTS frames after barge_in — drop until the next
        // tts_chunk_start clears the window. PlaybackEngine has already
        // been stopped on the barge-in path; enqueueing here would create
        // a fresh AudioBufferSourceNode and play stale TTS to the user.
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
    // Pong arrival also clears the watchdog: the backend is alive.
    if (typeof parsed === 'object' && parsed !== null && (parsed as { type?: string }).type === 'pong') {
      if (this.pongWatchdog) {
        clearTimeout(this.pongWatchdog);
        this.pongWatchdog = null;
      }
      return;
    }

    // session_evicted and resume_failed are session-control messages introduced by
    // the WS pause/resume feature. Neither is part of the shared turn-protocol
    // schema (they are about the WS slot lifecycle, not the conversation turn),
    // so we route them via dedicated callbacks before schema validation.
    const parsedType = typeof parsed === 'object' && parsed !== null
      ? (parsed as { type?: string }).type
      : undefined;
    if (parsedType === 'session_evicted') {
      const reason = (parsed as { reason?: string }).reason || 'unknown';
      console.log('[WS] session_evicted', { reason });
      this.opts.onEvicted?.(reason);
      return;
    }
    if (parsedType === 'resume_failed') {
      const reason = (parsed as { reason?: string }).reason || 'unknown';
      console.log('[WS] resume_failed', { reason });
      this.opts.onResumeFailed?.(reason);
      return;
    }

    const result = wsServerMessageSchema.safeParse(parsed);
    if (!result.success) {
      // Unknown message type from backend — skip silently so the session stays
      // alive. A fatal onError here would kill TTS playback and freeze the UI
      // whenever the backend adds a new notification type before the schema is
      // updated (calendar_reminder_created, future types).
      console.warn('[WS] Unrecognised server message (schema gap):', (parsed as { type?: unknown }).type, result.error.message);
      return;
    }

    const msg: WsServerMessage = result.data;
    if (msg.type === 'ready') {
      // Backend init + Soniox prewarm completed. Caller waits on this signal
      // before starting the mic so the user cannot speak before STT is hot.
      this.opts.onReady?.();
    }
    if (msg.type === 'tts_chunk_start') {
      this.currentTts = { sampleRate: msg.sample_rate, format: 'pcm' };
      // A new TTS turn — clear the post-barge-in drop window so its frames
      // play normally. Frames from the previous (cancelled) TTS turn that
      // arrived before tts_end were already dropped in the binary branch.
      this.bargeInDropActive = false;
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
    if (this.pongWatchdog) {
      clearTimeout(this.pongWatchdog);
      this.pongWatchdog = null;
    }
    this.ws = null;
    this.currentTts = null;
    this.bargeInDropActive = false;
    console.log('[WS] close', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
    this.opts.onState('closed');
    // Map close codes to UX category per RFC 6455 + WebSocket.org production
    // best practice. The previous rule "anything not 1000/1001 is an error"
    // was too aggressive — 1006 (the most common code for transient network
    // drops and gateway restarts) and 1011-1014 are recoverable conditions,
    // not unrecoverable errors. Routing them to onNetworkLoss shows a
    // "Duraklatıldı: bağlantı kesildi" pause banner that the user can
    // resume from with a mic tap; the old path showed a panic-inducing
    // "Bir sorun oluştu" screen for every gateway hiccup.
    //
    // - 1000 / 1001: clean shutdown — nothing to surface.
    // - 1005 (no status) / 1006 (abnormal) / 1011-1014 (server transient):
    //   recoverable, route to onNetworkLoss.
    // - Everything else (1002 protocol, 1003 unsupported, 1007 invalid,
    //   1008 policy/auth, 1009 too-big, 1010 missing-ext, app codes):
    //   genuine error, surface to UI.
    if (ev.code === 1000 || ev.code === 1001) {
      return;
    }
    if (ev.code === 1005 || ev.code === 1006 || (ev.code >= 1011 && ev.code <= 1014)) {
      this.opts.onNetworkLoss?.();
      return;
    }
    this.opts.onError(new Error(`WS closed (${ev.code}): ${ev.reason || 'unknown'}`));
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
