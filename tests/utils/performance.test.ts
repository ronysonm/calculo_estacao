import { describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/utils/performance';

describe('debounce', () => {
  it('executes only the last call inside the wait window', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('third');
  });

  it('preserves this context and forwards arguments', () => {
    vi.useFakeTimers();

    const state = {
      total: 0,
      add(value: number) {
        this.total += value;
      },
    };

    const debounced = debounce(state.add, 50);
    debounced.call(state, 3);

    vi.advanceTimersByTime(50);
    expect(state.total).toBe(3);
  });

  it('allows new execution after previous timer finishes', () => {
    vi.useFakeTimers();

    const spy = vi.fn();
    const debounced = debounce(spy, 25);

    debounced();
    vi.advanceTimersByTime(25);
    debounced();
    vi.advanceTimersByTime(25);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
