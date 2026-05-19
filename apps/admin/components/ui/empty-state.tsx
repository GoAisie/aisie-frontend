import { cn } from '@/lib/utils';

type Props = {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ message, icon, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-subtle px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="m-0 text-[14px] text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
