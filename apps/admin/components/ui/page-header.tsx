import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  className?: string;
};

// Top-of-page block: bold h1 title + optional muted subtitle + optional
// right-aligned action slot (e.g. date-range picker on Dashboard, "Yeni"
// button on Customers). items-center keeps the right slot visually centered
// against the title block centerline.
export function PageHeader({ title, subtitle, rightSlot, className }: Props) {
  return (
    <header
      className={cn(
        'mb-6 flex items-center justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="m-0 text-[24px] font-bold tracking-tight text-foreground">
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
