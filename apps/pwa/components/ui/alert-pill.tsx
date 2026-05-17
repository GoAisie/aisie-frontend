import Link from 'next/link';
import { cn } from '@/lib/utils';

export type AlertTone = 'attention' | 'info' | 'good';

// Soft-tinted alert row with leading dot + message text. ALL tones live
// inside the Aisie palette (violet + cyan) — no harsh yellows or greens.
// Subtle horizontal gradient (left-to-right fade) gives "premium, designer-
// touched" feel rather than solid color blocks.
//   attention → mid-violet brand-100 fading to card
//   info      → light-violet brand-50 fading to card
//   good      → cyan assistant-500/15 fading to card
const TONE_STYLES: Record<
  AlertTone,
  { bg: string; text: string; dot: string }
> = {
  attention: {
    bg: 'bg-gradient-to-r from-brand-100 to-brand-50/30 dark:from-brand-800/60 dark:to-brand-900/40',
    text: 'text-brand-800 dark:text-brand-100',
    dot: 'bg-brand-600 dark:bg-brand-400',
  },
  info: {
    bg: 'bg-gradient-to-r from-brand-50 to-card dark:from-brand-900/40 dark:to-card',
    text: 'text-brand-700 dark:text-brand-200',
    dot: 'bg-brand-500 dark:bg-brand-400',
  },
  good: {
    bg: 'bg-gradient-to-r from-assistant-500/15 to-card dark:from-assistant-500/25 dark:to-card',
    text: 'text-assistant-600 dark:text-assistant-400',
    dot: 'bg-assistant-500',
  },
};

type Props = {
  tone: AlertTone;
  label: string;
  href?: string;
  className?: string;
};

export function AlertPill({ tone, label, href, className }: Props) {
  const styles = TONE_STYLES[tone];
  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-border/40 px-4 py-3.5 text-[13.5px] leading-snug transition-all',
        styles.bg,
        styles.text,
        href && 'hover:border-border/80 active:scale-[0.99]',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', styles.dot)}
      />
      <span>{label}</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {inner}
      </Link>
    );
  }
  return inner;
}
