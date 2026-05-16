'use client';

import { create } from 'zustand';
import type { WsServerMessage } from '@aisie/shared';
import {
  BargeInDetector,
  MicCapture,
  PlaybackEngine,
  VadProcessor,
  attachLifecycle,
} from '@/lib/audio';
import { playPauseChime } from '@/lib/audio/chime';
import {
  type ConversationClient,
  createConversationClient,
} from '@/lib/ws/conversation-client';
import {
  clearPausedConversationId,
  getAccessToken,
  getPausedConversationId,
  savePausedConversationId,
} from '@/lib/auth/session-store';
import { env } from '@/lib/env';
import type { MicButtonMode } from '@/components/MicButton';

// ============================================================================
// Types
// ============================================================================

export type HistoryEntry = { user: string; assistant: string };

export type ConversationState = {
  mode: MicButtonMode;
  partial: string;
  final: string;
  assistantText: string;
  error: string | null;
  history: HistoryEntry[];
  rms: number;
};

type Action =
  | { type: 'SET_MODE'; mode: MicButtonMode }
  | { type: 'ERROR'; error: string }
  | { type: 'BACKEND_WARNING'; error: string }
  | { type: 'RESET' }
  | { type: 'RMS'; rms: number }
  | { type: 'USER_SPEECH_START' }
  | { type: 'USER_SPEECH_END' }
  | { type: 'PARTIAL'; text: string }
  | { type: 'FINAL'; text: string }
  | { type: 'AI_TEXT'; text: string }
  | { type: 'TTS_START' }
  | { type: 'TTS_END' }
  | { type: 'TURN_COMPLETE' }
  | { type: 'PLAYBACK_ENDED' }
  | { type: 'PAUSE'; reason?: string }
  | { type: 'RESUME' };

type ConversationActions = {
  startSession: (conversationId?: string) => Promise<void>;
  pauseSession: (reason?: string) => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<void>;
  verifyResumeHint: () => Promise<void>;
};

// _apply is the dispatch-equivalent. Internal — UI callers should use the
// high-level actions (startSession/pauseSession/resumeSession/endSession).
type ConversationInternal = {
  _apply: (action: Action) => void;
};

type ConversationStore = ConversationState & ConversationActions & ConversationInternal;

// ============================================================================
// Initial state and pure reducer
//
// The reducer is preserved 1:1 (semantics + comments) from the previous
// in-component reducer. Treating these state transitions as a single pure
// function keeps the store thin and makes any future state-machine refactor
// (e.g. XState) a mechanical lift rather than a logic rewrite.
// ============================================================================

const initialState: ConversationState = {
  mode: 'idle',
  partial: '',
  final: '',
  assistantText: '',
  error: null,
  history: [],
  rms: 0,
};

// Boot-time initial state — checks sessionStorage for a leftover paused
// conversation_id and starts the store in 'paused' mode so the user can
// resume instead of accidentally starting a fresh session. This handles
// the case where a page reload (F5, dev Fast Refresh, Next.js HMR, browser
// session restore) resets the module-level store state while sessionStorage
// survives. Without this, the user would see the idle "Başlatmak için
// dokunun" mic and a tap would open a new conversation, orphaning the
// previous one until the 1h cron finalizes it. RESET action stays paired
// with the pure `initialState` constant — that path is bilinçli kapatma
// (endSession already cleared sessionStorage), so a fresh idle is correct.
function getInitialState(): ConversationState {
  let pausedId: string | null = null;
  if (typeof window !== 'undefined') {
    pausedId = getPausedConversationId();
  }
  if (!pausedId) return { ...initialState };
  return { ...initialState, mode: 'paused' };
}

function applyAction(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case 'SET_MODE':
      // Entering 'connecting' means the user tapped retry after an error —
      // clear stale error text so the UI isn't contradicting itself.
      return {
        ...state,
        mode: action.mode,
        error: action.mode === 'connecting' ? null : state.error,
      };
    case 'ERROR':
      return { ...state, mode: 'error', error: action.error };
    case 'RESET':
      return { ...initialState };
    case 'RMS':
      return { ...state, rms: action.rms };
    case 'BACKEND_WARNING':
      // Non-fatal error from the server (e.g. empty STT) — the WS is still
      // open and the user can simply try again. Reset to 'listening' if we were
      // in 'processing', otherwise stay in current mode, and show a banner.
      return {
        ...state,
        mode: state.mode === 'processing' ? 'listening' : state.mode,
        error: action.error,
      };
    case 'USER_SPEECH_START':
      // Don't clear `final` here — the previous turn's TURN_COMPLETE may still
      // be in-flight (barge-in race). TURN_COMPLETE is responsible for saving
      // final to history and clearing it.
      return { ...state, mode: 'user-speaking', partial: '', error: null };
    case 'USER_SPEECH_END':
      // Flip to 'processing' immediately so VAD stops receiving frames and
      // cannot open a phantom speech session while TTS echo is in the room.
      // Empty STT → BACKEND_WARNING handler resets to 'listening' correctly.
      return { ...state, mode: 'processing' };
    case 'PARTIAL':
      return { ...state, partial: action.text };
    case 'FINAL':
      // final_transcript is only sent by the backend when transcription is
      // non-empty, so this is the right moment to show "Düşünüyorum…".
      return { ...state, final: action.text, partial: '', mode: 'processing' };
    case 'AI_TEXT':
      return { ...state, assistantText: action.text };
    case 'TTS_START':
      return { ...state, mode: 'assistant-speaking' };
    case 'TTS_END':
      return state;
    case 'TURN_COMPLETE': {
      // Only accumulate history — mode stays as-is (still 'assistant-speaking'
      // while buffered PCM is playing). PLAYBACK_ENDED flips to 'listening'
      // once the AudioContext actually drains, preventing VAD from triggering
      // on TTS speaker bleed before the user can speak.
      const entry =
        state.final || state.assistantText
          ? { user: state.final, assistant: state.assistantText }
          : null;
      return {
        ...state,
        history: entry ? [...state.history, entry] : state.history,
        final: '',
        assistantText: '',
      };
    }
    case 'PLAYBACK_ENDED':
      // Don't override 'user-speaking' — mode reflects an active VAD speech
      // window started after barge-in. Flipping to 'listening' here would
      // falsely tell the post-barge-in replay timer "user is idle", causing
      // a stray replay while the user is mid-utterance.
      if (state.mode === 'user-speaking') return state;
      return { ...state, mode: 'listening' };
    case 'PAUSE': {
      // Reason keys are English (CLAUDE.md: code English, UI Turkish). Mapping
      // happens here at the render boundary — internal callers stay neutral,
      // user-facing text lives in one place. `manual` is special-cased to
      // null banner because the user explicitly tapped pause and does not
      // need a surprising "Duraklatıldı" message.
      const REASON_BANNERS: Record<string, string | null> = {
        manual: null,
        idle_timeout: 'Duraklatıldı: uzun süredir konuşma yok.',
        network_loss: 'Duraklatıldı: bağlantı kesildi.',
        audio_suspended: 'Duraklatıldı: ses bağlantısı kesildi.',
        // `mic_lost` fires when MediaStreamTrack ends mid-session — Android
        // signals this for permission revoke, concurrent-app mic seizure
        // (incoming phone call, another voice app), and Bluetooth unpair.
        // Distinct from `audio_suspended` (AudioContext-level interrupt) so
        // the banner can guide the user toward the right recovery step.
        mic_lost: 'Mikrofon erişimi kesildi. Lütfen kontrol edip tekrar deneyin.',
        overloaded:
          'Yapay zeka servisi şu anda yoğun. Birkaç dakika sonra devam edin.',
        // 'background' = user switched tabs / sent app to background / locked
        // screen. Banner is null because the user intentionally stepped away;
        // the status text "Duraklatıldı — devam etmek için dokunun" already
        // tells them what to do. Surfacing an extra banner would feel like
        // an error message for a normal navigation gesture.
        background: null,
        // F1/F2 (K-6): backend hits a non-recoverable failure during the turn
        // and surfaces a typed `kind:` field. Each maps to a specific
        // user-facing message so the user knows whether to wait, retry, or
        // check input. Without these, the frontend would silently fall back
        // to listening and the user has no signal that anything went wrong.
        backend_timeout:
          'Duraklatıldı: yanıt zamanında alınamadı. Tekrar deneyin.',
        tts_failed:
          'Duraklatıldı: yanıt sesi alınamadı. Tekrar deneyin.',
        persistence_failed:
          'Duraklatıldı: veri kaydedilemedi. Tekrar deneyin.',
        // F4/F5 (K-6 frontend safety net): the mode-level watchdogs fire when
        // the backend pipeline silently hangs without emitting any error. By
        // the time we see this banner, the user has waited 30 s (processing)
        // or 45 s (assistant-speaking) without progress.
        backend_no_response:
          'Duraklatıldı: yanıt servisinden cevap gelmedi. Tekrar deneyin.',
      };
      const banner = action.reason
        ? REASON_BANNERS[action.reason] ?? null
        : null;
      // Clear in-flight turn surface (partial transcript, current AI text)
      // because resuming starts a clean listening window — mid-turn audio is
      // discarded by design. `history` survives so the user sees prior turns
      // when they resume.
      return {
        ...state,
        mode: 'paused',
        partial: '',
        final: '',
        assistantText: '',
        rms: 0,
        error: banner,
      };
    }
    case 'RESUME':
      // Hand-off to the connect() promise. The actual mode flip to 'listening'
      // happens once the new WS is open and the mic is restarted.
      return { ...state, mode: 'connecting', error: null };
  }
}

// ============================================================================
// Module-level imperative resources
//
// These live OUTSIDE the Zustand state because they are mutated imperatively
// at audio-frame frequency (50x/sec) by callbacks. Storing them in observable
// state would re-render the entire UI on every mic frame. Module-level `let`
// gives us a stable per-tab singleton while keeping renders cheap.
// ============================================================================

let mic: MicCapture | null = null;
let playback: PlaybackEngine | null = null;
let vad: VadProcessor | null = null;
let bargeIn: BargeInDetector | null = null;
let client: ConversationClient | null = null;

// modeRef shadows state.mode for frame-callback closures. Frame callbacks fire
// before the matching React-paint cycle, so a closed-over state value would be
// one tick stale. Reading this module variable instead avoids the race.
let modeRef: MicButtonMode = 'idle';

// Wall-clock at send_end_of_utterance; used to compute total PTT once the
// first PCM buffer is scheduled in the AudioContext.
let speechEndTime = 0;

// Replay timer: fires 2s after barge-in OR an empty-STT error if no
// final_transcript arrives. Asks the backend to re-TTS the last AI response
// so the user is never silently stalled. Stale-id pattern: an expired ref is
// kept non-null so the next error path can safely clearTimeout (documented
// browser no-op) and replace it.
let replayTimer: ReturnType<typeof setTimeout> | null = null;

// Idle auto-pause timer: 10s (TEMP; production should be 60s) of `listening`
// without VAD speech-start fires this. Re-armed on every mode change via the
// store subscription installed in startSession.
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// F4 (K-6 backend safety net): `processing` mode hang timer. Mode enters
// `processing` after final_transcript arrives — backend is then expected
// to run STT(complete)+LLM1+RL+LLM2-first-chunk and produce `tts_chunk_start`
// within a bounded window. Real prod budget ~5–8 s; 30 s catches genuine
// hangs (MongoDB stall, provider deadlock, LLM1-without-watchdog issues)
// without firing on legitimately slow turns. Re-armed on every mode change
// via the same subscription pattern as idleTimer.
let processingHangTimer: ReturnType<typeof setTimeout> | null = null;

// F5 (K-6 audio safety net): `assistant-speaking` mode without playback
// progress. tts_chunk_start has arrived (client believes audio is coming)
// but no PCM frames have queued into PlaybackEngine. Distinct from a normal
// long response — onEnded fires when playback drains, mode transitions to
// listening; this timer only matters if PlaybackEngine.framesEnqueued
// stays at 0 for the full 45 s window after tts_chunk_start.
let assistantSpeakingHangTimer: ReturnType<typeof setTimeout> | null = null;

// Detach function returned by attachLifecycle. Held so the active-session
// subscriber can release listeners when mode leaves the active set.
let detachLifecycleFn: (() => void) | null = null;

// Store-subscription unsubscribe handles. Installed in startSession; called
// in teardown so a paused/ended session does not keep firing arm logic.
let unsubscribeIdleArm: (() => void) | null = null;
let unsubscribeLifecycle: (() => void) | null = null;

// Network listener detach function. Installed in startSession (one pair of
// `online`/`offline` window listeners per active session); called in teardown
// so a paused/ended session doesn't keep firing pause callbacks on transient
// connectivity blips that happen between sessions.
let detachNetworkListeners: (() => void) | null = null;

// Pagehide listener detach. Installed in startSession so a tab close (or any
// page unload — bfcache transition, navigation away from origin) sends an
// explicit close beacon to the backend, mirroring the WS `close_session`
// message. Without this, a tab close leaves the conversation open for the 1h
// cleanup cron and blocks the user from seeing report email + dashboard
// visibility until then.
let detachPageHide: (() => void) | null = null;

// Visibilitychange listener detach. Installed in startSession so the
// conversation auto-pauses when the page goes hidden (tab switch, mobile
// app sent to background, screen lock, incoming phone call notification).
// Distinct from pagehide: the page is still alive, just hidden — the user
// can return. Browsers throttle JS and mobile OSes suspend the
// AudioContext when hidden, so continuing audio capture/playback silently
// fails; pausing explicitly gives the user a clear "tap to resume" UI on
// return instead of a stale-feeling listening UI that produced no
// transcript while they were away.
let detachVisibility: (() => void) | null = null;

// ============================================================================
// Friendly error mapping (used by startSession's catch arm)
//
// Maps DOMException variants from getUserMedia + the connect timeout into
// user-readable Turkish banners. Centralised here so the store is the single
// source of error copy.
// ============================================================================

function friendlyError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Mikrofon izni reddedildi. Tarayıcı ayarlarından izin verin.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Mikrofon bulunamadı.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Mikrofon başka bir uygulama tarafından kullanılıyor.';
      case 'OverconstrainedError':
        return 'Mikrofon bu cihazda 16 kHz çalamıyor.';
      case 'SecurityError':
        return 'Mikrofon yalnızca güvenli bağlantıda (HTTPS) açılabilir.';
      case 'NotSupportedError':
        // Thrown by MicCapture when AudioContext.state === 'interrupted' at
        // start — Chrome 136+ signals exclusive audio access by another app
        // (Android: active phone call). resume() rejects per spec, so the
        // only recovery is "wait for the call to end, then tap again".
        return 'Ses sistemi şu anda kullanılamıyor. Aktif bir telefon araması varsa, bittikten sonra tekrar deneyin.';
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return 'Bağlantı başlatılamadı.';
}

// ============================================================================
// Pure server-message handler — preserved 1:1 from the previous component.
// `apply` replaces React's `dispatch`; semantics identical.
// ============================================================================

function handleServerMessage(
  msg: WsServerMessage,
  apply: (action: Action) => void,
  playbackEngine: PlaybackEngine,
  bargeInDetector: BargeInDetector,
): void {
  switch (msg.type) {
    case 'ready':
      break;
    case 'partial_transcript':
      apply({ type: 'PARTIAL', text: msg.text });
      break;
    case 'final_transcript':
      apply({ type: 'FINAL', text: msg.text });
      break;
    case 'ai_text':
      apply({ type: 'AI_TEXT', text: msg.text });
      break;
    case 'tts_chunk_start':
      apply({ type: 'TTS_START' });
      bargeInDetector.enable();
      break;
    case 'tts_end':
      // endStream() marks the buffer boundary; onEnded fires when the last
      // PCM frame actually drains, at which point bargeIn is disabled and
      // mode flips to 'listening'. Do NOT disable bargeIn here — the user
      // must be able to barge in while buffered audio is still playing.
      playbackEngine.endStream();
      apply({ type: 'TTS_END' });
      break;
    case 'turn_complete':
      apply({ type: 'TURN_COMPLETE' });
      // If this turn had no TTS (e.g. function-call-only turn), onEnded
      // never fires, so we flip to 'listening' immediately here instead.
      if (!playbackEngine.isPlaying) {
        bargeInDetector.disable();
        apply({ type: 'PLAYBACK_ENDED' });
      }
      break;
    case 'error':
      // Backend WS errors are soft — the session stays open and the user can
      // retry. Fatal terminal errors arrive via the onError callback (network
      // close, auth failure) and dispatch ERROR from there.
      apply({ type: 'BACKEND_WARNING', error: msg.message });
      break;
    case 'template_activated':
    case 'template_switched':
    case 'customer_created':
    case 'followup_scheduled':
    case 'calendar_reminder_created':
      // Emitted by the real backend as side effects of LLM tool calls and
      // calendar_auto. The streaming UI doesn't render toasts for them yet —
      // listed exhaustively so the Zod discriminated union in
      // wsServerMessageSchema stays exhaustive and TypeScript nags us if a
      // new event type is added server-side without a case here.
      break;
  }
}

// ============================================================================
// Resource teardown — releases mic, playback, WS, timers, and subscribers.
// Idempotent. Called from pauseSession, endSession, and the WS error arm.
// ============================================================================

async function teardown(): Promise<void> {
  speechEndTime = 0;

  if (replayTimer !== null) {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // F4/F5 (K-6): mode-level hang watchdogs share the idle-timer subscription
  // — teardown must clear them so a paused/ended session does not keep
  // firing pauseSession on stale state. The subscription itself is detached
  // via unsubscribeIdleArm below (single sub fires arm/disarm for all three
  // timers).
  if (processingHangTimer !== null) {
    clearTimeout(processingHangTimer);
    processingHangTimer = null;
  }
  if (assistantSpeakingHangTimer !== null) {
    clearTimeout(assistantSpeakingHangTimer);
    assistantSpeakingHangTimer = null;
  }
  if (unsubscribeIdleArm !== null) {
    unsubscribeIdleArm();
    unsubscribeIdleArm = null;
  }
  if (unsubscribeLifecycle !== null) {
    unsubscribeLifecycle();
    unsubscribeLifecycle = null;
  }
  if (detachLifecycleFn !== null) {
    detachLifecycleFn();
    detachLifecycleFn = null;
  }
  if (detachNetworkListeners !== null) {
    detachNetworkListeners();
    detachNetworkListeners = null;
  }
  if (detachPageHide !== null) {
    detachPageHide();
    detachPageHide = null;
  }
  if (detachVisibility !== null) {
    detachVisibility();
    detachVisibility = null;
  }

  const m = mic;
  const p = playback;
  const c = client;
  mic = null;
  playback = null;
  vad = null;
  bargeIn = null;
  client = null;

  try {
    await m?.stop();
  } catch {
    /* ignore */
  }
  try {
    await p?.dispose();
  } catch {
    /* ignore */
  }
  try {
    await c?.disconnect();
  } catch {
    /* ignore */
  }
}

// ============================================================================
// Zustand store
// ============================================================================

export const useConversationStore = create<ConversationStore>((set, get) => ({
  ...getInitialState(),

  _apply: (action) => {
    const next = applyAction(get(), action);
    set(next);
    modeRef = next.mode;
  },

  startSession: async (conversationId) => {
    if (client) return;
    const apply = get()._apply;
    apply({ type: 'SET_MODE', mode: 'connecting' });

    // Promise that resolves on backend `ready` arrival. Resume + Soniox prewarm
    // can take 1–2 s; mic must NOT start before this so the user cannot speak
    // into a cold STT pipeline. The onReady handler installed on the client
    // (below) resolves this promise.
    let readyResolve: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });

    const newPlayback = new PlaybackEngine({
      sampleRate: 24000,
      onStarted: () => {
        // First PCM buffer scheduled in AudioContext — measure full PTT.
        // Formula: 760ms (VAD silence window) + (now − send_end_of_utterance).
        const t0 = speechEndTime;
        if (t0 > 0) {
          const backendMs = Date.now() - t0;
          console.log(
            '[PTT] measured totalPtMs=' + (760 + backendMs) + ' backendMs=' + backendMs,
          );
          speechEndTime = 0;
        }
      },
      onEnded: () => {
        bargeIn?.disable();
        // Flip to 'listening' only after the last PCM buffer drains so the
        // mic doesn't open while TTS audio is still bleeding into the room.
        apply({ type: 'PLAYBACK_ENDED' });
      },
    });
    playback = newPlayback;

    const newBargeIn = new BargeInDetector(() => {
      // Detector fires once per TTS turn; kill the in-flight stream and
      // tell the server. Mode flips back to 'listening' when turn_complete
      // arrives in response.
      newPlayback.stop();
      console.log('[CLIENT] send_barge_in');
      // No ring-buffer flush: the frontend now streams PCM continuously
      // during assistant-speaking (full-duplex), so backend's
      // _audio_buffer[-_BARGE_IN_PRE_BUFFER_BYTES:] slice already contains
      // the speech onset that triggered detection. sendBargeIn also sets
      // the client-side drop-in-flight-TTS flag so frames already on the
      // wire don't leak past PlaybackEngine.stop() (Pipecat #3077 pattern).
      client?.sendBargeIn();

      // Start the 2-second replay timer. If the user interrupted by accident
      // (cough, noise) and no speech is recognized within 2s, the AI replays
      // its last message so the conversation doesn't silently stall.
      // We reset any prior timer first in case barge-in fires twice somehow.
      if (replayTimer !== null) {
        clearTimeout(replayTimer);
      }
      replayTimer = setTimeout(() => {
        // Guard: only send if we're quietly waiting — not mid-turn or mid-speech.
        if (modeRef === 'listening') {
          replayTimer = null;
          console.log('[REPLAY] sending replay_last — no transcript for 2s after barge-in');
          client?.sendReplayLast();
        }
        // When guard blocks (mode != 'listening'): ref intentionally keeps the
        // stale expired timeout ID (non-null). The error handler checks
        // !== null to restart the timer when the next empty-STT arrives.
        // clearTimeout on an expired ID is a documented safe no-op in all
        // browsers.
      }, 2000);
    });
    bargeIn = newBargeIn;

    const newVad = new VadProcessor((ev) => {
      if (ev.type === 'speech-start') {
        // Cancel any pending replay timer — VAD detected user voice, so the
        // post-barge-in/error replay path (which assumes user went silent)
        // no longer applies. clearTimeout on null/expired is a documented
        // browser no-op, so the unconditional clear is safe.
        if (replayTimer !== null) {
          clearTimeout(replayTimer);
          replayTimer = null;
        }
        apply({ type: 'USER_SPEECH_START' });
        client?.sendSpeechStart();
      } else {
        // Capture wall-clock time at the moment we send end_of_utterance.
        // PTT = 760ms (VAD silence window already elapsed) + (queue_started − this).
        speechEndTime = Date.now();
        apply({ type: 'USER_SPEECH_END' });
        console.log('[CLIENT] send_end_of_utterance', { durationMs: ev.durationMs });
        client?.sendEndOfUtterance();
      }
    });
    vad = newVad;

    const newClient = createConversationClient({
      onMessage: (msg) => {
        // Persist conversation_id at the earliest possible moment.
        //   - 'ready': backend hands us the id right after handshake, before
        //     any turn. Handles mid-turn tab-switch / mid-turn pause — user
        //     leaves before turn_complete fires but conversation_id is
        //     already saved, so resume on return reattaches to the same
        //     conversation instead of opening a fresh one.
        //   - 'turn_complete': belt-and-suspenders for older backend builds
        //     where ready did not carry the id, and to overwrite if the id
        //     ever changes mid-session (it does not today, but cheap to
        //     keep).
        // savePausedConversationId is idempotent — overwriting with the
        // same id is free.
        if (msg.type === 'ready' && msg.conversation_id) {
          savePausedConversationId(msg.conversation_id);
        }
        if (msg.type === 'turn_complete' && msg.conversation_id) {
          savePausedConversationId(msg.conversation_id);
        }
        // Cancel replay timer the moment a confirmed transcript arrives —
        // the user spoke and was understood, so no replay is needed.
        if (msg.type === 'final_transcript' && replayTimer !== null) {
          clearTimeout(replayTimer);
          replayTimer = null;
        }
        // On any backend error (including empty-STT live_empty_fallback):
        // schedule a replay so the conversation never silently stalls. The
        // earlier version gated this on `replayTimer !== null`, which only
        // refreshed an existing barge-in timer — once a barge-in produced a
        // real (or garbage-text, e.g. cough → "öhö") transcript and the
        // timer was cleared, subsequent empty-STT errors would not fire any
        // replay and the user heard silence with only the inline error
        // banner. Always (re)setting the timer here means every "ses
        // anlaşılamadı" path gets a 2 s grace window before the assistant
        // replays its last line — recoverable UX in the silent-failure
        // case, mildly redundant in the noisy case (acceptable).
        if (msg.type === 'error') {
          // Provider overload / auth-class failure: backend tags
          // `kind:"rate_limit"` when its retry budget is exhausted on a
          // recoverable upstream issue (Anthropic 429, OpenAI quota,
          // Soniox 429, etc.). Auto-pause is the right UX — replay_last
          // would just re-trigger the same upstream failure, and a silent
          // error banner would leave the user wondering whether they should
          // keep speaking. pauseSession plays the chime, tears down
          // mic+ws+playback, and dispatches PAUSE with a special
          // 'overloaded' reason that the reducer translates to a Turkish
          // user-friendly banner.
          if (msg.kind === 'rate_limit') {
            console.log('[PAUSE] rate_limit_received', { message: msg.message });
            void get().pauseSession('overloaded');
            return;
          }
          // F2 (K-6): backend tagged the failure as a non-recoverable, the
          // pipeline cannot continue. Map each kind to a distinct pause
          // reason so the reducer surfaces the right banner. All branches
          // here are "stop and let the user retry" — silent fall-through to
          // listening would leave the user staring at a non-responsive UI.
          if (msg.kind === 'tts_dead') {
            console.log('[PAUSE] tts_dead', { message: msg.message });
            void get().pauseSession('tts_failed');
            return;
          }
          if (msg.kind === 'timeout') {
            console.log('[PAUSE] backend_timeout', { message: msg.message });
            void get().pauseSession('backend_timeout');
            return;
          }
          if (msg.kind === 'persistence') {
            console.log('[PAUSE] persistence', { message: msg.message });
            void get().pauseSession('persistence_failed');
            return;
          }
          if (replayTimer !== null) {
            clearTimeout(replayTimer);
          }
          replayTimer = setTimeout(() => {
            if (modeRef === 'listening') {
              replayTimer = null;
              console.log(
                '[REPLAY] sending replay_last — no transcript after 2s post empty-STT',
              );
              client?.sendReplayLast();
            }
            // Stale-ID pattern: guard blocked (mode != 'listening') → ref
            // stays non-null storing an expired timeout id. The next error
            // arrival re-enters the clearTimeout branch above (no-op on the
            // stale id, documented browser behavior) and replaces it.
          }, 2000);
        }
        handleServerMessage(msg, apply, newPlayback, newBargeIn);
      },
      onAudio: (pcm) => newPlayback.enqueue(pcm),
      onState: () => {
        /* connection state surfaces via mode transitions */
      },
      onError: (e) => {
        apply({ type: 'ERROR', error: e.message });
        // Release resources but keep the error visible — endSession would
        // RESET the state and the user would never see what went wrong.
        void teardown();
      },
      onNetworkLoss: () => {
        // The pong watchdog already burned its 15s grace before firing —
        // this callback IS the "network has been silent for too long"
        // signal. Pause immediately rather than introducing a second timer.
        console.log('[PAUSE] network_loss');
        void get().pauseSession('network_loss');
      },
      onEvicted: (reason) => {
        // Another device opened the same conversation_id and stole the slot.
        // We end (not pause): the other device now owns the resume key.
        // Show a banner via ERROR so the user understands why the session
        // closed.
        console.log('[WS] evicted', { reason });
        clearPausedConversationId();
        apply({
          type: 'ERROR',
          error: 'Bu konuşma başka bir cihazda devam ediyor.',
        });
        void teardown();
      },
      onResumeFailed: (reason) => {
        // Backend rejected our conversation_id — clear sessionStorage so we
        // don't keep retrying. The session continues as a fresh conversation
        // (the backend already created a new Conversation in
        // `_ensure_conversation_exists`).
        console.log('[RESUME] failed', { reason });
        clearPausedConversationId();
        if (reason === 'closed') {
          apply({
            type: 'BACKEND_WARNING',
            error: 'Önceki konuşma kapandı. Yeni bir oturumdayız.',
          });
        } else if (reason === 'legacy_history') {
          apply({
            type: 'BACKEND_WARNING',
            error: 'Eski konuşma kayıtları yüklenemedi, yeni bir oturum başladı.',
          });
        }
        // not_found / forbidden / lookup_error: silent fall-through — fresh
        // session will run its course and the user can keep speaking.
      },
      onReady: () => {
        console.log('[CLIENT] backend_ready');
        readyResolve?.();
      },
    });
    client = newClient;

    const newMic = new MicCapture({
      onFrame: (frame) => {
        apply({ type: 'RMS', rms: frame.rms });
        const m = modeRef;
        // Full-duplex: stream PCM continuously regardless of mode. Backend
        // appends every frame to _audio_buffer; the live STT queue is only
        // open during user-speaking turns, so Soniox is never driven during
        // TTS playback. Continuous capture keeps the browser AEC continuously
        // trained, avoids AudioWorklet first-frame loss on every mode flip,
        // and ensures backend's pre-buffer slice (last 1 s of _audio_buffer)
        // contains real speech onset rather than zeros — the structural fix
        // for the "first syllable lost when speaking near end of TTS" bug.
        if (m === 'listening' || m === 'user-speaking' || m === 'assistant-speaking') {
          client?.sendPcm(frame.pcm);
        }
        // VAD only runs in listening / user-speaking — driving it during
        // assistant-speaking would race with barge-in detection and produce
        // phantom speech_start events on TTS speaker bleed.
        if (m === 'listening' || m === 'user-speaking') {
          vad?.pushFrame(frame.rms, frame.timestamp);
        } else if (m === 'assistant-speaking') {
          bargeIn?.pushFrame(frame.rms);
        }
      },
      onTrackEnded: () => {
        // MediaStream audio track ended mid-session — Android signals this for
        // mic permission revoke, concurrent-app mic seizure (incoming phone
        // call, another voice app starting), and Bluetooth headset unpair.
        // Route to pauseSession('mic_lost') so the user sees a clear banner
        // ("Mikrofon erişimi kesildi…") and can recover with a mic tap once
        // the underlying issue is resolved. Without this signal mic frames
        // silently stop flowing and the failure is invisible until backend
        // STT times out ~30 s later.
        console.log('[MIC] track_ended');
        void useConversationStore.getState().pauseSession('mic_lost');
      },
      onAudioInterrupted: () => {
        // Audio session became unavailable mid-session. Fires for one of two
        // browser signals (see MicCapture.ts):
        //   • AudioContext.state === 'interrupted' — Android phone call took
        //     exclusive audio access (Chrome 136+).
        //   • MediaStreamTrack 'mute' event — Android concurrent-capture
        //     policy silenced the stream while another app holds the mic.
        // Both collapse to the same UX: pause with `audio_suspended` reason,
        // banner says "Ses sistemi duraklatıldı...", user resumes manually
        // once the interruption clears. resume() rejects in interrupted
        // state per spec — no point auto-recovering.
        console.log('[MIC] audio_interrupted');
        void useConversationStore.getState().pauseSession('audio_suspended');
      },
    });
    mic = newMic;

    // Mode-arming subscription: re-arms idle timer + F4/F5 hang watchdogs on
    // every mode change. Guard `state.mode === prev.mode` skips frame-level
    // RMS updates so the timer isn't continuously reset 50x/sec during
    // listening. All three timers are reset together on every mode change
    // — single subscription, single chokepoint.
    //
    // Race-free design: clearTimeout + setTimeout are both synchronous; the
    // mode-check guard inside each callback (`if (modeRef !== '<mode>')
    // return;`) protects against a fired callback acting on a stale mode
    // when the callback was scheduled before the mode change but ran after
    // the clearTimeout (browser timer cancellation is not retroactive for
    // already-queued callbacks).
    unsubscribeIdleArm = useConversationStore.subscribe((state, prev) => {
      if (state.mode === prev.mode) return;

      // Clear all three timers on every mode transition; the next block
      // re-arms whichever ones apply to the new mode.
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (processingHangTimer !== null) {
        clearTimeout(processingHangTimer);
        processingHangTimer = null;
      }
      if (assistantSpeakingHangTimer !== null) {
        clearTimeout(assistantSpeakingHangTimer);
        assistantSpeakingHangTimer = null;
      }

      // Idle timer: only in `listening` mode (60 s of no VAD speech-start).
      if (state.mode === 'listening') {
        idleTimer = setTimeout(() => {
          idleTimer = null;
          if (modeRef !== 'listening') return;
          console.log('[PAUSE] idle_timer_fired');
          void useConversationStore.getState().pauseSession('idle_timeout');
        }, 60_000);
        return;
      }

      // F4 (K-6): backend pipeline hang in `processing` mode. Mode enters
      // here after final_transcript; backend then runs STT(complete)+LLM1
      // +RL+LLM2-first-chunk and must emit `tts_chunk_start` within ~5–8 s
      // on a healthy path. 30 s is the catch-all hang threshold: covers
      // MongoDB stalls in tool dispatch (Motor default socket timeout is
      // also ~30 s), LLM1 retry-budget exhaustion (~31.5 s), and provider
      // deadlocks. Backend bounded paths (LLM2 20 s watchdog, LLM1 retry)
      // should always fire BEFORE us; this timer is the safety net for
      // gaps we don't know about.
      if (state.mode === 'processing') {
        processingHangTimer = setTimeout(() => {
          processingHangTimer = null;
          if (modeRef !== 'processing') return;
          console.log('[PAUSE] processing_hang_30s');
          void useConversationStore.getState().pauseSession('backend_no_response');
        }, 30_000);
        return;
      }

      // F5 (K-6): TTS playback hang in `assistant-speaking` mode. Mode
      // enters here on `tts_chunk_start` arrival; client is in "audio
      // incoming" state. If 45 s pass without `tts_end`, `turn_complete`,
      // or `playback.onEnded` (which would transition mode away from
      // assistant-speaking), something is stuck. 45 s is intentionally
      // generous — a healthy long response (~200 chars) plays in ~12–15 s;
      // 45 s only fires if backend stopped streaming PCM AND failed to
      // emit a terminator (so the F2/F1 backend path didn't fire either).
      // This is the last-resort safety net.
      if (state.mode === 'assistant-speaking') {
        assistantSpeakingHangTimer = setTimeout(() => {
          assistantSpeakingHangTimer = null;
          if (modeRef !== 'assistant-speaking') return;
          console.log('[PAUSE] assistant_speaking_hang_45s');
          void useConversationStore.getState().pauseSession('tts_failed');
        }, 45_000);
        return;
      }
    });

    // Lifecycle subscription: attach OS/browser listeners on entry to an
    // active mode, detach on exit. Mirrors the gating in the previous
    // ConversationView:572-596 useEffect (active = not idle/error/paused).
    unsubscribeLifecycle = useConversationStore.subscribe((state, prev) => {
      if (state.mode === prev.mode) return;
      const wasActive =
        prev.mode !== 'idle' && prev.mode !== 'error' && prev.mode !== 'paused';
      const isActive =
        state.mode !== 'idle' && state.mode !== 'error' && state.mode !== 'paused';
      if (isActive && !wasActive) {
        detachLifecycleFn = attachLifecycle({
          onDeviceChange: () => {
            apply({
              type: 'ERROR',
              error: 'Ses cihazı değişti, lütfen tekrar başlatın.',
            });
            void teardown();
          },
          onUnload: () => {
            void teardown();
          },
          onAudioContextSuspended: () => {
            // iOS dropping the AudioContext mid-conversation usually means an
            // incoming call; transitioning to pause keeps history +
            // conversation_id intact so the user can resume after the call
            // ends.
            console.log('[PAUSE] audio_context_suspended');
            void useConversationStore.getState().pauseSession('audio_suspended');
          },
        });
      } else if (!isActive && wasActive) {
        if (detachLifecycleFn !== null) {
          detachLifecycleFn();
          detachLifecycleFn = null;
        }
      }
    });

    // Network state listeners. Fire on OS-level connectivity changes
    // (cellular ↔ WiFi switch, WiFi drop, system airplane mode). The
    // pong watchdog inside the WS client catches network loss reactively
    // after ~15 s of pong silence; these handlers add a *proactive* path
    // so the user sees a "Duraklatıldı: bağlantı kesildi" banner the
    // moment the OS reports the interface change instead of waiting for
    // the watchdog. The `online` event is logged but does NOT auto-resume
    // — silently re-acquiring the conversation slot while the user isn't
    // expecting it can fight pause/resume eviction logic. The user
    // explicitly taps to resume.
    const onOffline = () => {
      console.log('[NETWORK] offline');
      void get().pauseSession('network_loss');
    };
    const onOnline = () => {
      console.log('[NETWORK] online');
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    detachNetworkListeners = () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };

    // Pagehide handler — fires on tab close, browser quit, navigation away
    // from origin, and bfcache transitions. We send an explicit close beacon
    // so the backend runs post-correction + email + pipeline_finalize the
    // same way the user tapping "Konuşmayı Kapat" would. Without this, tab
    // close leaves the conversation open for the 1h cleanup cron.
    //
    // `fetch` with `keepalive: true` is used instead of `navigator.sendBeacon`
    // because we need to send the JWT in the Authorization header — sendBeacon
    // does not allow custom headers. keepalive gives the same fire-and-forget
    // semantics during page unload (the request outlives the page), and modern
    // browsers do not enforce a meaningful body size limit for this size of
    // POST. The conversation_id is read from sessionStorage; it is set there
    // by every `turn_complete`. If no turn has completed yet (user clicked
    // mic and immediately closed the tab) sessionStorage is empty and we skip
    // the beacon — that empty Conversation is a yetim case that the 1h cron
    // finalizes, just like before.
    const onPageHide = () => {
      const id = getPausedConversationId();
      if (!id) return;
      const token = getAccessToken();
      if (!token) return;
      try {
        fetch(`${env.apiBaseUrl}/api/v1/conversations/${id}/close`, {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {
          // Pagehide path — the browser may tear down the network stack
          // before fetch dispatches. Best-effort; the cron is the backstop.
        });
      } catch {
        /* fetch synchronously throws only on malformed input — ignore */
      }
      // Intentionally NOT clearing sessionStorage here. The decision matrix:
      //   - Tab close / browser quit / new tab: browser auto-clears
      //     sessionStorage per spec (tab-scope), so manual cleanup is a no-op.
      //   - Same-tab restore (F5, bfcache, manual reload): keeping the
      //     paused conversation_id lets the boot-time `getInitialState()`
      //     detect it and start the store in 'paused' mode, so the user
      //     resumes from where they left off instead of seeing a fresh idle
      //     screen. Clearing here would silently kill the yetim-fix
      //     ("orphan conversation") UX guarantee.
      //   - If the close beacon already finalized the conversation on the
      //     backend, the user's subsequent resume attempt receives
      //     `resume_failed: closed`; the onResumeFailed handler then clears
      //     sessionStorage and surfaces a Turkish BACKEND_WARNING banner
      //     ("Önceki konuşma kapandı. Yeni bir oturumdayız.").
    };
    window.addEventListener('pagehide', onPageHide);
    detachPageHide = () => {
      window.removeEventListener('pagehide', onPageHide);
    };

    // Visibilitychange handler — fires when the page goes into the
    // background or returns to the foreground. Distinct from pagehide:
    //   - pagehide = "I am done" (tab close, navigate away, F5)
    //                → backend close beacon, session ends
    //   - visibilitychange hidden = "I stepped away" (tab switch, app
    //                background, screen lock, incoming call notification)
    //                → pause, but session stays alive backend-side, user
    //                  can return and resume
    //
    // No close beacon is sent here; the conversation must remain open so
    // the user can resume on return. The 'visible' transition does NOT
    // auto-resume — same rationale as online/offline: silently
    // re-acquiring mic + WS while the user is not expecting it is brittle
    // (browser autoplay policies, stale conversation slot eviction
    // races). The user explicitly taps the mic to resume.
    //
    // Mobile platform note: iOS and Android both fire visibilitychange
    // reliably when an app moves to background (both inside browser tabs
    // and inside installed PWA standalone). The AudioContext is suspended
    // by the OS regardless of what we do, so capturing this event and
    // tearing down our state explicitly avoids stale state on return.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[PAUSE] visibility_hidden');
        void get().pauseSession('background');
      } else {
        console.log('[VISIBILITY] visible — staying in current mode');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    detachVisibility = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    try {
      // All AudioContext creation happens here — still synchronous inside
      // the user-gesture frame that started this call, so iOS unlocks both.
      await newPlayback.prepare();
      // `conversationId` is the resume hint — when present the backend reloads
      // the existing Conversation from MongoDB. When absent, this connect path
      // creates a fresh session as before.
      await newClient.connect(conversationId);
      // Wait for the backend `ready` signal BEFORE opening the mic. The
      // backend sends ready only after session.initialize() finishes
      // (provider health checks + Soniox prewarm + optional resume reload).
      // 30 s ceiling matches the backend's outer init timeout — if the wait
      // exceeds it, the backend is hung and proceeding to mic.start would
      // let the user speak into a cold STT pipeline. Treat as fatal: throw,
      // fall to ERROR mode, let user retry.
      await Promise.race([
        readyPromise,
        new Promise<void>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('Bağlantı kurulamadı (zaman aşımı), lütfen tekrar deneyin.'),
              ),
            30_000,
          ),
        ),
      ]);
      await newMic.start();
      apply({ type: 'SET_MODE', mode: 'listening' });
    } catch (e) {
      apply({ type: 'ERROR', error: friendlyError(e) });
      void teardown();
    }
  },

  pauseSession: async (reason) => {
    if (!client && !mic && !playback) {
      // Nothing to pause; idempotent guard for double-fires (e.g. idle timer
      // races with a manual tap).
      return;
    }
    console.log('[PAUSE] start', { reason: reason ?? 'manual' });
    // Chime fires on every pause (manual + auto). Single helper keeps the
    // UX consistent and avoids accidentally skipping the cue on a path the
    // caller forgot to wire up — pauseSession is the single chokepoint.
    // Fire-and-forget: chime runs in its own AudioContext, independent of
    // the playback/mic contexts being torn down below, so we don't await.
    void playPauseChime();
    await teardown();
    get()._apply({ type: 'PAUSE', reason });
  },

  resumeSession: async () => {
    // Resume from a paused state by re-opening the WS with the stored
    // conversation_id. If sessionStorage has lost the id (private browsing,
    // storage quota, manual clear) we fall through to a fresh start so the
    // user is never stuck with an unrecoverable paused screen.
    const id = getPausedConversationId();
    console.log('[RESUME] start', { conversation_id: id });
    get()._apply({ type: 'RESUME' });
    await get().startSession(id ?? undefined);
  },

  endSession: async () => {
    // Dual-channel close signal:
    //   - WS message (close_session): works in active modes where `client`
    //     is alive. The backend WS finally block becomes the single writer
    //     for finalize.
    //   - HTTP POST /api/v1/conversations/{id}/close: works in paused mode
    //     where `client` is already null (pauseSession ran teardown). This
    //     is the only path that reaches the backend from a paused-and-close
    //     interaction; without it the conversation would stay open and
    //     wait for the 1h cleanup cron.
    //
    // Backend is registry-aware: if a live WS owns the conversation the
    // HTTP endpoint signals the session and bails (the WS path finalizes);
    // if no WS, the HTTP endpoint runs inline finalize. So sending both in
    // listening mode is safe (idempotent) and required for paused mode.
    const conversationId = getPausedConversationId();
    const token = getAccessToken();
    if (conversationId && token) {
      try {
        await fetch(`${env.apiBaseUrl}/api/v1/conversations/${conversationId}/close`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* network failure — cron cleanup is the safety net */
      }
    }
    try {
      client?.sendCloseSession();
    } catch {
      /* WS may already be tearing down — ignore */
    }
    await teardown();
    // RESET drops the paused conversation_id along with everything else; the
    // user has explicitly chosen to close, so there is nothing to resume.
    clearPausedConversationId();
    get()._apply({ type: 'RESET' });
  },

  verifyResumeHint: async () => {
    // Boot-time verification: when getInitialState() detected a paused
    // conversation_id in sessionStorage and started the store in 'paused'
    // mode, ask the backend whether that conversation is still resumable.
    // If the backend has already finalized it (1h cron ran, pagehide close
    // beacon fired and succeeded, etc.), silently demote the store to
    // 'idle' so the user does not see a paused UI for a conversation they
    // cannot actually resume. Called once at mount by Providers.tsx after
    // auth `initialize()` settles. No-op when sessionStorage is empty or
    // when the user has already moved past 'paused' mode.
    //
    // Uses both `pipeline_complete` and `is_post_correction_run` as
    // "closed" signals for backward compatibility — the backend currently
    // uses the latter for its own resume reject path. A future refactor
    // will collapse these to a single canonical `pipeline_complete` field;
    // until then, checking both keeps frontend and backend in agreement.
    if (get().mode !== 'paused') return;

    const id = getPausedConversationId();
    if (!id) return;

    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${env.apiBaseUrl}/api/v1/conversations/${id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      // The user may have tapped resume (or any other action) between
      // dispatch and response. Bail if mode shifted — we must not RESET a
      // session the user has already started.
      if (get().mode !== 'paused') {
        console.log('[VERIFY] mode changed mid-flight, abandoning verification');
        return;
      }

      if (res.status === 404 || res.status === 403 || res.status === 401) {
        // Conversation gone or not ours — silent cleanup, drop to idle.
        // No banner: user did not initiate anything yet, this is purely
        // a state correction, not an error to surface.
        console.log('[VERIFY] conversation gone/forbidden — silent cleanup', { status: res.status });
        clearPausedConversationId();
        get()._apply({ type: 'RESET' });
        return;
      }

      if (!res.ok) {
        // Backend error (5xx) — leave paused mode, user can still try.
        // The legacy resume_failed flow handles backend-side closed state
        // if it turns out the conversation really is closed, so worst
        // case is the P3 banner UX.
        console.log('[VERIFY] backend error — keeping paused mode', { status: res.status });
        return;
      }

      const body = await res.json();
      const isClosed = body.pipeline_complete === true || body.is_post_correction_run === true;

      if (isClosed) {
        console.log('[VERIFY] conversation already finalized — silent cleanup');
        clearPausedConversationId();
        get()._apply({ type: 'RESET' });
      } else {
        console.log('[VERIFY] conversation still open — staying paused');
      }
    } catch (e) {
      // Network error — leave paused mode, user resume attempt will hit
      // resume_failed if backend rejects, that path is already handled.
      console.log('[VERIFY] network error — keeping paused mode', e);
    }
  },
}));
