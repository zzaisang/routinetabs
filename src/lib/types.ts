// Data model for RoutineTabs (see PLAN.md §6).
// All persisted shapes live here so storage + UI + background agree on one source of truth.

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun ... 6=Sat

export interface RoutineSchedule {
  /** Days of week the routine fires on. 0=Sun ... 6=Sat. May be empty (= never). */
  days: number[];
  /** Local wall-clock time, "HH:MM" 24h. */
  time: string;
}

export interface Routine {
  id: string; // crypto.randomUUID()
  name: string;
  urls: string[]; // normalized absolute http/https URLs
  schedule: RoutineSchedule;
  enabled: boolean;
  openInNewWindow: boolean; // per-routine: new window vs new tabs in current window
  lastRunAt: number | null; // epoch ms of the last successful firing
  createdAt: number; // epoch ms
}

export interface Settings {
  catchUpEnabled: boolean; // default true
  catchUpGraceMinutes: number; // default 120
}

export interface StorageShape {
  schemaVersion: number; // migration marker, starts at 1
  routines: Routine[];
  settings: Settings;
  // license is queried at runtime from ExtensionPay (may be cached).
}

export const FREE_ROUTINE_LIMIT = 1;

export const DEFAULT_SETTINGS: Settings = {
  catchUpEnabled: true,
  catchUpGraceMinutes: 120,
};

export const CURRENT_SCHEMA_VERSION = 1;
