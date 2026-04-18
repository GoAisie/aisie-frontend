import { AUDIO_FRAME_SAMPLES, AUDIO_SAMPLE_RATE } from './thresholds';

export type MicFrame = {
  // Int16 LE PCM mono, 320 samples (20 ms at 16 kHz). Ready to be sent
  // over the WebSocket binary channel as-is.
  pcm: Int16Array;
  // RMS amplitude in Int16 units (see vad-processor.js). Feeds the VAD
  // state machine and the barge-in detector.
  rms: number;
  // Monotonic timestamp for measuring utterance duration.
  timestamp: number;
};

export type MicCaptureOptions = {
  onFrame: (frame: MicFrame) => void;
};

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private readonly opts: MicCaptureOptions;

  constructor(opts: MicCaptureOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.ctx) return;

    // Browsers only expose mediaDevices on secure origins (HTTPS, localhost,
    // 127.0.0.1). Hitting the dev server via a LAN IP silently returns
    // `undefined` instead of a real error, so we turn it into a clear
    // DOMException that the UI knows how to surface in Turkish.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new DOMException(
        'Secure context required',
        'SecurityError',
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException(
        'getUserMedia is not available in this browser',
        'NotSupportedError',
      );
    }

    // iOS Safari only allows AudioContext to start in the "running" state
    // if it is created synchronously inside a user-gesture handler. Caller
    // must invoke start() directly from a click/tap event.
    const ctx = new AudioContext({
      sampleRate: AUDIO_SAMPLE_RATE,
      latencyHint: 'interactive',
    });
    this.ctx = ctx;

    try {
      // Next.js serves /public at the site root, so the absolute path
      // resolves regardless of the route the user is on.
      await ctx.audioWorklet.addModule('/worklets/vad-processor.js');

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // These two are hints — browsers may ignore them, but the
          // AudioContext's own sampleRate (16 kHz above) forces a resample
          // at the MediaStreamSource boundary if the mic itself differs.
          sampleRate: AUDIO_SAMPLE_RATE,
          channelCount: 1,
        },
      });

      this.source = ctx.createMediaStreamSource(this.stream);
      this.worklet = new AudioWorkletNode(ctx, 'vad-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.worklet.port.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; pcm?: Float32Array; rms?: number };
        if (data?.type !== 'frame' || !data.pcm) return;
        this.opts.onFrame({
          pcm: float32ToInt16(data.pcm),
          rms: data.rms ?? 0,
          timestamp: performance.now(),
        });
      };

      this.source.connect(this.worklet);
      // Connecting to destination keeps the worklet alive in the pull-based
      // graph; it outputs silence so there is no feedback loop.
      this.worklet.connect(ctx.destination);
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') {
      await this.ctx.close();
    }
    this.worklet = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
  }

  get isActive(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get frameSamples(): number {
    return AUDIO_FRAME_SAMPLES;
  }
}

function float32ToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    // `noUncheckedIndexedAccess` widens TypedArray reads to T|undefined even
    // though the bounds check above guarantees a value — coerce explicitly.
    const sample = f32[i] as number;
    const s = Math.max(-1, Math.min(1, sample));
    // Asymmetric scaling matches the Int16 range: [-32768, 32767].
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}
