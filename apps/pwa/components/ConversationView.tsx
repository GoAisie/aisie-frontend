'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { WsServerMessage } from '@aisie/shared';
import { MicButton, type MicButtonMode } from '@/components/MicButton';
import {
  BargeInDetector,
  MicCapture,
  PlaybackEngine,
  VadProcessor,
  attachLifecycle,
} from '@/lib/audio';
import { playPauseChime } from '@/lib/audio/chime';
import { env } from '@/lib/env';
import {
  type ConversationClient,
  createConversationClient,
} from '@/lib/ws/conversation-client';
import {
  clearPausedConversationId,
  getPausedConversationId,
  savePausedConversationId,
} from '@/lib/auth/session-store';

type HistoryEntry = { user: string; assistant: string };

type State = {
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

const initialState: State = {
  mode: 'idle',
  partial: '',
  final: '',
  assistantText: '',
  error: null,
  history: [],
  rms: 0,
};

function reducer(state: State, action: Action): State {
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
        overloaded:
          'Yapay zeka servisi şu anda yoğun. Birkaç dakika sonra devam edin.',
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

export function ConversationView() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [insecureHost, setInsecureHost] = useState<string | null>(null);

  // Browsers (all of them) refuse getUserMedia on non-secure origins. During
  // dev this bites anyone hitting the LAN IP instead of localhost, so we
  // check up front and point the user at the right URL instead of letting
  // them tap the mic and wonder why nothing happens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext) return;
    setInsecureHost(window.location.host);
  }, []);

  // Side-effect instances belong in refs — they must survive React re-renders
  // and map 1:1 to active browser resources (MediaStream, AudioContext, WS).
  const micRef = useRef<MicCapture | null>(null);
  const playbackRef = useRef<PlaybackEngine | null>(null);
  const vadRef = useRef<VadProcessor | null>(null);
  const bargeInRef = useRef<BargeInDetector | null>(null);
  const clientRef = useRef<ConversationClient | null>(null);

  // Frames arrive from the audio thread before the matching dispatch has
  // flushed, so the frame callback reads mode via this ref instead of the
  // stale React snapshot it closed over.
  const modeRef = useRef<MicButtonMode>('idle');
  modeRef.current = state.mode;

  // Wall-clock timestamp of send_end_of_utterance; used to compute full PTT
  // (760ms VAD window + backend processing + network + AudioContext scheduling).
  const speechEndTimeRef = useRef<number>(0);
  // Replay timer: fires 8s after barge-in if no final_transcript arrives.
  // Asks the backend to re-TTS the last AI response so the user doesn't get
  // silently stuck after accidentally interrupting (cough, noise, etc.).
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Releases browser-side resources (mic track, AudioContexts, mock timers)
  // without touching React state. Called from both endSession (user taps to
  // stop) and the error path (so the error message survives the cleanup).
  const teardown = useCallback(async () => {
    speechEndTimeRef.current = 0;
    if (replayTimerRef.current !== null) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    const mic = micRef.current;
    const playback = playbackRef.current;
    const client = clientRef.current;
    micRef.current = null;
    playbackRef.current = null;
    vadRef.current = null;
    bargeInRef.current = null;
    clientRef.current = null;
    try {
      await mic?.stop();
    } catch {
      /* ignore */
    }
    try {
      await playback?.dispose();
    } catch {
      /* ignore */
    }
    try {
      await client?.disconnect();
    } catch {
      /* ignore */
    }
  }, []);

  const endSession = useCallback(async () => {
    // Tell the backend BEFORE we tear down the WS — once the socket closes the
    // signal cannot reach the server. The backend's WS finally block reads this
    // flag to decide whether to run post-correction + email + pipeline_finalize.
    // Without this flag the conversation is left for the 1h cleanup cron.
    try {
      clientRef.current?.sendCloseSession();
    } catch {
      /* WS may already be tearing down — ignore */
    }
    await teardown();
    // RESET drops the paused conversation_id along with everything else; the
    // user has explicitly chosen to close, so there is nothing to resume.
    clearPausedConversationId();
    dispatch({ type: 'RESET' });
  }, [teardown]);

  // Lightweight pause: mic + WS + playback teardown WITHOUT touching React state.
  // Reused by manual button taps, the 60s idle timer, network-loss detection,
  // and the iOS phone-call AudioContext suspension hook. The conversation_id is
  // already in sessionStorage by the time the first `turn_complete` fires, so a
  // resume can pick up where this left off.
  const pauseSession = useCallback(
    async (reason?: string) => {
      if (!clientRef.current && !micRef.current && !playbackRef.current) {
        // Nothing to pause; idempotent guard for double-fires (e.g. idle timer
        // races with a manual tap).
        return;
      }
      console.log('[PAUSE] start', { reason: reason ?? 'manual' });
      // Chime fires on every pause (manual + auto). Single helper keeps the
      // UX consistent and avoids accidentally skipping the cue on a path the
      // caller forgot to wire up — pauseSession is the single chokepoint.
      playPauseChime();
      await teardown();
      dispatch({ type: 'PAUSE', reason });
    },
    [teardown],
  );

  const startSession = useCallback(async (conversationId?: string) => {
    if (clientRef.current) return;
    dispatch({ type: 'SET_MODE', mode: 'connecting' });

    // Promise that resolves on backend `ready` arrival. Resume + Soniox prewarm
    // can take 1–2 s; mic must NOT start before this so the user cannot speak
    // into a cold STT pipeline. The onReady handler installed on the client
    // (below) resolves this promise.
    let readyResolve: (() => void) | null = null;
    const readyPromise = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });

    const playback = new PlaybackEngine({
      sampleRate: 24000,
      onStarted: () => {
        // First PCM buffer scheduled in AudioContext — measure full PTT.
        // Formula: 760ms (VAD silence window) + (now − send_end_of_utterance).
        const t0 = speechEndTimeRef.current;
        if (t0 > 0) {
          const backendMs = Date.now() - t0;
          console.log('[PTT] measured totalPtMs=' + (760 + backendMs) + ' backendMs=' + backendMs);
          speechEndTimeRef.current = 0;
        }
      },
      onEnded: () => {
        bargeInRef.current?.disable();
        // Flip to 'listening' only after the last PCM buffer drains so the
        // mic doesn't open while TTS audio is still bleeding into the room.
        dispatch({ type: 'PLAYBACK_ENDED' });
      },
    });
    playbackRef.current = playback;

    const bargeIn = new BargeInDetector(() => {
      // Detector fires once per TTS turn; kill the in-flight stream and
      // tell the server. Mode flips back to 'listening' when the mock
      // emits turn_complete in response.
      playback.stop();
      console.log('[CLIENT] send_barge_in');
      // No ring-buffer flush: the frontend now streams PCM continuously
      // during assistant-speaking (full-duplex), so backend's
      // _audio_buffer[-_BARGE_IN_PRE_BUFFER_BYTES:] slice already contains
      // the speech onset that triggered detection. sendBargeIn also sets
      // the client-side drop-in-flight-TTS flag so frames already on the
      // wire don't leak past PlaybackEngine.stop() (Pipecat #3077 pattern).
      clientRef.current?.sendBargeIn();

      // Start the 2-second replay timer. If the user interrupted by accident
      // (cough, noise) and no speech is recognized within 2s, the AI replays
      // its last message so the conversation doesn't silently stall.
      // We reset any prior timer first in case barge-in fires twice somehow.
      if (replayTimerRef.current !== null) {
        clearTimeout(replayTimerRef.current);
      }
      replayTimerRef.current = setTimeout(() => {
        // Guard: only send if we're quietly waiting — not mid-turn or mid-speech.
        if (modeRef.current === 'listening') {
          replayTimerRef.current = null;
          console.log('[REPLAY] sending replay_last — no transcript for 2s after barge-in');
          clientRef.current?.sendReplayLast();
        }
        // When guard blocks (mode != 'listening'): ref intentionally keeps the stale
        // expired timeout ID (non-null). The error handler checks !== null to restart
        // the timer when the next empty-STT arrives. clearTimeout on an expired ID
        // is a documented safe no-op in all browsers.
      }, 2000);
    });
    bargeInRef.current = bargeIn;

    const vad = new VadProcessor((ev) => {
      if (ev.type === 'speech-start') {
        // Cancel any pending replay timer — VAD detected user voice, so the
        // post-barge-in/error replay path (which assumes user went silent)
        // no longer applies. clearTimeout on null/expired is a documented
        // browser no-op, so the unconditional clear is safe.
        if (replayTimerRef.current !== null) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        dispatch({ type: 'USER_SPEECH_START' });
        clientRef.current?.sendSpeechStart();
      } else {
        // Capture wall-clock time at the moment we send end_of_utterance.
        // PTT = 760ms (VAD silence window already elapsed) + (queue_started − this).
        speechEndTimeRef.current = Date.now();
        dispatch({ type: 'USER_SPEECH_END' });
        console.log('[CLIENT] send_end_of_utterance', { durationMs: ev.durationMs });
        clientRef.current?.sendEndOfUtterance();
      }
    });
    vadRef.current = vad;

    const client = createConversationClient({
      onMessage: (msg) => {
        // Persist conversation_id from every turn_complete so a manual pause
        // (or a tab reload mid-session) has it ready in sessionStorage.
        // Idempotent — overwriting with the same id is free.
        if (msg.type === 'turn_complete' && msg.conversation_id) {
          savePausedConversationId(msg.conversation_id);
        }
        // Cancel replay timer the moment a confirmed transcript arrives —
        // the user spoke and was understood, so no replay is needed.
        if (msg.type === 'final_transcript' && replayTimerRef.current !== null) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        // On any backend error (including empty-STT live_empty_fallback):
        // schedule a replay so the conversation never silently stalls. The
        // earlier version gated this on `replayTimerRef.current !== null`,
        // which only refreshed an existing barge-in timer — once a barge-in
        // produced a real (or garbage-text, e.g. cough → "öhö") transcript
        // and the timer was cleared, subsequent empty-STT errors would not
        // fire any replay and the user heard silence with only the inline
        // error banner. Always (re)setting the timer here means every
        // "ses anlaşılamadı" path gets a 2 s grace window before the
        // assistant replays its last line — recoverable UX in the silent-
        // failure case, mildly redundant in the noisy case (acceptable).
        if (msg.type === 'error') {
          // Provider overload / auth-class failure: backend tags `kind:"rate_limit"`
          // when its retry budget is exhausted on a recoverable upstream issue
          // (Anthropic 429, OpenAI quota, Soniox 429, etc.). Auto-pause is the
          // right UX — replay_last would just re-trigger the same upstream
          // failure, and a silent error banner would leave the user wondering
          // whether they should keep speaking. pauseSession plays the chime,
          // tears down mic+ws+playback, and dispatches PAUSE with a special
          // 'yoğunluk' reason that the reducer translates to a Turkish
          // user-friendly banner.
          if (msg.kind === 'rate_limit') {
            console.log('[PAUSE] rate_limit_received', { message: msg.message });
            void pauseSession('overloaded');
            return;
          }
          if (replayTimerRef.current !== null) {
            clearTimeout(replayTimerRef.current);
          }
          replayTimerRef.current = setTimeout(() => {
            if (modeRef.current === 'listening') {
              replayTimerRef.current = null;
              console.log('[REPLAY] sending replay_last — no transcript after 2s post empty-STT');
              clientRef.current?.sendReplayLast();
            }
            // Stale-ID pattern: guard blocked (mode != 'listening') → ref
            // stays non-null storing an expired timeout id. The next error
            // arrival re-enters the clearTimeout branch above (no-op on the
            // stale id, documented browser behavior) and replaces it.
          }, 2000);
        }
        handleServerMessage(msg, dispatch, playback, bargeIn);
      },
      onAudio: (pcm) => playback.enqueue(pcm),
      onState: () => {
        /* connection state surfaces via mode transitions */
      },
      onError: (e) => {
        dispatch({ type: 'ERROR', error: e.message });
        // Release resources but keep the error visible — endSession would
        // RESET the state and the user would never see what went wrong.
        void teardown();
      },
      onNetworkLoss: () => {
        // The pong watchdog already burned its 15s grace before firing — this
        // callback IS the "network has been silent for too long" signal. Pause
        // immediately rather than introducing a second timer.
        console.log('[PAUSE] network_loss');
        void pauseSession('network_loss');
      },
      onEvicted: (reason) => {
        // Another device opened the same conversation_id and stole the slot.
        // We end (not pause): the other device now owns the resume key. Show a
        // banner via ERROR so the user understands why the session closed.
        console.log('[WS] evicted', { reason });
        clearPausedConversationId();
        dispatch({
          type: 'ERROR',
          error: 'Bu konuşma başka bir cihazda devam ediyor.',
        });
        void teardown();
      },
      onResumeFailed: (reason) => {
        // Backend rejected our conversation_id — clear sessionStorage so we
        // don't keep retrying. The session continues as a fresh conversation
        // (the backend already created a new Conversation in `_ensure_conversation_exists`).
        console.log('[RESUME] failed', { reason });
        clearPausedConversationId();
        if (reason === 'closed') {
          dispatch({
            type: 'BACKEND_WARNING',
            error: 'Önceki konuşma kapandı. Yeni bir oturumdayız.',
          });
        } else if (reason === 'legacy_history') {
          dispatch({
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
    clientRef.current = client;

    const mic = new MicCapture({
      onFrame: (frame) => {
        dispatch({ type: 'RMS', rms: frame.rms });
        const m = modeRef.current;
        // Full-duplex: stream PCM continuously regardless of mode. Backend
        // appends every frame to _audio_buffer; the live STT queue is only
        // open during user-speaking turns, so Soniox is never driven during
        // TTS playback. Continuous capture keeps the browser AEC continuously
        // trained, avoids AudioWorklet first-frame loss on every mode flip,
        // and ensures backend's pre-buffer slice (last 1 s of _audio_buffer)
        // contains real speech onset rather than zeros — the structural fix
        // for the "first syllable lost when speaking near end of TTS" bug.
        if (m === 'listening' || m === 'user-speaking' || m === 'assistant-speaking') {
          clientRef.current?.sendPcm(frame.pcm);
        }
        // VAD only runs in listening / user-speaking — driving it during
        // assistant-speaking would race with barge-in detection and produce
        // phantom speech_start events on TTS speaker bleed.
        if (m === 'listening' || m === 'user-speaking') {
          vadRef.current?.pushFrame(frame.rms, frame.timestamp);
        } else if (m === 'assistant-speaking') {
          bargeInRef.current?.pushFrame(frame.rms);
        }
      },
    });
    micRef.current = mic;

    try {
      // All AudioContext creation happens here — still synchronous inside
      // the user-gesture frame that started this call, so iOS unlocks both.
      await playback.prepare();
      // `conversationId` is the resume hint — when present the backend reloads
      // the existing Conversation from MongoDB. When absent, this connect path
      // creates a fresh session as before.
      await client.connect(conversationId);
      // Wait for the backend `ready` signal BEFORE opening the mic. The backend
      // sends ready only after session.initialize() finishes (provider health
      // checks + Soniox prewarm + optional resume reload). 30 s ceiling matches
      // the backend's outer init timeout — if the wait exceeds it, the backend
      // is hung and proceeding to mic.start would let the user speak into a
      // cold STT pipeline. Treat as fatal: throw, fall to ERROR mode, let user
      // retry. Earlier this used a non-fatal 8 s with `console.warn` and
      // proceeded anyway, but that produced a coordination bug: when backend
      // init was slow (5–7 s), frontend flipped to 'listening' before the
      // backend was ready, breaking the premature-speech prevention guarantee.
      await Promise.race([
        readyPromise,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Bağlantı kurulamadı (zaman aşımı), lütfen tekrar deneyin.')), 30_000),
        ),
      ]);
      await mic.start();
      dispatch({ type: 'SET_MODE', mode: 'listening' });
    } catch (e) {
      dispatch({ type: 'ERROR', error: friendlyError(e) });
      void teardown();
    }
  }, [teardown, pauseSession]);

  // Resume from a paused state by re-opening the WS with the stored
  // conversation_id. If sessionStorage has lost the id (private browsing,
  // storage quota, manual clear) we fall through to a fresh start so the user
  // is never stuck with an unrecoverable paused screen.
  const resumeSession = useCallback(async () => {
    const id = getPausedConversationId();
    console.log('[RESUME] start', { conversation_id: id });
    dispatch({ type: 'RESUME' });
    await startSession(id ?? undefined);
  }, [startSession]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  // OS/browser lifecycle events that would silently break the mic or the
  // socket. With the pause/resume feature in place, soft interruptions
  // (iOS phone call → AudioContext suspended) become a pause rather than a
  // session-killing error so the user can resume seamlessly. Hard hardware
  // changes (headset unplug, page navigation) still tear down — they are
  // not recoverable through resume alone.
  useEffect(() => {
    const active = state.mode !== 'idle' && state.mode !== 'error' && state.mode !== 'paused';
    if (!active) return;

    const detach = attachLifecycle({
      onDeviceChange: () => {
        dispatch({
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
        // incoming call; transitioning to pause keeps history+conversation_id
        // intact so the user can resume after the call ends.
        console.log('[PAUSE] audio_context_suspended');
        void pauseSession('audio_suspended');
      },
    });
    return detach;
  }, [state.mode, teardown, pauseSession]);

  // 60-second idle auto-pause: when the assistant is sitting in `listening`
  // with no user speech detected, release the mic + WS and flip to paused.
  // Implemented as a useEffect that re-arms on every mode change so transient
  // states (user-speaking, processing, assistant-speaking) reset the clock.
  // Reads modeRef inside the timer callback because the closed-over `state.mode`
  // is the value at scheduling time — a fast mode flip after we set the timer
  // would otherwise fire pause against stale state.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (state.mode !== 'listening') return;
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      if (modeRef.current !== 'listening') return;
      console.log('[PAUSE] idle_timer_fired');
      void pauseSession('idle_timeout');
    }, 10_000); // TEMP: production should be 60_000 — reduced to 10 s for live test convenience
    return () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [state.mode, pauseSession]);

  const onClick = useCallback(() => {
    // The single mic button is now overloaded with three semantics keyed off
    // the current mode:
    //   idle/error           → start a fresh session
    //   paused               → resume the existing session
    //   anything else active → pause the current session (NOT end — close is
    //                          a separate secondary button shown only while paused)
    if (state.mode === 'idle' || state.mode === 'error') {
      void startSession();
    } else if (state.mode === 'paused') {
      void resumeSession();
    } else {
      void pauseSession('manual');
    }
  }, [state.mode, startSession, resumeSession, pauseSession]);

  const active = state.mode !== 'idle' && state.mode !== 'error';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}
    >
      {insecureHost && (
        <div
          role="status"
          style={{
            maxWidth: 420,
            padding: '10px 14px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 10,
            color: '#713f12',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <strong>Güvensiz bağlantı.</strong> Tarayıcılar mikrofonu yalnızca
          <code style={{ margin: '0 4px' }}>https://</code>veya
          <code style={{ margin: '0 4px' }}>localhost</code>üzerinden açar.
          <br />
          Şu anki adres: <code>{insecureHost}</code> — yerine{' '}
          <code>localhost:3000</code> üzerinden açın.
        </div>
      )}

      <MicButton mode={state.mode} rms={state.rms} onClick={onClick} />

      {state.mode === 'paused' && (
        <button
          type="button"
          onClick={endSession}
          style={pausedCloseButtonStyle}
        >
          Konuşmayı Kapat
        </button>
      )}

      <p style={{ margin: 0, fontSize: 15, color: '#6b6b74', minHeight: 22 }}>
        {statusMessage(state.mode)}
      </p>

      {active && <RmsBar rms={state.rms} accent={state.mode} />}

      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}

      {/* TranscriptPanel is dev-only by default. Production is voice-only —
          the user listens, the on-screen text is reserved for debugging.
          Override per-environment via NEXT_PUBLIC_SHOW_TRANSCRIPT=1. */}
      {env.showTranscript && (state.partial || state.final || state.assistantText) && (
        <TranscriptPanel
          partial={state.partial}
          final={state.final}
          assistantText={state.assistantText}
          mode={state.mode}
        />
      )}

      {/* Same env gate as TranscriptPanel — both surface transcript text. */}
      {env.showTranscript && state.history.length > 0 && <HistoryPanel entries={state.history} />}
    </div>
  );
}

function handleServerMessage(
  msg: WsServerMessage,
  dispatch: Dispatch<Action>,
  playback: PlaybackEngine,
  bargeIn: BargeInDetector,
): void {
  switch (msg.type) {
    case 'ready':
      break;
    case 'partial_transcript':
      dispatch({ type: 'PARTIAL', text: msg.text });
      break;
    case 'final_transcript':
      dispatch({ type: 'FINAL', text: msg.text });
      break;
    case 'ai_text':
      dispatch({ type: 'AI_TEXT', text: msg.text });
      break;
    case 'tts_chunk_start':
      dispatch({ type: 'TTS_START' });
      bargeIn.enable();
      break;
    case 'tts_end':
      // endStream() marks the buffer boundary; onEnded fires when the last
      // PCM frame actually drains, at which point bargeIn is disabled and
      // mode flips to 'listening'. Do NOT disable bargeIn here — the user
      // must be able to barge in while buffered audio is still playing.
      playback.endStream();
      dispatch({ type: 'TTS_END' });
      break;
    case 'turn_complete':
      dispatch({ type: 'TURN_COMPLETE' });
      // If this turn had no TTS (e.g. function-call-only turn), onEnded
      // never fires, so we flip to 'listening' immediately here instead.
      if (!playback.isPlaying) {
        bargeIn.disable();
        dispatch({ type: 'PLAYBACK_ENDED' });
      }
      break;
    case 'error':
      // Backend WS errors are soft — the session stays open and the user can
      // retry. Fatal terminal errors arrive via the onError callback (network
      // close, auth failure) and dispatch ERROR from there.
      dispatch({ type: 'BACKEND_WARNING', error: msg.message });
      break;
    case 'template_activated':
    case 'template_switched':
    case 'customer_created':
    case 'followup_scheduled':
    case 'calendar_reminder_created':
      // Emitted by the real backend as side effects of LLM tool calls and
      // calendar_auto. The streaming UI doesn't render toasts for them yet
      // (Faz 3 polish will) — they're exhaustively listed here so the Zod
      // discriminated union in wsServerMessageSchema stays exhaustive
      // and TypeScript nags us if a new event type is added server-side
      // without a case here.
      break;
  }
}

function statusMessage(mode: MicButtonMode): string {
  switch (mode) {
    case 'idle':
      return 'Başlatmak için dokunun';
    case 'connecting':
      return 'Bağlanıyor…';
    case 'listening':
      return 'Sizi dinliyorum';
    case 'user-speaking':
      return 'Konuşuyorsunuz';
    case 'processing':
      return 'Düşünüyorum…';
    case 'assistant-speaking':
      return 'Yanıtlıyor — sözünü kesmek için konuşun';
    case 'paused':
      return 'Duraklatıldı — devam etmek için dokunun';
    case 'error':
      return 'Bir sorun oluştu';
  }
}

const pausedCloseButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  borderRadius: 10,
  color: '#991b1b',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: -4,
};

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
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return 'Bağlantı başlatılamadı.';
}

function RmsBar({ rms, accent }: { rms: number; accent: MicButtonMode }) {
  const fill = Math.min(100, (rms / 3000) * 100);
  const color =
    accent === 'user-speaking'
      ? '#ef4444'
      : accent === 'assistant-speaking'
        ? '#0ea5e9'
        : '#7c3aed';
  return (
    <div style={{ width: 240 }}>
      <div
        aria-hidden
        style={{
          width: '100%',
          height: 6,
          background: '#e5e7eb',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fill}%`,
            height: '100%',
            background: color,
            transition: 'width 40ms linear',
          }}
        />
      </div>
      <p
        style={{
          marginTop: 6,
          marginBottom: 0,
          fontSize: 11,
          color: '#9ca3af',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        RMS {rms.toFixed(0).padStart(4, ' ')}
      </p>
    </div>
  );
}

function TranscriptPanel(props: {
  partial: string;
  final: string;
  assistantText: string;
  mode: MicButtonMode;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {(props.partial || props.final) && (
        <div
          style={{
            background: '#f5f3ff',
            border: '1px solid #e9d5ff',
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#7c3aed',
            }}
          >
            Siz
          </p>
          <p style={{ margin: '4px 0 0', color: '#0b0b0f', fontSize: 15, lineHeight: 1.45 }}>
            {props.partial ? (
              <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>{props.partial}</span>
            ) : props.final}
          </p>
        </div>
      )}

      {props.assistantText && (
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#0284c7',
            }}
          >
            Asistan
          </p>
          <p style={{ margin: '4px 0 0', color: '#0b0b0f', fontSize: 15, lineHeight: 1.45 }}>
            {props.assistantText}
          </p>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  return (
    <details style={{ width: '100%', maxWidth: 420, marginTop: 8 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 13,
          color: '#6b6b74',
          listStyle: 'revert',
        }}
      >
        Bu oturum geçmişi ({entries.length})
      </summary>
      <ol
        style={{
          padding: 0,
          listStyle: 'none',
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {entries.map((e, i) => (
          <li
            key={i}
            style={{
              background: '#fafafa',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            <div>
              <strong style={{ color: '#7c3aed' }}>Siz:</strong>{' '}
              <span style={{ color: '#0b0b0f' }}>{e.user || '—'}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <strong style={{ color: '#0284c7' }}>Asistan:</strong>{' '}
              <span style={{ color: '#0b0b0f' }}>{e.assistant || '—'}</span>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: 13,
  margin: 0,
  maxWidth: 320,
  textAlign: 'center',
};
