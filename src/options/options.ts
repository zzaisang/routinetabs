// Options page logic (PLAN.md §7.2, M1).
// Routine CRUD, global catch-up settings, and a GitHub Sponsors link.
// All features are free — there is no paywall.

import {
  getState,
  getRoutines,
  getRoutine,
  upsertRoutine,
  deleteRoutine,
  getSettings,
  setSettings,
} from '../lib/storage';
import { reschedule, clearAlarm } from '../lib/messaging';
import { openSponsorPage } from '../lib/sponsor';
import { normalizeUrlList, linesToArray } from '../lib/url';
import { formatDays, formatNextRun } from '../lib/format';
import {
  initI18n,
  applyStaticI18n,
  setLanguage,
  otherLang,
  languageToggleLabel,
  shortDay,
  tabCount,
  t,
} from '../lib/i18n';
import { type Routine, type Settings } from '../lib/types';

const els = {
  langToggle: document.getElementById('lang-toggle') as HTMLButtonElement,
  list: document.getElementById('routine-list') as HTMLDivElement,
  listEmpty: document.getElementById('list-empty') as HTMLParagraphElement,
  newBtn: document.getElementById('new-routine') as HTMLButtonElement,

  editor: document.getElementById('editor') as HTMLElement,
  editorTitle: document.getElementById('editor-title') as HTMLHeadingElement,
  fName: document.getElementById('f-name') as HTMLInputElement,
  fUrls: document.getElementById('f-urls') as HTMLTextAreaElement,
  fDays: document.getElementById('f-days') as HTMLDivElement,
  fTime: document.getElementById('f-time') as HTMLInputElement,
  fNewWindow: document.getElementById('f-newwindow') as HTMLInputElement,
  fEnabled: document.getElementById('f-enabled') as HTMLInputElement,
  urlErrors: document.getElementById('url-errors') as HTMLSpanElement,
  saveBtn: document.getElementById('editor-save') as HTMLButtonElement,
  cancelBtn: document.getElementById('editor-cancel') as HTMLButtonElement,
  deleteBtn: document.getElementById('editor-delete') as HTMLButtonElement,

  sCatchup: document.getElementById('s-catchup') as HTMLInputElement,
  sGrace: document.getElementById('s-grace') as HTMLInputElement,
  saveSettingsBtn: document.getElementById('save-settings') as HTMLButtonElement,
  settingsSaved: document.getElementById('settings-saved') as HTMLSpanElement,

  sponsorBtn: document.getElementById('sponsor') as HTMLButtonElement,
};

let editingId: string | null = null; // null => creating new

// ── Day chips ────────────────────────────────────────────────────────────────
function buildDayChips(): void {
  els.fDays.innerHTML = '';
  for (let d = 0; d < 7; d++) {
    const chip = document.createElement('label');
    chip.className = 'day-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(d);
    input.addEventListener('change', () => {
      chip.classList.toggle('checked', input.checked);
    });
    const span = document.createElement('span');
    span.textContent = shortDay(d);
    chip.append(input, span);
    els.fDays.appendChild(chip);
  }
}

function getSelectedDays(): number[] {
  return Array.from(els.fDays.querySelectorAll<HTMLInputElement>('input:checked')).map(
    (i) => Number(i.value)
  );
}

function setSelectedDays(days: number[]): void {
  const set = new Set(days);
  els.fDays.querySelectorAll<HTMLInputElement>('input').forEach((i) => {
    const checked = set.has(Number(i.value));
    i.checked = checked;
    (i.closest('.day-chip') as HTMLElement).classList.toggle('checked', checked);
  });
}

// ── List ─────────────────────────────────────────────────────────────────────
async function renderList(): Promise<void> {
  const routines = await getRoutines();
  els.list.innerHTML = '';
  els.listEmpty.hidden = routines.length > 0;

  for (const routine of routines) {
    els.list.appendChild(renderListItem(routine));
  }
}

function renderListItem(routine: Routine): HTMLElement {
  const item = document.createElement('div');
  item.className = 'routine-item' + (routine.enabled ? '' : ' disabled');

  const main = document.createElement('div');
  main.className = 'ri-main';
  const name = document.createElement('div');
  name.className = 'ri-name';
  name.textContent = routine.name || t('routine.untitled');
  const meta = document.createElement('div');
  meta.className = 'ri-meta';
  meta.textContent = `${formatDays(routine.schedule.days)} · ${routine.schedule.time} · ${tabCount(routine.urls.length)} · ${formatNextRun(routine)}`;
  main.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'ri-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-sm';
  editBtn.textContent = t('card.edit');
  editBtn.addEventListener('click', () => void openEditor(routine.id));
  actions.append(editBtn);

  item.append(main, actions);
  return item;
}

// ── Editor ───────────────────────────────────────────────────────────────────
async function openEditor(id: string | null): Promise<void> {
  editingId = id;
  els.urlErrors.hidden = true;
  els.urlErrors.textContent = '';

  if (id) {
    const r = await getRoutine(id);
    if (!r) return;
    els.editorTitle.textContent = t('editor.titleEdit');
    els.fName.value = r.name;
    els.fUrls.value = r.urls.join('\n');
    setSelectedDays(r.schedule.days);
    els.fTime.value = r.schedule.time || '09:00';
    els.fNewWindow.checked = r.openInNewWindow;
    els.fEnabled.checked = r.enabled;
    els.deleteBtn.hidden = false;
  } else {
    els.editorTitle.textContent = t('editor.titleNew');
    els.fName.value = '';
    els.fUrls.value = '';
    setSelectedDays([1, 2, 3, 4, 5]); // default weekdays
    els.fTime.value = '09:00';
    els.fNewWindow.checked = false;
    els.fEnabled.checked = true;
    els.deleteBtn.hidden = true;
  }

  els.editor.hidden = false;
  els.editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  els.fName.focus();
}

function closeEditor(): void {
  els.editor.hidden = true;
  editingId = null;
}

async function saveEditor(): Promise<void> {
  const name = els.fName.value.trim() || t('routine.untitled');
  const rawUrls = linesToArray(els.fUrls.value);
  const { valid, invalid } = normalizeUrlList(rawUrls);
  const days = getSelectedDays();
  const time = els.fTime.value || '09:00';

  // Validation
  const errors: string[] = [];
  if (valid.length === 0) errors.push(t('error.noValidUrl'));
  if (invalid.length > 0) {
    errors.push(t('error.invalidUrls', { list: invalid.join(', ') }));
  }
  if (days.length === 0) errors.push(t('error.noDays'));

  if (errors.length > 0) {
    els.urlErrors.textContent = errors.join('\n');
    els.urlErrors.hidden = false;
    return;
  }
  els.urlErrors.hidden = true;

  const existing = editingId ? await getRoutine(editingId) : undefined;
  const routine: Routine = {
    id: editingId ?? crypto.randomUUID(),
    name,
    urls: valid,
    schedule: { days, time },
    enabled: els.fEnabled.checked,
    openInNewWindow: els.fNewWindow.checked,
    lastRunAt: existing?.lastRunAt ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  };

  await upsertRoutine(routine);

  // Reschedule / clear alarm to reflect changes.
  if (routine.enabled) await reschedule(routine.id);
  else await clearAlarm(routine.id);

  closeEditor();
  await renderList();
}

async function handleDelete(): Promise<void> {
  if (!editingId) return;
  const r = await getRoutine(editingId);
  const name = r?.name || t('confirm.thisRoutine');
  if (!confirm(t('confirm.delete', { name }))) return;
  await clearAlarm(editingId);
  await deleteRoutine(editingId);
  closeEditor();
  await renderList();
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings(): Promise<void> {
  const s = await getSettings();
  els.sCatchup.checked = s.catchUpEnabled;
  els.sGrace.value = String(s.catchUpGraceMinutes);
}

async function saveSettingsHandler(): Promise<void> {
  const grace = Math.max(0, Math.min(1440, Number(els.sGrace.value) || 0));
  els.sGrace.value = String(grace);
  const current = await getSettings(); // preserve fields we don't edit here (language)
  const settings: Settings = {
    ...current,
    catchUpEnabled: els.sCatchup.checked,
    catchUpGraceMinutes: grace,
  };
  await setSettings(settings);
  els.settingsSaved.hidden = false;
  setTimeout(() => (els.settingsSaved.hidden = true), 1500);
}

// ── Wiring ───────────────────────────────────────────────────────────────────
els.newBtn.addEventListener('click', () => void openEditor(null));
els.saveBtn.addEventListener('click', () => void saveEditor());
els.cancelBtn.addEventListener('click', closeEditor);
els.deleteBtn.addEventListener('click', () => void handleDelete());
els.saveSettingsBtn.addEventListener('click', () => void saveSettingsHandler());
els.sponsorBtn.addEventListener('click', () => openSponsorPage());
els.langToggle.addEventListener('click', async () => {
  await setLanguage(otherLang());
  location.reload(); // simplest reliable re-render of static + dynamic strings
});

async function init(): Promise<void> {
  await initI18n();
  applyStaticI18n();
  document.title = t('options.docTitle');
  els.langToggle.textContent = languageToggleLabel();
  buildDayChips();
  await loadSettings();
  await renderList();

  // Deep-link: ?id=<routineId> opens that routine in the editor; ?new opens a new one.
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) {
    await openEditor(id);
  } else if (params.has('new')) {
    await openEditor(null);
  } else {
    // If no routines exist, default to the new-routine editor for a smooth start.
    const state = await getState();
    if (state.routines.length === 0) {
      // leave editor closed but ready; user clicks "New routine".
    }
  }
}

void init();
