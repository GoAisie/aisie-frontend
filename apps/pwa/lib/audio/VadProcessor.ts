import {
  REQUIRED_SILENCE_CHECKS,
  REQUIRED_VOICE_CHECKS,
  SILENCE_THRESHOLD,
  VOICE_THRESHOLD,
} from './thresholds';

export type VadState = 'idle' | 'speaking';

export type VadEvent =
  | { type: 'speech-start'; timestamp: number }
  | { type: 'speech-end'; timestamp: number; durationMs: number };

export type VadListener = (event: VadEvent) => void;

// Two-phase state machine mirroring the Android recorder:
//
//   idle → (RMS >= VOICE_THRESHOLD for REQUIRED_VOICE_CHECKS frames) → speaking
//   speaking → (RMS <  SILENCE_THRESHOLD for REQUIRED_SILENCE_CHECKS frames) → idle
//
// The counters reset whenever the opposite condition is met, so short
// spikes/gaps do not flip state prematurely.
export class VadProcessor {
  private state: VadState = 'idle';
  private voiceCount = 0;
  private silenceCount = 0;
  private speechStartTs: number | null = null;
  private readonly listener: VadListener;

  constructor(listener: VadListener) {
    this.listener = listener;
  }

  pushFrame(rms: number, timestamp: number): void {
    if (this.state === 'idle') {
      if (rms >= VOICE_THRESHOLD) {
        this.voiceCount++;
        if (this.voiceCount >= REQUIRED_VOICE_CHECKS) {
          this.state = 'speaking';
          this.speechStartTs = timestamp;
          this.voiceCount = 0;
          this.silenceCount = 0;
          console.log('[VAD] speech_start', { rms, timestamp });
          this.listener({ type: 'speech-start', timestamp });
        }
      } else {
        this.voiceCount = 0;
      }
      return;
    }

    if (rms < SILENCE_THRESHOLD) {
      this.silenceCount++;
      if (this.silenceCount >= REQUIRED_SILENCE_CHECKS) {
        const startedAt = this.speechStartTs ?? timestamp;
        const durationMs = timestamp - startedAt;
        this.state = 'idle';
        this.speechStartTs = null;
        this.voiceCount = 0;
        this.silenceCount = 0;
        console.log('[VAD] speech_end', { durationMs, timestamp });
        this.listener({ type: 'speech-end', timestamp, durationMs });
      }
    } else {
      this.silenceCount = 0;
    }
  }

  reset(): void {
    this.state = 'idle';
    this.voiceCount = 0;
    this.silenceCount = 0;
    this.speechStartTs = null;
  }

  get currentState(): VadState {
    return this.state;
  }
}
