'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  unread?: boolean;
  gradient?: boolean;
  className?: string;
  children: React.ReactNode;
};

// Row item used on Reports/Customers/Calendar/Notifications list pages.
// - href: navigation target (becomes <Link>)
// - onClick: imperative action (becomes <button>)
// - selected: brand-tinted highlight (e.g. selected day on calendar)
// - unread: subtle brand-50 background hint (Notifications)
// - gradient: Aisie duotone (brand-100 → assistant-500/15), same family as
//             Analytics StatCard. Used on Reports + Customers list rows so
//             the three content areas share one visual surface language.
// Default: neutral card surface with hover-muted.
export function ListCard({
  href,
  onClick,
  selected,
  unread,
  gradient,
  className,
  children,
}: Props) {
  const interactive = !!href || !!onClick;
  const styles = cn(
    'block rounded-xl border px-3.5 py-3 text-left text-foreground transition-colors',
    selected
      ? 'border-brand-200 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/50'
      : unread
        ? 'border-brand-100 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-900/40'
        : gradient
          ? 'border-border/40 bg-gradient-to-br from-brand-200/70 to-brand-100/40 dark:from-brand-800/60 dark:to-brand-900/40'
          : 'border-border bg-card',
    interactive && (gradient
      ? 'hover:from-brand-300/70 hover:to-brand-200/50 dark:hover:from-brand-700/70 dark:hover:to-brand-800/50 active:scale-[0.99]'
      : 'hover:bg-muted/60 active:scale-[0.99]'),
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cn(styles, 'no-underline')}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(styles, 'w-full')}>
        {children}
      </button>
    );
  }
  return <div className={styles}>{children}</div>;
}
