import { cn } from '../../lib/utils';

export function Progress({ value, className, indicatorClassName, label }: { value: number; className?: string; indicatorClassName?: string; label?: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bounded)} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none', indicatorClassName)} style={{ width: `${bounded}%` }} />
    </div>
  );
}
