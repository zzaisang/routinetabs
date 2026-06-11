// Small display helpers shared by popup/options. Language-aware via i18n.

import { nextOccurrence } from './schedule';
import { t, shortDay, localeTag } from './i18n';
import type { Routine } from './types';

export function formatDays(days: number[]): string {
  if (!days || days.length === 0) return t('days.none');
  const sorted = [...days].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (sorted.length === 7) return t('days.every');
  // Weekdays Mon-Fri
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) {
    return t('days.weekdays');
  }
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) {
    return t('days.weekends');
  }
  return sorted.map((d) => shortDay(d)).join(', ');
}

/** Human-friendly "next run" string for a routine. */
export function formatNextRun(routine: Routine, now: Date = new Date()): string {
  if (!routine.enabled) return t('next.disabled');
  const next = nextOccurrence(routine.schedule, now);
  if (next == null) return t('next.notScheduled');
  const d = new Date(next);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const time = d.toLocaleTimeString(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (dayDiff === 0) return t('next.today', { time });
  if (dayDiff === 1) return t('next.tomorrow', { time });
  return t('next.onDay', { day: shortDay(d.getDay()), time });
}
