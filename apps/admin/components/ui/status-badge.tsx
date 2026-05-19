import { cn } from '@/lib/utils';

export type ReportStatus = 'in-progress' | 'completed';

// Two-status taxonomy matching PWA: in-progress (brand-violet attention) +
// completed (cyan calm). Backend may emit legacy statuses (pending-approval
// etc.); callers should coerce non-completed values to 'in-progress' before
// passing to this badge.
const STATUS_LABELS: Record<ReportStatus, string> = {
  'in-progress': 'Devam ediyor',
  completed: 'Tamamlandı',
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  'in-progress':
    'bg-brand-200 text-brand-900 border border-brand-300/50 dark:bg-brand-800 dark:text-brand-100 dark:border-brand-700/60',
  completed:
    'bg-assistant-500/15 text-assistant-600 border border-assistant-500/30 dark:bg-assistant-500/25 dark:text-assistant-400 dark:border-assistant-500/40',
};

type Props = {
  status: ReportStatus;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
