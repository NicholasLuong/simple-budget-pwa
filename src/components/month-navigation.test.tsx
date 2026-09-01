import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonthNavigation } from './month-navigation';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('month navigation', () => {
  it('allows navigation up to three months beyond the real current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31));
    const onChange = vi.fn();
    render(<MonthNavigation month="2026-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenCalledWith('2026-11');
  });

  it('does not allow navigation more than three months ahead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31));
    render(<MonthNavigation month="2026-11" onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('moves the three-month window dynamically across a year boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15));
    const onChange = vi.fn();
    render(<MonthNavigation month="2027-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenCalledWith('2027-02');
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
