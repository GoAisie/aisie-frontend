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
import {
  type ConversationClient,
  createConversationClient,
} from '@/lib/ws/conversation-client';

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
  | { type: 'PLAYBACK_ENDED' };

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
      return { ...state, mode: 'user-speaking', partial: '', final: '', error: null };
    case 'USER_SPEECH_END':
      return { ...state, mode: 'processing' };
    case 'PARTIAL':
      return { ...state, partial: action.text };
    case 'FINAL':
      return { ...state, final: action.text, partial: '' };
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
      return { ...state, mode: 'listening' };
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

  // Releases browser-side resources (mic track, AudioContexts, mock timers)
  // without touching React state. Called from both endSession (user taps to
  // stop) and the error path (so the error message survives the cleanup).
  const teardown = useCallback(async () => {
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
    await teardown();
    dispatch({ type: 'RESET' });
  }, [teardown]);

  const startSession = useCallback(async () => {
    if (clientRef.current) return;
    dispatch({ type: 'SET_MODE', mode: 'connecting' });

    const playback = new PlaybackEngine({
      sampleRate: 24000,
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
      clientRef.current?.sendBargeIn();
    });
    bargeInRef.current = bargeIn;

    const vad = new VadProcessor((ev) => {
      if (ev.type === 'speech-start') {
        dispatch({ type: 'USER_SPEECH_START' });
      } else {
        dispatch({ type: 'USER_SPEECH_END' });
        clientRef.current?.sendEndOfUtterance();
      }
    });
    vadRef.current = vad;

    const client = createConversationClient({
      onMessage: (msg) => handleServerMessage(msg, dispatch, playback, bargeIn),
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
    });
    clientRef.current = client;

    const mic = new MicCapture({
      onFrame: (frame) => {
        dispatch({ type: 'RMS', rms: frame.rms });
        const m = modeRef.current;
        if (m === 'listening' || m === 'user-speaking') {
          clientRef.current?.sendPcm(frame.pcm);
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
      await client.connect();
      await mic.start();
      dispatch({ type: 'SET_MODE', mode: 'listening' });
    } catch (e) {
      dispatch({ type: 'ERROR', error: friendlyError(e) });
      void teardown();
    }
  }, [teardown]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  // OS/browser lifecycle events that would silently break the mic or the
  // socket. We treat them all as "end the session, user re-taps" — the
  // alternative (auto-resume) would need conversation_id rehydration in
  // the backend and isn't worth the complexity for pilot.
  useEffect(() => {
    const active = state.mode !== 'idle' && state.mode !== 'error';
    if (!active) return;

    const detach = attachLifecycle({
      onDeviceChange: () => {
        dispatch({
          type: 'ERROR',
          error: 'Ses cihazı değişti, lütfen tekrar başlatın.',
        });
        void teardown();
      },
      onHidden: () => {
        // Release mic so iOS/other apps can take it; user re-taps on return.
        void endSession();
      },
      onUnload: () => {
        void teardown();
      },
      onAudioContextSuspended: () => {
        dispatch({
          type: 'ERROR',
          error: 'Ses bağlantısı askıya alındı, devam etmek için dokunun.',
        });
        void teardown();
      },
    });
    return detach;
  }, [state.mode, endSession, teardown]);

  const onClick = useCallback(() => {
    if (state.mode === 'idle' || state.mode === 'error') {
      void startSession();
    } else {
      void endSession();
    }
  }, [state.mode, startSession, endSession]);

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

      <p style={{ margin: 0, fontSize: 15, color: '#6b6b74', minHeight: 22 }}>
        {statusMessage(state.mode)}
      </p>

      {active && <RmsBar rms={state.rms} accent={state.mode} />}

      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}

      {(state.partial || state.final || state.assistantText) && (
        <TranscriptPanel
          partial={state.partial}
          final={state.final}
          assistantText={state.assistantText}
          mode={state.mode}
        />
      )}

      {state.history.length > 0 && <HistoryPanel entries={state.history} />}
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
    case 'error':
      return 'Bir sorun oluştu';
  }
}

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
            {props.final}
            {props.partial && !props.final && (
              <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>{props.partial}</span>
            )}
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
