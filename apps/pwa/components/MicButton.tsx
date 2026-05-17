'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

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

// Voice screen primary affordance. 320px circular button with Framer Motion
// spring-driven scale. Industry-standard heartbeat pattern (Discord voice
// indicator, Spotify now-playing pulse): RMS-driven scale + intensifying
// shadow during speech, spring physics smooth out jitter.
//
// Spring config tuned for "softer punch" per user feedback 2026-05-17 —
// stiffness 200 (was 360), damping 28 (was 22), mass 1.0 (was 0.8). Combined
// with the formula `1 + min(0.4, rms/3500)` (max 1.4× scale; was 1.5×), the
// button no longer "jumps" to peak on first voiced frame — it climbs.
//
// Mode-specific signatures:
//   idle               — static; brand violet glow
//   connecting         — indeterminate gradient fill overlay
//   listening          — SUBTLE breath oscillation (amp 0.02, ~0.7Hz); waits attentively
//   user-speaking      — RMS-driven spring scale + intensifying red glow
//   processing         — outer wrapper rotates 360° / 8s; button static
//   assistant-speaking — VISIBLE breath oscillation (amp 0.05, ~0.9Hz); cyan glow
//   paused             — static + 140px play triangle
//   error              — pulse-error keyframe (opacity + shadow oscillation)
export function MicButton({
  mode,
  rms,
  onClick,
  disabled,
  ariaLabel,
}: MicButtonProps) {
  const label = ariaLabel ?? defaultLabel(mode);
  const speaking = mode === 'user-speaking';
  const pulsing = mode === 'assistant-speaking';
  const listening = mode === 'listening';
  const paused = mode === 'paused';
  const connecting = mode === 'connecting';
  const processing = mode === 'processing';
  const errored = mode === 'error';

  // Softer spring per user feedback — stiffness ↓, damping ↑, mass ↑.
  // The button climbs to peak rather than snapping.
  const target = useMotionValue(1);
  const springScale = useSpring(target, {
    stiffness: 200,
    damping: 28,
    mass: 1.0,
  });

  // Keep RMS in a ref so the pulsing RAF loop can read CURRENT rms without
  // re-creating the loop every 20ms when rms updates. Speaking + listening
  // useEffect still depends on rms because those are pure RMS-driven
  // (no RAF needed).
  const rmsRef = useRef(rms);
  useEffect(() => {
    rmsRef.current = rms;
  }, [rms]);

  // PULSING (assistant-speaking) → RAF sine wave baseline + RMS boost hybrid.
  // Why both: echo cancellation suppresses TTS audio bleed in the mic input,
  // so pure RMS-driven pulse barely registers during AI speech. The sine
  // baseline guarantees visible "AI is talking" pulse at all times; the RMS
  // boost amplifies on top when there IS audible input (user interrupts /
  // ambient noise). 0.8Hz baseline + up to +0.5 RMS-driven = 1.0 → 1.58
  // dynamic range.
  useEffect(() => {
    if (!pulsing) return;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = (Date.now() - start) / 1000;
      const sineBase = 0.10 * (1 + Math.sin(t * Math.PI * 2 * 0.8)) / 2; // 0..0.10, 0.8Hz
      const rmsBoost = Math.min(0.5, rmsRef.current / 2500);
      target.set(1 + sineBase + rmsBoost);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [pulsing, target]);

  // SPEAKING + LISTENING + IDLE etc. — pure RMS reactivity. Spring lag
  // absorbs jitter; the closure captures rms on every render.
  useEffect(() => {
    if (pulsing) return; // RAF effect above handles pulsing
    if (speaking) {
      target.set(1 + Math.min(0.4, rms / 3500));
      return;
    }
    if (listening) {
      target.set(1 + Math.min(0.3, rms / 2500));
      return;
    }
    target.set(1);
  }, [speaking, listening, pulsing, rms, target]);

  // Mode-tinted glow. user-speaking AND assistant-speaking both intensify
  // blur+spread+opacity with RMS — pulsing's divisors are HALVED so cyan
  // glow grows at 2× speed (matches the 2× scale amplitude). Twin-channel
  // feedback: size AND light track RMS together. Speaking glow uses brand-
  // violet alpha to match the new brand-tonal gradient (replaced red 2026-05-17).
  const glow = speaking
    ? `0 ${24 + Math.min(rms / 35, 26)}px ${64 + Math.min(rms / 22, 70)}px ${2 + Math.min(rms / 90, 8)}px oklch(0.44 0.22 295 / ${0.45 + Math.min(rms / 4500, 0.30)})`
    : pulsing
      ? `0 ${28 + Math.min(rms / 18, 50)}px ${96 + Math.min(rms / 11, 110)}px ${6 + Math.min(rms / 45, 14)}px oklch(0.58 0.16 235 / ${0.55 + Math.min(rms / 2500, 0.35)})`
      : listening
        ? '0 22px 72px 4px oklch(0.62 0.18 145 / 0.45)'
        : paused
          ? '0 18px 56px oklch(0.45 0.04 250 / 0.40)'
          : errored
            ? undefined // pulse-error keyframe owns the shadow
            : processing
              ? '0 18px 60px 2px oklch(0.66 0.16 65 / 0.40)'
              : '0 22px 68px 4px oklch(0.52 0.24 295 / 0.42)';

  return (
    <div className="relative flex h-[560px] w-full items-center justify-center">
      <div className={cn('relative', processing && 'animate-mic-spin')}>
        <motion.button
          type="button"
          onClick={onClick}
          disabled={disabled ?? connecting}
          aria-pressed={mode !== 'idle' && mode !== 'error'}
          aria-label={label}
          className={cn(
            'relative grid size-[384px] place-items-center overflow-hidden rounded-full border-0 outline-none',
            'transition-[background] duration-300 ease-out',
            connecting ? 'cursor-wait' : 'cursor-pointer',
            errored && 'animate-mic-pulse-error',
            // Tap feedback only for static modes — speaking/listening/pulsing
            // have their own spring scale and tap-override would fight it.
            !(speaking || pulsing || listening) && 'active:scale-[0.97]',
          )}
          style={{
            background: connecting
              ? 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)'
              : gradientFor(mode),
            ...(glow && { boxShadow: glow }),
            scale: springScale,
          }}
        >
          {connecting && (
            <span
              aria-hidden
              className="absolute inset-0 z-0 origin-left rounded-full animate-mic-fill"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              }}
            />
          )}
          {paused ? (
            <svg
              width="140"
              height="140"
              viewBox="0 0 24 24"
              fill="#fff"
              stroke="none"
              aria-hidden
              className="relative z-10"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg
              width="140"
              height="140"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="relative z-10"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </motion.button>
      </div>
    </div>
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
    // user-speaking — deep brand-violet duotone (brand-600 → brand-800)
    // instead of red. Visually says "Aisie is hearing you", not "danger".
    // brand-600 is the BottomTabs center FAB color; brand-800 is one step
    // darker, giving a subtle "depth" hint that distinguishes speaking
    // from idle (which uses brand-500 → brand-600 lighter pair).
    case 'user-speaking':
      return 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)';
    case 'processing':
      return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    case 'assistant-speaking':
      return 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)';
    case 'paused':
      return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
    case 'error':
      return 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)';
  }
}
