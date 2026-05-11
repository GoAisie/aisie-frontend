'use client';

import { useCallback, useEffect, useState } from 'react';
import { MicButton, type MicButtonMode } from '@/components/MicButton';
import { env } from '@/lib/env';
import {
  type HistoryEntry,
  useConversationStore,
} from '@/lib/conversation/conversation-store';

// Presentational shell. All session state, audio resource lifecycle, and WS
// callback wiring live in `useConversationStore` (lib/conversation/
// conversation-store.ts). This component subscribes to the slices it needs
// and dispatches store actions on user interaction. The store is a
// module-level singleton so WS + mic + playback survive Next.js App Router
// page transitions (e.g. a user navigating to /reports while listening).
export function ConversationView() {
  const mode = useConversationStore((s) => s.mode);
  const rms = useConversationStore((s) => s.rms);
  const partial = useConversationStore((s) => s.partial);
  const final = useConversationStore((s) => s.final);
  const assistantText = useConversationStore((s) => s.assistantText);
  const error = useConversationStore((s) => s.error);
  const history = useConversationStore((s) => s.history);

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

  const onClick = useCallback(() => {
    // The single mic button is overloaded with three semantics keyed off
    // the current mode:
    //   idle/error           → start a fresh session
    //   paused               → resume the existing session
    //   anything else active → pause the current session (NOT end — close is
    //                          a separate secondary button shown only while paused)
    const store = useConversationStore.getState();
    if (mode === 'idle' || mode === 'error') {
      void store.startSession();
    } else if (mode === 'paused') {
      void store.resumeSession();
    } else {
      void store.pauseSession('manual');
    }
  }, [mode]);

  const onClose = useCallback(() => {
    void useConversationStore.getState().endSession();
  }, []);

  const active = mode !== 'idle' && mode !== 'error';

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

      <MicButton mode={mode} rms={rms} onClick={onClick} />

      {mode === 'paused' && (
        <button type="button" onClick={onClose} style={pausedCloseButtonStyle}>
          Konuşmayı Kapat
        </button>
      )}

      <p style={{ margin: 0, fontSize: 15, color: '#6b6b74', minHeight: 22 }}>
        {statusMessage(mode)}
      </p>

      {active && <RmsBar rms={rms} accent={mode} />}

      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}

      {/* TranscriptPanel is dev-only by default. Production is voice-only —
          the user listens, the on-screen text is reserved for debugging.
          Override per-environment via NEXT_PUBLIC_SHOW_TRANSCRIPT=1. */}
      {env.showTranscript && (partial || final || assistantText) && (
        <TranscriptPanel
          partial={partial}
          final={final}
          assistantText={assistantText}
          mode={mode}
        />
      )}

      {/* Same env gate as TranscriptPanel — both surface transcript text. */}
      {env.showTranscript && history.length > 0 && <HistoryPanel entries={history} />}
    </div>
  );
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
