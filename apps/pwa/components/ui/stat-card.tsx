import Link from 'next/link';
import { cn } from '@/lib/utils';

export type StatTone = 'good' | 'attention' | 'bad' | 'neutral';

// KPI/metric card — Analytics summary grid. Soft brand-tinted gradient
// (top-left card surface → bottom-right brand-50/30) gives the "designer-
// touched" depth that pure flat fills lack. Hover lifts the gradient
// intensity. Numeric value is hero typography.
type Props = {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  tone?: StatTone;
  href?: string;
  className?: string;
};

const TONE_COLOR: Record<StatTone, string> = {
  good: 'text-assistant-600',
  attention: 'text-brand-700',
  bad: 'text-destructive',
  neutral: 'text-muted-foreground',
};

export function StatCard({
  label,
  value,
  subtitle,
  delta,
  deltaLabel,
  tone = 'neutral',
  href,
  className,
}: Props) {
  let deltaText: string | null = null;
  let deltaClassName = 'text-muted-foreground';
  if (typeof delta === 'number') {
    if (delta > 0) {
      deltaText = `↑ +${delta}${deltaLabel ? ' ' + deltaLabel : ''}`;
      deltaClassName = 'text-assistant-600';
    } else if (delta < 0) {
      deltaText = `↓ ${delta}${deltaLabel ? ' ' + deltaLabel : ''}`;
      deltaClassName = 'text-destructive';
    } else {
      deltaText = 'değişim yok';
    }
  }
  const card = (
    <div
      className={cn(
        // Monochromatic violet fade — same hue family as the BottomTabs
        // active-pill (brand-700), saturated enough that the surface reads
        // as "deliberately brand-tonal" rather than "tinted white". Light
        // mode uses brand-200 → brand-100/40 (mid-light pair); dark mode
        // mirrors with brand-800/60 → brand-900/40 (deep pair). Hover
        // deepens both stops one rung along the same hue ladder.
        'flex h-full flex-col gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-brand-200/70 to-brand-100/40 px-4 py-4 transition-all dark:from-brand-800/60 dark:to-brand-900/40',
        href &&
          'hover:from-brand-300/70 hover:to-brand-200/50 dark:hover:from-brand-700/70 dark:hover:to-brand-800/50 active:scale-[0.98]',
        className,
      )}
    >
      <span className="text-[12px] font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <strong className="text-[28px] font-bold leading-none tracking-tight text-foreground">
        {value}
      </strong>
      {deltaText && (
        <span className={cn('text-[11.5px] font-medium', deltaClassName)}>
          {deltaText}
        </span>
      )}
      {!deltaText && subtitle && (
        <span className={cn('text-[11.5px] font-medium', TONE_COLOR[tone])}>
          {subtitle}
        </span>
      )}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {card}
      </Link>
    );
  }
  return card;
}
