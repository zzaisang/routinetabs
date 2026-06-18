// Popup logic.
// Shows routines with toggle + "Run now", links to Options for editing,
// and an optional GitHub Sponsors link. All features are free.

import { getRoutines, upsertRoutine, onStateChanged } from '../lib/storage';
import { reschedule, clearAlarm, runNow } from '../lib/messaging';
import { openSponsorPage } from '../lib/sponsor';
import { formatNextRun, formatDays } from '../lib/format';
import {
  initI18n,
  applyStaticI18n,
  setLanguage,
  otherLang,
  languageToggleLabel,
  t,
  tabCount,
} from '../lib/i18n';
import { type Routine } from '../lib/types';

const els = {
  list: document.getElementById('routine-list') as HTMLDivElement,
  empty: document.getElementById('empty-state') as HTMLDivElement,
  addBtn: document.getElementById('add-routine') as HTMLButtonElement,
  sponsorBtn: document.getElementById('sponsor') as HTMLButtonElement,
  langToggle: document.getElementById('lang-toggle') as HTMLButtonElement,
};

function openOptions(routineId?: string): void {
  const base = chrome.runtime.getURL('src/options/options.html');
  const url = routineId ? `${base}?id=${encodeURIComponent(routineId)}` : base;
  chrome.tabs.create({ url });
  window.close();
}

function render(routines: Routine[]): void {
  els.list.innerHTML = '';
  if (routines.length === 0) {
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;

  for (const routine of routines) {
    els.list.appendChild(renderCard(routine));
  }
}

function renderCard(routine: Routine): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  // Row 1: name + toggle
  const row1 = document.createElement('div');
  row1.className = 'card-row';

  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = routine.name || t('routine.untitled');
  name.title = routine.name;

  const toggle = document.createElement('label');
  toggle.className = 'switch';
  toggle.title = routine.enabled ? t('card.enabledTitle') : t('card.disabledTitle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = routine.enabled;
  input.setAttribute('aria-label', t('card.toggleAria', { name: routine.name }));
  const slider = document.createElement('span');
  slider.className = 'slider';
  toggle.append(input, slider);

  input.addEventListener('change', async () => {
    const updated = { ...routine, enabled: input.checked };
    await upsertRoutine(updated);
    // Toggle reliability: enable -> reschedule, disable -> clear alarm.
    if (updated.enabled) await reschedule(updated.id);
    else await clearAlarm(updated.id);
  });

  row1.append(name, toggle);

  // Row 2: meta
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const nextRun = document.createElement('span');
  nextRun.className = routine.enabled ? 'next-run' : 'next-run disabled';
  nextRun.textContent = formatNextRun(routine);
  const sep = document.createTextNode('  ·  ');
  const days = document.createElement('span');
  days.textContent = formatDays(routine.schedule.days);
  meta.append(nextRun, sep, days);

  const urlCount = document.createElement('div');
  urlCount.className = 'url-count';
  urlCount.textContent = tabCount(routine.urls.length);

  // Row 3: actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-ghost btn-sm';
  runBtn.textContent = t('card.runNow');
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    await runNow(routine.id);
    window.close();
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-sm';
  editBtn.textContent = t('card.edit');
  editBtn.addEventListener('click', () => openOptions(routine.id));

  actions.append(runBtn, editBtn);

  card.append(row1, meta, urlCount, actions);
  return card;
}

// ── Wiring ───────────────────────────────────────────────────────────────────
els.addBtn.addEventListener('click', () => openOptions()); // all features free, no gate
els.sponsorBtn.addEventListener('click', () => openSponsorPage());
els.langToggle.addEventListener('click', async () => {
  await setLanguage(otherLang());
  location.reload(); // simplest reliable re-render of static + dynamic strings
});

onStateChanged((state) => render(state.routines));

async function init(): Promise<void> {
  await initI18n();
  applyStaticI18n();
  els.langToggle.textContent = languageToggleLabel();
  render(await getRoutines());
}

void init();
