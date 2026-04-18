'use client';

export type MicButtonMode =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'user-speaking'
  | 'processing'
  | 'assistant-speaking'
  | 'error';

export type MicButtonProps = {
  mode: MicButtonMode;
  rms: number;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

// Pure presentational: the conversation state machine owns MicCapture /
// playback / VAD etc. and reduces them into a `mode`. This component just
// visualises that mode.
export function MicButton({ mode, rms, onClick, disabled, ariaLabel }: MicButtonProps) {
  const label = ariaLabel ?? defaultLabel(mode);
  const speaking = mode === 'user-speaking';
  const pulsing = mode === 'assistant-speaking';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled ?? mode === 'connecting'}
      aria-pressed={mode !== 'idle' && mode !== 'error'}
      aria-label={label}
      style={{
        width: 220,
        height: 220,
        borderRadius: 9999,
        border: 'none',
        cursor: mode === 'connecting' ? 'wait' : 'pointer',
        background: gradientFor(mode),
        boxShadow: speaking
          ? '0 16px 48px rgba(220,38,38,0.45)'
          : pulsing
            ? '0 16px 48px rgba(14,165,233,0.4)'
            : '0 16px 48px rgba(124,58,237,0.35)',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        transition: 'transform 140ms ease, background 180ms, box-shadow 180ms',
        transform: speaking
          ? `scale(${1 + Math.min(0.08, rms / 8000)})`
          : pulsing
            ? 'scale(1.02)'
            : 'scale(1)',
        outline: 'none',
        animation: pulsing ? 'mic-pulse 1.4s ease-in-out infinite' : undefined,
      }}
    >
      <svg
        width="88"
        height="88"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>

      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 16px 48px rgba(14,165,233,0.4); }
          50%      { box-shadow: 0 16px 64px rgba(14,165,233,0.65); }
        }
      `}</style>
    </button>
  );
}

function defaultLabel(mode: MicButtonMode): string {
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
      return 'İşleniyor…';
    case 'assistant-speaking':
      return 'Asistan yanıtlıyor';
    case 'error':
      return 'Tekrar denemek için dokunun';
  }
}

function gradientFor(mode: MicButtonMode): string {
  switch (mode) {
    case 'idle':
      return 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
    case 'connecting':
      return 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)';
    case 'listening':
      return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    case 'user-speaking':
      return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    case 'processing':
      return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    case 'assistant-speaking':
      return 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)';
    case 'error':
      return 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)';
  }
}
