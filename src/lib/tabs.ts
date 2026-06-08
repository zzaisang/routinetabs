// Opening tab sets (PLAN.md §5.1).
//
// IMPORTANT: chrome.tabs.create({ url }) does NOT require the "tabs" permission.
// We only ever *create* tabs; we never read tab url/title, so no permission needed.

import type { Routine } from './types';

/**
 * Open all URLs of a routine, either as new tabs in the current window or in a
 * brand new window. Errors on individual URLs are swallowed so one bad URL can't
 * block the rest (reliability over strictness).
 */
export async function openRoutineTabs(routine: Routine): Promise<void> {
  const urls = routine.urls.filter((u) => typeof u === 'string' && u.length > 0);
  if (urls.length === 0) return;

  if (routine.openInNewWindow) {
    try {
      // chrome.windows.create accepts an array of URLs and opens them in one window.
      await chrome.windows.create({ url: urls, focused: true });
      return;
    } catch (e) {
      // Fall back to creating tabs individually if window creation fails.
      console.warn('[RoutineTabs] windows.create failed, falling back to tabs', e);
    }
  }

  // New tabs in the current window. First tab active, the rest in background to
  // avoid stealing focus repeatedly.
  for (let i = 0; i < urls.length; i++) {
    try {
      await chrome.tabs.create({ url: urls[i], active: i === 0 });
    } catch (e) {
      console.warn('[RoutineTabs] failed to open', urls[i], e);
    }
  }
}
