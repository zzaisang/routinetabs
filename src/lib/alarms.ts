// Alarm naming + (re)scheduling helpers (PLAN.md §5.3 / §5.4 / §5.6).
//
// Strategy: self-rescheduling ONE-SHOT alarms. We never use periodInMinutes
// (which drifts across DST). Each routine maps 1:1 to an alarm named
// "routine:<id>". On fire we recompute the next local wall-clock occurrence and
// create a fresh one-shot alarm.

import { nextOccurrence } from './schedule';
import type { Routine } from './types';

export const ALARM_PREFIX = 'routine:';

export function alarmName(routineId: string): string {
  return `${ALARM_PREFIX}${routineId}`;
}

/** Extract a routine id from an alarm name, or null if not a routine alarm. */
export function routineIdFromAlarm(name: string): string | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  return name.slice(ALARM_PREFIX.length);
}

/**
 * (Re)schedule the one-shot alarm for a routine based on its next occurrence.
 * - If the routine is disabled or has no valid schedule, the alarm is cleared.
 * - Otherwise an alarm is created at the absolute `when` timestamp.
 */
export async function scheduleRoutine(routine: Routine, from: Date = new Date()): Promise<void> {
  const name = alarmName(routine.id);
  // Always clear first so we never end up with a stale/duplicate alarm.
  await chrome.alarms.clear(name);

  if (!routine.enabled) return;

  const when = nextOccurrence(routine.schedule, from);
  if (when == null) return; // no days / bad time -> nothing to schedule

  // chrome.alarms enforces a minimum, but `when`-based alarms in the future are
  // fine. Guard against a `when` in the (near) past by nudging slightly forward.
  const safeWhen = Math.max(when, Date.now() + 1000);
  chrome.alarms.create(name, { when: safeWhen });
}

/** Clear a routine's alarm. */
export async function clearRoutine(routineId: string): Promise<void> {
  await chrome.alarms.clear(alarmName(routineId));
}

/**
 * Rebuild all alarms from the given routines: clear every routine alarm, then
 * schedule the enabled ones. Used on install / startup (PLAN.md §5.4).
 */
export async function rehydrateAlarms(routines: Routine[], from: Date = new Date()): Promise<void> {
  const all = await chrome.alarms.getAll();
  await Promise.all(
    all
      .filter((a) => a.name.startsWith(ALARM_PREFIX))
      .map((a) => chrome.alarms.clear(a.name))
  );
  await Promise.all(routines.map((r) => scheduleRoutine(r, from)));
}
