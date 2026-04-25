export type PlaybackEngineOptions = {
  sampleRate: number;
  onStarted?: () => void;
  onEnded?: () => void;
};

// Plays a stream of Int16 PCM chunks gapless using scheduled
// AudioBufferSourceNodes. Each enqueued chunk becomes its own source node
// scheduled at `nextStartTime`, which advances by the buffer duration so
// the next chunk starts exactly when the previous ends — no clicks, no
// drift from timer jitter.
//
// Runs in its own AudioContext at the TTS provider's native rate (typically
// 24 kHz for OpenAI PCM). The mic uses a separate 16 kHz context; the two
// must stay independent because an AudioContext has exactly one sampleRate.
export class PlaybackEngine {
  private ctx: AudioContext | null = null;
  private readonly sampleRate: number;
  private nextStartTime = 0;
  private active: AudioBufferSourceNode[] = [];
  private endPending = false;
  private readonly opts: PlaybackEngineOptions;

  constructor(opts: PlaybackEngineOptions) {
    this.opts = opts;
    this.sampleRate = opts.sampleRate;
  }

  async prepare(): Promise<void> {
    if (this.ctx) return;
    // Caller must invoke this synchronously inside a user-gesture handler
    // (same rule as MicCapture) — iOS Safari otherwise keeps the context
    // in 'suspended' state and nothing plays.
    this.ctx = new AudioContext({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive',
    });
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  enqueue(pcm: Int16Array): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Resume if the browser auto-suspended the context during a long silence
    // between turns. prepare() only checks on initial creation; subsequent calls
    // skip it because ctx is already set. Chrome suspends after ~30s of no audio;
    // iOS Safari is more aggressive. resume() is safe without a user gesture when
    // the context was originally created inside one (which prepare() ensures).
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i] as number;
      f32[i] = v / 32768;
    }

    const buffer = ctx.createBuffer(1, f32.length, this.sampleRate);
    buffer.copyToChannel(f32, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const wasIdle = this.active.length === 0 && !this.endPending;
    const startAt = Math.max(ctx.currentTime, this.nextStartTime);
    src.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.active.push(src);

    src.onended = () => {
      this.active = this.active.filter((n) => n !== src);
      if (this.active.length === 0 && this.endPending) {
        this.endPending = false;
        this.nextStartTime = 0;
        console.log('[TTS] playback_ended');
        this.opts.onEnded?.();
      }
    };

    if (wasIdle) {
      console.log('[TTS] queue_started', { firstChunkDuration: buffer.duration });
      this.opts.onStarted?.();
    }
  }

  // Called after the final PCM chunk to mark the stream boundary. The
  // `onEnded` callback fires once the last scheduled buffer actually
  // finishes playing (not when endStream is called).
  endStream(): void {
    if (this.active.length === 0) {
      this.nextStartTime = 0;
      console.log('[TTS] playback_ended_empty');
      this.opts.onEnded?.();
      return;
    }
    this.endPending = true;
  }

  // Immediate stop for barge-in: every queued and playing node is
  // disconnected so no residual audio slips through while we open the
  // mic for the user.
  stop(): void {
    const hadActive = this.active.length > 0;
    for (const n of this.active) {
      try {
        n.onended = null;
        n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.active = [];
    this.nextStartTime = 0;
    const wasPending = this.endPending;
    this.endPending = false;
    if (hadActive || wasPending) this.opts.onEnded?.();
  }

  async dispose(): Promise<void> {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      await this.ctx.close();
    }
    this.ctx = null;
  }

  get isPlaying(): boolean {
    return this.active.length > 0;
  }
}
