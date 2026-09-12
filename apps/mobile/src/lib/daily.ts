/**
 * Daily verse routing helpers. The key is the user's local calendar date
 * (`YYYY-MM-DD`); stored timestamps stay UTC — see CANONICAL_IDENTIFIERS.md.
 * Prototype scope: one daily entry (Nehemiah 2:4); the scheduled daily
 * publication lands with the backend slices.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isValidDateKey(raw: string): boolean {
  if (!DATE_PATTERN.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** "2026-09-11" -> "September 11". Falls back to the raw key. */
export function formatDateLabel(key: string): string {
  if (!isValidDateKey(key)) return key;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year as number, (month as number) - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
}
