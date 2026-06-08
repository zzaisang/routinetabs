// chrome.storage.local wrapper + migration (PLAN.md §6).
// All persistence goes through here — UI/background never call chrome.storage directly.

import {
  type Routine,
  type Settings,
  type StorageShape,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
} from './types';

const ROOT_KEY = 'routinetabs';

function emptyState(): StorageShape {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    routines: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Migrate any older / partial persisted blob up to the current schema.
 * Kept defensive: missing fields are filled with safe defaults so a corrupt
 * or partially-written blob can never crash the worker.
 */
function migrate(raw: unknown): StorageShape {
  if (!raw || typeof raw !== 'object') return emptyState();
  const obj = raw as Partial<StorageShape>;

  const routines: Routine[] = Array.isArray(obj.routines)
    ? obj.routines.map(normalizeRoutine).filter((r): r is Routine => r !== null)
    : [];

  const settings: Settings = {
    catchUpEnabled:
      typeof obj.settings?.catchUpEnabled === 'boolean'
        ? obj.settings.catchUpEnabled
        : DEFAULT_SETTINGS.catchUpEnabled,
    catchUpGraceMinutes:
      typeof obj.settings?.catchUpGraceMinutes === 'number' &&
      obj.settings.catchUpGraceMinutes >= 0
        ? obj.settings.catchUpGraceMinutes
        : DEFAULT_SETTINGS.catchUpGraceMinutes,
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    routines,
    settings,
  };
}

function normalizeRoutine(raw: unknown): Routine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Routine>;
  if (typeof r.id !== 'string') return null;
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Untitled routine',
    urls: Array.isArray(r.urls) ? r.urls.filter((u) => typeof u === 'string') : [],
    schedule: {
      days: Array.isArray(r.schedule?.days)
        ? r.schedule!.days.filter((d) => typeof d === 'number')
        : [],
      time: typeof r.schedule?.time === 'string' ? r.schedule!.time : '09:00',
    },
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    openInNewWindow:
      typeof r.openInNewWindow === 'boolean' ? r.openInNewWindow : false,
    lastRunAt: typeof r.lastRunAt === 'number' ? r.lastRunAt : null,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  };
}

/** Read the whole state, migrating as needed. */
export async function getState(): Promise<StorageShape> {
  const result = await chrome.storage.local.get(ROOT_KEY);
  return migrate(result[ROOT_KEY]);
}

/** Persist the whole state. */
export async function setState(state: StorageShape): Promise<void> {
  await chrome.storage.local.set({ [ROOT_KEY]: state });
}

export async function getRoutines(): Promise<Routine[]> {
  return (await getState()).routines;
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
  return (await getState()).routines.find((r) => r.id === id);
}

export async function getSettings(): Promise<Settings> {
  return (await getState()).settings;
}

export async function setSettings(settings: Settings): Promise<void> {
  const state = await getState();
  state.settings = settings;
  await setState(state);
}

/** Insert or update a routine by id. */
export async function upsertRoutine(routine: Routine): Promise<void> {
  const state = await getState();
  const idx = state.routines.findIndex((r) => r.id === routine.id);
  if (idx >= 0) state.routines[idx] = routine;
  else state.routines.push(routine);
  await setState(state);
}

export async function deleteRoutine(id: string): Promise<void> {
  const state = await getState();
  state.routines = state.routines.filter((r) => r.id !== id);
  await setState(state);
}

/** Update just lastRunAt for a routine (atomic-ish read/modify/write). */
export async function markRoutineRun(id: string, when: number): Promise<void> {
  const state = await getState();
  const r = state.routines.find((x) => x.id === id);
  if (r) {
    r.lastRunAt = when;
    await setState(state);
  }
}

/** Subscribe to storage changes (for live-updating UIs). Returns an unsubscribe fn. */
export function onStateChanged(cb: (state: StorageShape) => void): () => void {
  const listener = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: string
  ) => {
    if (area === 'local' && ROOT_KEY in changes) {
      cb(migrate(changes[ROOT_KEY].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
