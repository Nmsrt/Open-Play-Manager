import { formatDateParts } from '@/lib/utils';
import { cn } from '@/lib/utils';

/** Weekday, date, and time as three visually separate segments — not one
 * comma-run-on string — so it reads clearly at a glance. */
export default function SessionDateTime({
  iso,
  className,
  dividerClassName,
}: {
  iso: string;
  className?: string;
  dividerClassName?: string;
}) {
  const { weekday, date, time } = formatDateParts(iso);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span className="font-bold">{weekday}</span>
      <span aria-hidden className={cn('opacity-40', dividerClassName)}>
        |
      </span>
      <span>{date}</span>
      <span aria-hidden className={cn('opacity-40', dividerClassName)}>
        |
      </span>
      <span className="font-bold">{time}</span>
    </span>
  );
}
