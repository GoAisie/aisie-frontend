import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
};

// Mid-page section divider: bold h2 (smaller than PageHeader) + optional
// right-aligned muted subtitle. Used between sections on Analytics ("Son
// 30 gün" / "Senin için") and other multi-block pages.
export function SectionHeader({ title, subtitle, className }: Props) {
  return (
    <div
      className={cn(
        'mb-2 mt-4 flex items-baseline justify-between gap-2',
        className,
      )}
    >
      <h2 className="m-0 text-[14px] font-bold text-foreground">{title}</h2>
      {subtitle && (
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}
