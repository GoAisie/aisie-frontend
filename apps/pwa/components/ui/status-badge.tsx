import { cn } from '@/lib/utils';

export type ReportStatus = 'in-progress' | 'completed';

// Two-status taxonomy per product simplification 2026-05-17: report lifecycle
// reduced from 6 states (in-progress / completed / pending-approval / approved
// / rejected / archived) to 2 (in-progress / completed). Status badge styles
// reuse design tokens — warning palette for in-progress, success for completed.
const STATUS_LABELS: Record<ReportStatus, string> = {
  'in-progress': 'Devam ediyor',
  completed: 'Tamamlandı',
};

// Aisie-tonal status palette 2026-05-17 — yellow/green generic colors
// replaced with brand+assistant duotone. in-progress is attention-grabbing
// (brand-200 fill, deep brand-900 text), completed is calmer (cyan tint
// hinting at the "done" axis of the analytics duotone).
const STATUS_STYLES: Record<ReportStatus, string> = {
  // Dark mode inverts the contrast pair: light variant uses light-violet bg
  // + deep-violet text (eye-catching on light canvas); dark variant uses
  // deep-violet bg + light-violet text (same hue family, inverted L*).
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
