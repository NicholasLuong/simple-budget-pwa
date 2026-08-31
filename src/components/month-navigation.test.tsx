import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonthNavigation } from './month-navigation';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('month navigation', () => {
  it('does not allow navigation beyond the real current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31));
    render(<MonthNavigation month="2026-08" onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('allows a historical month to move forward toward the current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31));
    const onChange = vi.fn();
    render(<MonthNavigation month="2026-07" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenCalledWith('2026-08');
  });
});
