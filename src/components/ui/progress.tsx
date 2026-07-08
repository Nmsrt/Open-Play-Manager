import { cn } from '@/lib/utils';

interface Props {
  value: number;
  max: number;
  className?: string;
  label?: string;
}

export function Progress({ value, max, className, label }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          pct >= 100 ? 'bg-amber-500' : 'bg-primary',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
