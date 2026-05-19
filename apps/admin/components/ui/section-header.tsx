import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
};

export function SectionHeader({ title, subtitle, className }: Props) {
  return (
    <div
      className={cn(
        'mb-2 mt-4 flex items-baseline justify-between gap-2',
        className,
      )}
    >
      <h2 className="m-0 text-[15px] font-bold text-foreground">{title}</h2>
      {subtitle && (
        <span className="text-[11.5px] text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}
