import { formatDateLabel, isValidDateKey, todayKey } from '@/lib/daily';

describe('daily date keys', () => {
  it('builds today as a zero-padded local YYYY-MM-DD key', () => {
    expect(todayKey(new Date(2026, 8, 11))).toBe('2026-09-11');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('accepts real calendar dates and rejects malformed or impossible ones', () => {
    expect(isValidDateKey('2026-09-11')).toBe(true);
    expect(isValidDateKey('11-09-2026')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  it('labels a valid key as Month Day and passes anything else through', () => {
    expect(formatDateLabel('2026-09-11')).toBe('September 11');
    expect(formatDateLabel('nope')).toBe('nope');
  });
});
