// Voice-activity thresholds. These values are **preliminary** — ported from
// the Android native module (`aisie-mobile/.../AudioRecorderModule.java:117-120`,
// `BARGE_IN_THRESHOLD` ~line 573) and scaled roughly 1.5x because the Web Audio
// path produces higher amplitudes than AudioRecord on Android at the same mic
// gain. They are meant to be retuned once we have real latency measurements
// across target hardware (Chrome/Android, Safari/iOS, desktop).
//
// The two-threshold design is intentional hysteresis:
//   VOICE_THRESHOLD  = low bar to START speech (sensitive, catches quiet onsets)
//   SILENCE_THRESHOLD = high bar to END speech  (lenient, tolerates mid-word pauses)
// i.e. RMS between the two while speaking is still treated as "voice".

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports `MacIntel`; distinguish from real macOS via touch support.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

const IS_IOS = detectIOS();

export const VOICE_THRESHOLD = 300;
export const SILENCE_THRESHOLD = 600;

// Safari's AEC is more aggressive than Chrome's — it also attenuates quiet
// incoming speech, so barge-in needs a higher bar on iOS to avoid missing it
// while the TTS itself is bleeding back through.
// Raised from 350/525 → 600/800 after real-device testing showed quiet ambient
// noise (TTS speaker bleed, keyboard, etc.) was triggering false barge-ins.
export const BARGE_IN_THRESHOLD = IS_IOS ? 800 : 600;

// Counts are in worklet frames (20 ms each at 16 kHz):
//   REQUIRED_VOICE_CHECKS  = 8  → 160 ms of voice confirms "speech started"
//   REQUIRED_SILENCE_CHECKS = 75 → 1.5 s of silence confirms "speech ended"
// Android's native path ran checks every 200 ms; on Web we sample 10x faster,
// so we scaled the frame counts to land on comparable wall-clock durations.
//
// 8 frames (160 ms) was chosen to reject keyboard-click false positives:
// physical key impulses typically peak and subside within ~80 ms, well below
// the gate. Real speech onsets are sustained; the first 160 ms of a syllable
// is captured in the backend audio buffer via _speech_start_audio_pos offset,
// so STT quality is not materially affected. Does NOT change Perceived Turn
// Time (PTT) — that clock starts at end_of_utterance, not speech_start.
export const REQUIRED_VOICE_CHECKS = 8;
export const REQUIRED_SILENCE_CHECKS = 75;

// Raised from 5 → 8 frames (160 ms) — barge-in needs more confidence to avoid
// killing TTS on ambient bleed or brief plosives. Real intentional interruption
// is sustained; true false-positives drop off within a few frames.
export const BARGE_IN_REQUIRED_VOICE_CHECKS = 8;

export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_FRAME_SAMPLES = 320;
