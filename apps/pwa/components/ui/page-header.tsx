import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  className?: string;
};

// Top-of-page block: bold h1 title + optional muted subtitle + optional
// right-aligned action slot (e.g. "Mark all as read" on Notifications).
export function PageHeader({ title, subtitle, rightSlot, className }: Props) {
  return (
    <header
      className={cn(
        // items-center vertically aligns the right-slot button with the
        // title block centerline (rather than topline) — visually balanced
        // when subtitle is present. User-requested 2026-05-17.
        // pt-page composes env(safe-area-inset-top) with breathing room so
        // the title clears the layout-fixed icon cluster on notched devices
        // (iPhone 12+, Dynamic Island). Defined in globals.css.
        'mb-4 flex items-center justify-between gap-4 pt-page',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </header>
  );
}
