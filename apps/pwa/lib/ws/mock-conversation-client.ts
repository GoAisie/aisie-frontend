import type { WsServerMessage } from '@aisie/shared';
import type { ConversationClient, ConversationClientOptions } from './conversation-client';

// Canned conversation flow for the Faz 1 mock. Each turn pairs a transcript
// preview (emitted while the user is still speaking) with the full final
// transcript and the assistant's reply. The client cycles through the list
// and starts over once it runs out.
const CANNED_TURNS = [
  {
    userPartial: 'Merhaba yeni bir rapor…',
    userFinal: 'Merhaba, yeni bir rapor oluşturmak istiyorum.',
    aiText: 'Tabii, hangi müşteri için rapor oluşturuyoruz?',
  },
  {
    userPartial: 'Ahmet Yılmaz için satış…',
    userFinal: 'Ahmet Yılmaz için satış görüşmesi raporu.',
    aiText: 'Anladım, Ahmet Yılmaz ile satış görüşmesi. Görüşme nasıl geçti?',
  },
  {
    userPartial: 'Olumlu geçti teklifimizi…',
    userFinal: 'Görüşme olumlu geçti, müşteri teklifimizi değerlendiriyor.',
    aiText: 'Harika. Takip tarihi belirleyelim mi, yoksa müşteri dönüş yapacak mı?',
  },
  {
    userPartial: 'Önümüzdeki hafta Salı günü…',
    userFinal: 'Önümüzdeki Salı takip araması planlayalım.',
    aiText: 'Takip aramasını Salı günü ajandanıza ekledim. Başka eklemek ister misiniz?',
  },
] as const;

const TTS_SAMPLE_RATE = 24000;
const TTS_CHUNK_INTERVAL_MS = 180;
const TTS_CHUNK_SAMPLES = Math.floor(TTS_SAMPLE_RATE * 0.2);

// Synthetic "voice-like" tone: two-harmonic sine with a slow amplitude
// envelope so it sounds vaguely speech-cadenced rather than a flat beep.
// Goes away once the real backend streams real TTS (Faz 3).
function generateTtsTone(durationSec: number): Int16Array {
  const totalSamples = Math.floor(durationSec * TTS_SAMPLE_RATE);
  const buf = new Int16Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / TTS_SAMPLE_RATE;
    const carrier =
      Math.sin(2 * Math.PI * 220 * t) * 0.7 + Math.sin(2 * Math.PI * 440 * t) * 0.3;
    const cadence = 0.5 * (Math.sin(2 * Math.PI * 1.4 * t) + 1);
    const edgeFade = Math.min(1, t * 10, (durationSec - t) * 10);
    const sample = carrier * cadence * edgeFade * 0.3;
    const clamped = Math.max(-1, Math.min(1, sample));
    buf[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return buf;
}

export class MockConversationClient implements ConversationClient {
  private readonly opts: ConversationClientOptions;
  private turnIdx = 0;
  private connected = false;
  private firstPcmReceived = false;
  private partialTimer: ReturnType<typeof setTimeout> | null = null;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private streamTimer: ReturnType<typeof setTimeout> | null = null;
  private currentStreamAbort = false;

  constructor(opts: ConversationClientOptions) {
    this.opts = opts;
  }

  async connect(_conversationId?: string): Promise<void> {
    // The mock has no real backend state to rehydrate, so the resume hint is
    // accepted for interface parity and silently ignored.
    if (this.connected) return;
    this.opts.onState('connecting');
    // Feigned handshake delay — makes the UX match a real WS roundtrip so
    // the "connecting" state is observable instead of snapping instantly.
    await new Promise((r) => setTimeout(r, 180));
    this.connected = true;
    this.opts.onState('connected');
    this.emit({ type: 'ready' });
    // Mock has no backend init / Soniox prewarm — fire onReady immediately so
    // the caller's await for ready unblocks. Mirrors the real client which fires
    // it from the ready message handler.
    this.opts.onReady?.();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.cancelPending();
    this.opts.onState('closed');
  }

  sendPcm(_frame: Int16Array): void {
    if (!this.connected) return;
    if (this.firstPcmReceived) return;
    this.firstPcmReceived = true;
    // Fake STT latency: emit a partial transcript ~400 ms after the first
    // frame so the UI has something to render while the user keeps talking.
    const turn = CANNED_TURNS[this.turnIdx % CANNED_TURNS.length];
    this.partialTimer = setTimeout(() => {
      if (!this.connected) return;
      this.emit({ type: 'partial_transcript', text: turn!.userPartial });
    }, 400);
  }

  sendSpeechStart(): void {
    // no-op in mock: canned turns are triggered by sendEndOfUtterance
  }

  sendEndOfUtterance(): void {
    if (!this.connected) return;
    this.firstPcmReceived = false;
    if (this.partialTimer) {
      clearTimeout(this.partialTimer);
      this.partialTimer = null;
    }
    const turn = CANNED_TURNS[this.turnIdx % CANNED_TURNS.length]!;
    this.emit({ type: 'final_transcript', text: turn.userFinal });
    this.aiTimer = setTimeout(() => this.streamAssistantTurn(turn.aiText), 550);
  }

  sendBargeIn(): void {
    if (!this.connected) return;
    // Abort in-flight TTS stream and finish the turn cleanly so the user
    // can speak again immediately. Matches what the real backend will do
    // (cancel provider generator + send turn_complete).
    this.currentStreamAbort = true;
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
    this.emit({ type: 'tts_end' });
    this.emitTurnComplete();
    this.turnIdx++;
  }

  sendReplayLast(): void {
    if (!this.connected) return;
    // Replay the last canned turn's AI text. turnIdx was already incremented
    // after the turn completed, so (turnIdx - 1) is the most recent one.
    const idx = (this.turnIdx - 1 + CANNED_TURNS.length) % CANNED_TURNS.length;
    const turn = CANNED_TURNS[idx]!;
    this.streamAssistantTurn(turn.aiText);
  }

  sendCloseSession(): void {
    // Mock has no backend post-correction or email — close_session is a no-op.
    // Implemented purely for ConversationClient interface parity.
  }

  private streamAssistantTurn(text: string): void {
    if (!this.connected) return;
    this.emit({ type: 'ai_text', text });
    this.emit({
      type: 'tts_chunk_start',
      format: 'pcm',
      sample_rate: TTS_SAMPLE_RATE,
    });

    const audio = generateTtsTone(1.5);
    this.currentStreamAbort = false;
    let offset = 0;

    const step = () => {
      if (!this.connected || this.currentStreamAbort) return;
      if (offset >= audio.length) {
        this.streamTimer = null;
        this.emit({ type: 'tts_end' });
        setTimeout(() => {
          if (!this.connected || this.currentStreamAbort) return;
          this.emitTurnComplete();
          this.turnIdx++;
        }, 120);
        return;
      }
      const end = Math.min(offset + TTS_CHUNK_SAMPLES, audio.length);
      this.opts.onAudio(audio.slice(offset, end), TTS_SAMPLE_RATE);
      offset = end;
      this.streamTimer = setTimeout(step, TTS_CHUNK_INTERVAL_MS);
    };
    step();
  }

  private emitTurnComplete(): void {
    this.emit({
      type: 'turn_complete',
      report_id: crypto.randomUUID(),
      report_data: null,
      report_status: 'in-progress',
    });
  }

  private emit(msg: WsServerMessage): void {
    this.opts.onMessage(msg);
  }

  private cancelPending(): void {
    this.currentStreamAbort = true;
    for (const t of [this.partialTimer, this.aiTimer, this.streamTimer]) {
      if (t) clearTimeout(t);
    }
    this.partialTimer = null;
    this.aiTimer = null;
    this.streamTimer = null;
    this.firstPcmReceived = false;
  }
}
