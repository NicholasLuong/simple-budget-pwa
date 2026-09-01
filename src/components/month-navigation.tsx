import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, monthKey, shiftMonth } from '../domain/months';
import { Button } from './ui/button';

export function MonthNavigation({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const isCurrent = month === monthKey();
  const latestMonth = shiftMonth(monthKey(), 3);
  const canMoveForward = month < latestMonth;
  return (
    <div className="flex items-center gap-1" aria-label="Budget month">
      <Button variant="ghost" size="icon" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
      <button className="min-w-36 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(monthKey())} aria-label={`${formatMonth(month)}${isCurrent ? ', current month' : ', go to current month'}`}>
        {formatMonth(month)}
      </button>
      <Button variant="ghost" size="icon" disabled={!canMoveForward} onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month" title={canMoveForward ? 'Next month' : 'Only three months ahead are available'}><ChevronRight /></Button>
    </div>
  );
}
