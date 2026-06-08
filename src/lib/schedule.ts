// Pure scheduling logic for RoutineTabs (see PLAN.md §5.3 / §5.5 / §10).
//
// CRITICAL: this module must stay pure (no chrome.* / no Date.now() except via the
// `from` argument callers pass in). That keeps it unit-testable and DST-correct.
//
// DST strategy (PLAN.md §5.3):
//   We compute the *next occurrence* by constructing a Date at the user's local
//   wall-clock time on the relevant calendar day, using the local-time Date
//   constructor (new Date(y, m, d, hh, mm)). The JS engine resolves that local
//   wall-clock time into an absolute timestamp honoring the host's timezone & DST.
//   Because every firing re-computes from local wall-clock, "9:00 as the user sees
//   it" is always preserved across DST transitions — no fixed 24h interval drift.

import type { RoutineSchedule } from './types';

/** Parse "HH:MM" into { hours, minutes }. Returns null if malformed. */
export function parseTime(time: string): { hours: number; minutes: number } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!m) return null;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

/**
 * Build an absolute timestamp for the given local wall-clock time on the
 * calendar day `daysAhead` days after `base`. Uses the local-time Date
 * constructor so the host timezone & DST are applied automatically.
 */
function localTimestampOnDay(
  base: Date,
  daysAhead: number,
  hours: number,
  minutes: number
): number {
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + daysAhead,
    hours,
    minutes,
    0,
    0
  );
  return d.getTime();
}

/**
 * Compute the next firing timestamp (epoch ms) at or after `from` for the schedule.
 *
 * Rules (PLAN.md §10):
 *  - today is a scheduled day & time not yet passed  -> today
 *  - today is a scheduled day & time already passed  -> next scheduled day
 *  - multiple days -> the soonest upcoming occurrence
 *  - returns null if no days are selected or time is malformed.
 *
 * "Not yet passed" is inclusive only of strictly-future instants: if `from` is
 * exactly the scheduled instant we treat it as already due-now and return it
 * (>= from). We use a strict ">" against `from.getTime()` plus a same-minute
 * tolerance so an alarm that fires a few ms early still resolves to "now".
 */
export function nextOccurrence(schedule: RoutineSchedule, from: Date): number | null {
  const t = parseTime(schedule.time);
  if (!t) return null;
  if (!schedule.days || schedule.days.length === 0) return null;

  const validDays = new Set(
    schedule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
  if (validDays.size === 0) return null;

  const fromMs = from.getTime();

  // Look ahead up to 8 days (covers "today already passed" -> "same weekday next week").
  for (let offset = 0; offset <= 8; offset++) {
    const candidateDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() + offset
    );
    const weekday = candidateDate.getDay();
    if (!validDays.has(weekday)) continue;

    const ts = localTimestampOnDay(from, offset, t.hours, t.minutes);
    if (ts >= fromMs) {
      return ts;
    }
  }
  // Should be unreachable for valid input (a weekday always recurs within 7 days),
  // but guard anyway.
  return null;
}

/**
 * Compute the most recent scheduled occurrence strictly before `from` (epoch ms),
 * or null if there is no such occurrence within a reasonable look-back window.
 *
 * Used for catch-up: "what was the latest time this routine *should* have fired?"
 */
export function previousOccurrence(schedule: RoutineSchedule, from: Date): number | null {
  const t = parseTime(schedule.time);
  if (!t) return null;
  if (!schedule.days || schedule.days.length === 0) return null;

  const validDays = new Set(
    schedule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
  if (validDays.size === 0) return null;

  const fromMs = from.getTime();

  // Look back up to 8 days.
  for (let offset = 0; offset <= 8; offset++) {
    const candidateDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() - offset
    );
    const weekday = candidateDate.getDay();
    if (!validDays.has(weekday)) continue;

    const ts = localTimestampOnDay(from, -offset, t.hours, t.minutes);
    if (ts < fromMs) {
      return ts;
    }
  }
  return null;
}

export interface MissedDecision {
  /** The timestamp of the most recent scheduled occurrence before `now`, or null. */
  occurrence: number | null;
  /** Whether that occurrence should be caught up (within grace, after lastRunAt). */
  shouldRun: boolean;
}

/**
 * Decide whether a routine has a "missed" occurrence that should be caught up
 * after the browser was off / the worker was evicted (PLAN.md §5.5).
 *
 * A missed occurrence is caught up iff ALL of:
 *   - catchUpEnabled is true
 *   - there is a previous occurrence before `now`
 *   - that occurrence has not already been run (occurrence > lastRunAt)
 *   - that occurrence is within the grace window: now - occurrence <= grace
 *
 * Too-old occurrences (e.g. yesterday 09:00 viewed at 14:00) are ignored.
 */
export function getMissedOccurrence(
  schedule: RoutineSchedule,
  lastRunAt: number | null,
  now: Date,
  opts: { catchUpEnabled: boolean; catchUpGraceMinutes: number }
): MissedDecision {
  const occurrence = previousOccurrence(schedule, now);
  if (occurrence == null) {
    return { occurrence: null, shouldRun: false };
  }
  if (!opts.catchUpEnabled) {
    return { occurrence, shouldRun: false };
  }
  // Already ran this (or a later) occurrence?
  if (lastRunAt != null && lastRunAt >= occurrence) {
    return { occurrence, shouldRun: false };
  }
  const ageMs = now.getTime() - occurrence;
  const graceMs = opts.catchUpGraceMinutes * 60_000;
  const shouldRun = ageMs >= 0 && ageMs <= graceMs;
  return { occurrence, shouldRun };
}
