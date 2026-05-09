'use client';

export type MicButtonMode =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'user-speaking'
  | 'processing'
  | 'assistant-speaking'
  | 'paused'
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
  const paused = mode === 'paused';
  const connecting = mode === 'connecting';

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
        // While connecting we keep the base track in the dim "incoming" purple
        // and let the absolutely-positioned fill overlay (below) animate the
        // brand color in left-to-right. Other modes use the static gradient.
        background: connecting
          ? 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)'
          : gradientFor(mode),
        boxShadow: speaking
          ? '0 16px 48px rgba(220,38,38,0.45)'
          : pulsing
            ? '0 16px 48px rgba(14,165,233,0.4)'
            : paused
              ? '0 16px 48px rgba(100,116,139,0.4)'
              : '0 16px 48px rgba(124,58,237,0.35)',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
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
      {connecting && (
        // Fill overlay — runs an indeterminate loop (grow → shrink → grow…)
        // for as long as the parent stays in 'connecting' mode. The animation
        // duration is 1.6 s per cycle, but the visual is gated entirely by
        // backend state: when the WS sends `ready` the React reducer flips to
        // 'listening', this overlay unmounts, and the animation stops naturally.
        // No fixed timer assumption — a slow init (5–7 s on a cold cache)
        // simply runs more cycles. Indeterminate progress is the honest
        // representation when the wait length is variable; a fixed-duration
        // fill would either complete prematurely (looking done while still
        // waiting) or stall full-bar (looking frozen).
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
            transformOrigin: 'left center',
            animation: 'mic-fill 1600ms cubic-bezier(0.4, 0, 0.6, 1) infinite',
            zIndex: 0,
          }}
        />
      )}
      {paused ? (
        // Play triangle (▶) — the inviting "tap to resume" affordance.
        <svg
          width="88"
          height="88"
          viewBox="0 0 24 24"
          fill="#fff"
          stroke="none"
          aria-hidden
          style={{ position: 'relative', zIndex: 1 }}
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      ) : (
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
          style={{ position: 'relative', zIndex: 1 }}
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}

      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 16px 48px rgba(14,165,233,0.4); }
          50%      { box-shadow: 0 16px 64px rgba(14,165,233,0.65); }
        }
        @keyframes mic-fill {
          /* Indeterminate loading: grow then shrink, looped forever. The cycle
             stops when React unmounts this overlay on backend ready arrival. */
          0%, 100% { transform: scaleX(0.04); opacity: 0.55; }
          50%      { transform: scaleX(1.0);  opacity: 0.95; }
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
    case 'paused':
      return 'Devam etmek için dokunun';
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
    // Slate gradient: distinct from every active state, signals "dormant /
    // ready to resume" without competing visually with listening (green) or
    // assistant-speaking (cyan). The play triangle inside makes the affordance
    // immediately readable.
    case 'paused':
      return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
    case 'error':
      return 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)';
  }
}
