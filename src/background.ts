// RoutineTabs service worker (PLAN.md §5 — the reliability core).
//
// HARD RULES (do not break these — they are why this product wins):
//  - NO setTimeout / setInterval. The MV3 worker is evicted when idle; timers die.
//    We use chrome.alarms exclusively.
//  - Listeners are registered SYNCHRONOUSLY at module top level so the worker can
//    be woken by an event with the handler already attached.
//  - Self-rescheduling one-shot alarms (DST-safe): on fire, recompute next local
//    wall-clock occurrence and create a fresh alarm.
//  - On every fire, RE-READ `enabled` from storage before opening tabs. This is
//    the toggle bug the #1 competitor cannot fix.
//  - onInstalled / onStartup: rehydrate alarms + run missed-occurrence catch-up.

import {
  getState,
  getRoutine,
  markRoutineRun,
} from './lib/storage';
import {
  scheduleRoutine,
  clearRoutine,
  rehydrateAlarms,
  routineIdFromAlarm,
} from './lib/alarms';
import { openRoutineTabs } from './lib/tabs';
import { getMissedOccurrence } from './lib/schedule';
import type { Routine } from './lib/types';

// ── Synchronous top-level listener registration ──────────────────────────────
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.runtime.onStartup.addListener(onStartup);
chrome.runtime.onMessage.addListener(handleMessage);

// ── Handlers ─────────────────────────────────────────────────────────────────

async function onInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
  console.info('[RoutineTabs] onInstalled', details.reason);
  await rebuildAndCatchUp();
}

async function onStartup(): Promise<void> {
  console.info('[RoutineTabs] onStartup');
  await rebuildAndCatchUp();
}

/** Idempotent warm-up used on cold worker starts. */
let warmedThisSession = false;
async function warmUp(): Promise<void> {
  if (warmedThisSession) return;
  warmedThisSession = true;
  await rebuildAndCatchUp();
}

/**
 * Rehydrate all alarms from storage and catch up any occurrences missed while the
 * browser/worker was down (PLAN.md §5.4 / §5.5).
 */
async function rebuildAndCatchUp(): Promise<void> {
  const state = await getState();
  const now = new Date();

  // 1) Catch-up missed runs first (before rescheduling, so lastRunAt is fresh).
  for (const routine of state.routines) {
    if (!routine.enabled) continue;
    const decision = getMissedOccurrence(
      routine.schedule,
      routine.lastRunAt,
      now,
      {
        catchUpEnabled: state.settings.catchUpEnabled,
        catchUpGraceMinutes: state.settings.catchUpGraceMinutes,
      }
    );
    if (decision.shouldRun && decision.occurrence != null) {
      console.info('[RoutineTabs] catch-up firing', routine.id);
      await runRoutine(routine, decision.occurrence);
    }
  }

  // 2) (Re)schedule future alarms for all enabled routines.
  const fresh = await getState(); // re-read in case catch-up updated lastRunAt
  await rehydrateAlarms(fresh.routines, new Date());
}

/**
 * Alarm fired. The toggle-bug fix lives here: we re-read the routine from storage
 * and bail if it is no longer enabled, then self-reschedule.
 */
async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const routineId = routineIdFromAlarm(alarm.name);
  if (!routineId) return;

  // Re-read from storage — DO NOT trust any cached enabled flag.
  const routine = await getRoutine(routineId);
  if (!routine) {
    // Routine was deleted; make sure no alarm lingers.
    await clearRoutine(routineId);
    return;
  }

  if (routine.enabled) {
    await runRoutine(routine, Date.now());
  }

  // Always self-reschedule for the next occurrence (even if we just ran). If the
  // routine is disabled, scheduleRoutine() clears the alarm instead.
  // Re-read once more so a toggle during firing is respected.
  const latest = await getRoutine(routineId);
  if (latest) {
    // Advance the reference time past the current minute so we never re-pick the
    // occurrence we just fired (guards against an alarm that fires a hair early).
    const rescheduleFrom = new Date(Date.now() + 60_000);
    await scheduleRoutine(latest, rescheduleFrom);
  } else {
    await clearRoutine(routineId);
  }
}

/** Open the routine's tabs and record lastRunAt. */
async function runRoutine(routine: Routine, when: number): Promise<void> {
  await openRoutineTabs(routine);
  await markRoutineRun(routine.id, when);
}

// ── Messaging (popup / options -> background) ────────────────────────────────
// The popup/options pages drive scheduling through these messages so all alarm
// logic stays in one place.

type Message =
  | { type: 'reschedule'; routineId: string }
  | { type: 'clear'; routineId: string }
  | { type: 'rehydrateAll' }
  | { type: 'runNow'; routineId: string };

function handleMessage(
  msg: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (res: { ok: boolean; error?: string }) => void
): boolean {
  (async () => {
    try {
      switch (msg.type) {
        case 'reschedule': {
          const r = await getRoutine(msg.routineId);
          if (r) await scheduleRoutine(r, new Date());
          else await clearRoutine(msg.routineId);
          break;
        }
        case 'clear':
          await clearRoutine(msg.routineId);
          break;
        case 'rehydrateAll': {
          const state = await getState();
          await rehydrateAlarms(state.routines, new Date());
          break;
        }
        case 'runNow': {
          const r = await getRoutine(msg.routineId);
          if (r) await runRoutine(r, Date.now());
          break;
        }
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  // Return true to keep the message channel open for the async response.
  return true;
}

// ── Cold-start warm path ─────────────────────────────────────────────────────
// Best-effort: when the worker spins up for any reason, ensure alarms exist and
// catch up missed runs. Invoked at the very bottom so all module-level bindings
// (e.g. `warmedThisSession`) are initialized first — calling it earlier hits a
// TDZ ReferenceError ("Cannot access ... before initialization") on cold start.
warmUp().catch((e) => console.error('[RoutineTabs] warmUp failed', e));
