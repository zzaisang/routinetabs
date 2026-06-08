import { describe, it, expect } from 'vitest';
import {
  parseTime,
  nextOccurrence,
  previousOccurrence,
  getMissedOccurrence,
} from '../src/lib/schedule';
import type { RoutineSchedule } from '../src/lib/types';

// NOTE on timezone determinism (PLAN.md §10):
// We construct the `from`/`now` Date with `new Date(year, month, day, hh, mm)`,
// i.e. the *local-time* constructor — the same constructor the engine uses.
// This makes the tests pass regardless of which timezone CI runs in, because
// both the input and the engine agree on "the host's local wall clock".
//
// For the DST-specific tests we additionally assert the *wall-clock* fields of
// the resulting timestamp (getHours()/getMinutes()), which is the property the
// product actually promises: "the time the user sees is preserved."

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;

function sched(days: number[], time: string): RoutineSchedule {
  return { days, time };
}

describe('parseTime', () => {
  it('parses valid HH:MM', () => {
    expect(parseTime('09:00')).toEqual({ hours: 9, minutes: 0 });
    expect(parseTime('9:05')).toEqual({ hours: 9, minutes: 5 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('rejects malformed times', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('9')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime('aa:bb')).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('today scheduled day + time NOT yet passed -> today', () => {
    // 2026-06-08 is a Monday. from = Mon 08:00, schedule Mon 09:00.
    const from = new Date(2026, 5, 8, 8, 0);
    const next = nextOccurrence(sched([MON], '09:00'), from);
    expect(next).not.toBeNull();
    const d = new Date(next!);
    expect(d.getDay()).toBe(MON);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(8); // same day
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('today scheduled day + time already passed -> next scheduled day (next week same weekday)', () => {
    // from = Mon 10:00, schedule Mon 09:00 -> next Monday.
    const from = new Date(2026, 5, 8, 10, 0);
    const next = nextOccurrence(sched([MON], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(MON);
    expect(d.getDate()).toBe(15); // 7 days later
    expect(d.getHours()).toBe(9);
  });

  it('exact same instant -> returns now (inclusive)', () => {
    const from = new Date(2026, 5, 8, 9, 0);
    const next = nextOccurrence(sched([MON], '09:00'), from);
    expect(next).toBe(from.getTime());
  });

  it('picks the soonest among multiple days', () => {
    // from = Mon 10:00. Schedule Mon, Wed, Fri @ 09:00.
    // Mon 09:00 passed -> next should be Wed (2026-06-10) 09:00.
    const from = new Date(2026, 5, 8, 10, 0);
    const next = nextOccurrence(sched([MON, WED, FRI], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(WED);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(9);
  });

  it('picks today when today is the soonest among multiple days and time not passed', () => {
    const from = new Date(2026, 5, 8, 7, 0); // Mon 07:00
    const next = nextOccurrence(sched([MON, WED, FRI], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(MON);
    expect(d.getDate()).toBe(8);
  });

  it('wraps across the week boundary (Sat -> Sun)', () => {
    // 2026-06-13 is Saturday. from = Sat 12:00. Schedule Sun @ 08:00 -> next day.
    const from = new Date(2026, 5, 13, 12, 0);
    const next = nextOccurrence(sched([SUN], '08:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(SUN);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(8);
  });

  it('returns null for empty days', () => {
    expect(nextOccurrence(sched([], '09:00'), new Date(2026, 5, 8, 8, 0))).toBeNull();
  });

  it('returns null for malformed time', () => {
    expect(nextOccurrence(sched([MON], '99:99'), new Date(2026, 5, 8, 8, 0))).toBeNull();
  });

  it('ignores invalid day numbers', () => {
    // Only TUE is valid; from Mon 08:00 -> Tue 09:00.
    const from = new Date(2026, 5, 8, 8, 0);
    const next = nextOccurrence(sched([TUE, 9, -1, 99], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(TUE);
    expect(d.getDate()).toBe(9);
  });

  it('every-day schedule fires today if time not passed', () => {
    const from = new Date(2026, 5, 8, 8, 0);
    const next = nextOccurrence(
      sched([SUN, MON, TUE, WED, THU, FRI, SAT], '09:00'),
      from
    );
    const d = new Date(next!);
    expect(d.getDate()).toBe(8);
  });
});

// ---- DST tests ----
// These assert the *wall-clock time the user sees* is preserved across DST.
// US DST 2026: spring forward Sun 2026-03-08 02:00 -> 03:00.
//              fall back     Sun 2026-11-01 02:00 -> 01:00.
// We use the host local timezone via local-constructor; the invariant we test
// (getHours()/getMinutes() == scheduled) holds in any timezone, including ones
// without DST, which is exactly the product guarantee.
describe('nextOccurrence — DST safety', () => {
  it('preserves wall-clock time across the spring-forward weekend', () => {
    // Friday 2026-03-06, schedule Mon @ 09:00. Next Monday is 2026-03-09,
    // i.e. the day after spring-forward Sunday.
    const from = new Date(2026, 2, 6, 12, 0); // Fri
    const next = nextOccurrence(sched([MON], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(MON);
    expect(d.getDate()).toBe(9);
    // The promise: user still gets exactly 09:00 local, not 08:00 or 10:00.
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('preserves wall-clock time across the fall-back weekend', () => {
    // Friday 2026-10-30, schedule Mon @ 09:00. Next Monday is 2026-11-02,
    // i.e. the day after fall-back Sunday.
    const from = new Date(2026, 9, 30, 12, 0); // Fri
    const next = nextOccurrence(sched([MON], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(MON);
    expect(d.getDate()).toBe(2);
    expect(d.getMonth()).toBe(10); // November
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('scheduling onto the DST transition day itself preserves wall-clock 09:00', () => {
    // Spring-forward Sunday 2026-03-08. Saturday from, schedule Sun @ 09:00.
    // 09:00 is after the 02:00->03:00 jump, so it is a valid wall-clock instant.
    const from = new Date(2026, 2, 7, 12, 0); // Sat
    const next = nextOccurrence(sched([SUN], '09:00'), from);
    const d = new Date(next!);
    expect(d.getDay()).toBe(SUN);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('previousOccurrence', () => {
  it('returns the most recent past occurrence', () => {
    // from = Mon 10:00, schedule Mon @ 09:00 -> today 09:00.
    const from = new Date(2026, 5, 8, 10, 0);
    const prev = previousOccurrence(sched([MON], '09:00'), from);
    const d = new Date(prev!);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(9);
  });

  it('looks back across days when today not yet occurred', () => {
    // from = Mon 08:00 (before 09:00). schedule Mon @ 09:00.
    // Most recent past occurrence is the previous Monday 2026-06-01.
    const from = new Date(2026, 5, 8, 8, 0);
    const prev = previousOccurrence(sched([MON], '09:00'), from);
    const d = new Date(prev!);
    expect(d.getDay()).toBe(MON);
    expect(d.getDate()).toBe(1);
  });

  it('returns null for empty days', () => {
    expect(previousOccurrence(sched([], '09:00'), new Date(2026, 5, 8, 10, 0))).toBeNull();
  });
});

describe('getMissedOccurrence (catch-up)', () => {
  const opts = { catchUpEnabled: true, catchUpGraceMinutes: 120 };

  it('catches up a missed occurrence within grace window', () => {
    // schedule Mon @ 09:00, now Mon 10:00 (60 min later), never ran.
    const now = new Date(2026, 5, 8, 10, 0);
    const r = getMissedOccurrence(sched([MON], '09:00'), null, now, opts);
    expect(r.shouldRun).toBe(true);
    expect(new Date(r.occurrence!).getHours()).toBe(9);
  });

  it('does NOT catch up when beyond grace window (too old)', () => {
    // schedule Mon @ 09:00, now Mon 14:00 (300 min later) > 120 grace.
    const now = new Date(2026, 5, 8, 14, 0);
    const r = getMissedOccurrence(sched([MON], '09:00'), null, now, opts);
    expect(r.shouldRun).toBe(false);
    // The occurrence is still reported (today 09:00) but not run.
    expect(r.occurrence).not.toBeNull();
  });

  it('does NOT catch up when already run', () => {
    // schedule Mon @ 09:00, now Mon 10:00, lastRunAt = today 09:00.
    const now = new Date(2026, 5, 8, 10, 0);
    const lastRun = new Date(2026, 5, 8, 9, 0).getTime();
    const r = getMissedOccurrence(sched([MON], '09:00'), lastRun, now, opts);
    expect(r.shouldRun).toBe(false);
  });

  it('does NOT catch up when lastRunAt is after the occurrence', () => {
    const now = new Date(2026, 5, 8, 10, 0);
    const lastRun = new Date(2026, 5, 8, 9, 30).getTime();
    const r = getMissedOccurrence(sched([MON], '09:00'), lastRun, now, opts);
    expect(r.shouldRun).toBe(false);
  });

  it('catches up when lastRunAt is from a PREVIOUS occurrence', () => {
    // now Mon 10:00, occurrence today 09:00, lastRun = last week.
    const now = new Date(2026, 5, 8, 10, 0);
    const lastRun = new Date(2026, 5, 1, 9, 0).getTime();
    const r = getMissedOccurrence(sched([MON], '09:00'), lastRun, now, opts);
    expect(r.shouldRun).toBe(true);
  });

  it('respects catchUpEnabled=false', () => {
    const now = new Date(2026, 5, 8, 10, 0);
    const r = getMissedOccurrence(sched([MON], '09:00'), null, now, {
      catchUpEnabled: false,
      catchUpGraceMinutes: 120,
    });
    expect(r.shouldRun).toBe(false);
  });

  it('grace boundary is inclusive (exactly == grace -> run)', () => {
    // occurrence Mon 09:00, now Mon 11:00 exactly 120 min later.
    const now = new Date(2026, 5, 8, 11, 0);
    const r = getMissedOccurrence(sched([MON], '09:00'), null, now, opts);
    expect(r.shouldRun).toBe(true);
  });

  it('just past grace boundary -> no run', () => {
    // occurrence Mon 09:00, now Mon 11:01 (121 min later).
    const now = new Date(2026, 5, 8, 11, 1);
    const r = getMissedOccurrence(sched([MON], '09:00'), null, now, opts);
    expect(r.shouldRun).toBe(false);
  });
});
