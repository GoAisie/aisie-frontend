import { BARGE_IN_REQUIRED_VOICE_CHECKS, BARGE_IN_THRESHOLD } from './thresholds';

export type BargeInListener = () => void;

// Only runs while we are actively playing TTS. The listener fires once per
// enable() call; callers re-enable before the next TTS turn.
//
// Counts decay on silent frames instead of resetting hard — a single dip
// below the threshold during real speech should not wipe the whole window.
export class BargeInDetector {
  private voiceCount = 0;
  private active = false;
  private readonly listener: BargeInListener;

  constructor(listener: BargeInListener) {
    this.listener = listener;
  }

  enable(): void {
    this.active = true;
    this.voiceCount = 0;
  }

  disable(): void {
    this.active = false;
    this.voiceCount = 0;
  }

  get isActive(): boolean {
    return this.active;
  }

  pushFrame(rms: number): void {
    if (!this.active) return;
    if (rms >= BARGE_IN_THRESHOLD) {
      this.voiceCount++;
      if (this.voiceCount >= BARGE_IN_REQUIRED_VOICE_CHECKS) {
        this.active = false;
        console.log('[BARGE_IN] detected', { rms });
        this.listener();
      }
    } else if (this.voiceCount > 0) {
      this.voiceCount--;
    }
  }
}
