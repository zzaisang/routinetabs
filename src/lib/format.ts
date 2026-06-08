// Small display helpers shared by popup/options.

import { nextOccurrence } from './schedule';
import type { Routine } from './types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDays(days: number[]): string {
  if (!days || days.length === 0) return 'No days set';
  const sorted = [...days].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  // Weekdays Mon-Fri
  if (
    sorted.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => sorted.includes(d))
  ) {
    return 'Weekdays';
  }
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) {
    return 'Weekends';
  }
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

/** Human-friendly "next run" string for a routine. */
export function formatNextRun(routine: Routine, now: Date = new Date()): string {
  if (!routine.enabled) return 'Disabled';
  const next = nextOccurrence(routine.schedule, now);
  if (next == null) return 'Not scheduled';
  const d = new Date(next);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (dayDiff === 0) return `Today at ${time}`;
  if (dayDiff === 1) return `Tomorrow at ${time}`;
  return `${DAY_LABELS[d.getDay()]} at ${time}`;
}
