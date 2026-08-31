import type { CategorySummary } from '../domain/budget';
import { formatMoney } from '../domain/money';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Button } from './ui/button';

export function CategoryList({ categories, onCover }: { categories: CategorySummary[]; onCover?: (categoryId: string) => void }) {
  if (!categories.length) return <p className="empty-state">No spending categories are active.</p>;
  return (
    <div className="category-list">
      {categories.map((item, index) => {
        const over = item.remainingCents < 0;
        const warning = !over && item.usagePercent >= 85;
        return (
          <div key={item.category.id}>
            <div className="category-row">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.category.color }} aria-hidden="true" />
                  <h3 className="truncate text-sm font-medium">{item.category.name}</h3>
                </div>
                <p className="mt-1 pl-[18px] text-xs text-muted-foreground tabular-nums">{formatMoney(item.spentCents)} of {formatMoney(item.allocatedCents)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${over ? 'text-destructive' : warning ? 'text-warning' : ''}`}>
                  {over ? `${formatMoney(Math.abs(item.remainingCents))} over` : `${formatMoney(item.remainingCents)} left`}
                </p>
                {over && onCover && <Button className="mt-1 h-auto min-h-0 px-0 py-1 text-xs" variant="ghost" onClick={() => onCover(item.category.id)}>Cover overage</Button>}
              </div>
              <Progress className="col-span-2 h-1.5" value={item.usagePercent} label={`${item.category.name}: ${Math.round(item.usagePercent)} percent used`} indicatorClassName={over ? 'bg-destructive' : warning ? 'bg-warning' : undefined} />
            </div>
            {index < categories.length - 1 && <Separator />}
          </div>
        );
      })}
    </div>
  );
}
