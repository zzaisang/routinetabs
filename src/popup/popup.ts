// Popup logic (PLAN.md §7.1, M3).
// Shows routines with toggle + "Run now", links to Options for editing,
// shows plan badge, and gates "Add routine" behind the free limit.

import { getRoutines, upsertRoutine, onStateChanged } from '../lib/storage';
import { reschedule, clearAlarm, runNow } from '../lib/messaging';
import { isPaid, openPaymentPage, onPaidChanged } from '../lib/license';
import { formatNextRun, formatDays } from '../lib/format';
import { FREE_ROUTINE_LIMIT, type Routine } from '../lib/types';

const els = {
  list: document.getElementById('routine-list') as HTMLDivElement,
  empty: document.getElementById('empty-state') as HTMLDivElement,
  addBtn: document.getElementById('add-routine') as HTMLButtonElement,
  upgradeBtn: document.getElementById('upgrade') as HTMLButtonElement,
  badge: document.getElementById('plan-badge') as HTMLSpanElement,
  modal: document.getElementById('upgrade-modal') as HTMLDivElement,
  modalCancel: document.getElementById('modal-cancel') as HTMLButtonElement,
  modalUpgrade: document.getElementById('modal-upgrade') as HTMLButtonElement,
};

let paid = false;

async function refreshPlan(): Promise<void> {
  paid = await isPaid();
  els.badge.textContent = paid ? 'Pro' : 'Free';
  els.badge.className = paid ? 'badge badge-pro' : 'badge badge-free';
  els.upgradeBtn.hidden = paid;
}

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
  name.textContent = routine.name || 'Untitled routine';
  name.title = routine.name;

  const toggle = document.createElement('label');
  toggle.className = 'switch';
  toggle.title = routine.enabled ? 'Enabled' : 'Disabled';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = routine.enabled;
  input.setAttribute('aria-label', `Toggle ${routine.name}`);
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
  urlCount.textContent = `${routine.urls.length} tab${routine.urls.length === 1 ? '' : 's'}`;

  // Row 3: actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-ghost btn-sm';
  runBtn.textContent = '▶ Run now';
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    await runNow(routine.id);
    window.close();
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-sm';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openOptions(routine.id));

  actions.append(runBtn, editBtn);

  card.append(row1, meta, urlCount, actions);
  return card;
}

// ── Add routine gating ───────────────────────────────────────────────────────
async function handleAdd(): Promise<void> {
  const routines = await getRoutines();
  if (!paid && routines.length >= FREE_ROUTINE_LIMIT) {
    showUpgradeModal();
    return;
  }
  openOptions(); // new routine in options page
}

function showUpgradeModal(): void {
  els.modal.hidden = false;
}
function hideUpgradeModal(): void {
  els.modal.hidden = true;
}

// ── Wiring ───────────────────────────────────────────────────────────────────
els.addBtn.addEventListener('click', handleAdd);
els.upgradeBtn.addEventListener('click', () => void openPaymentPage());
els.modalCancel.addEventListener('click', hideUpgradeModal);
els.modalUpgrade.addEventListener('click', () => void openPaymentPage());
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) hideUpgradeModal();
});

onStateChanged((state) => render(state.routines));
onPaidChanged(() => void refreshPlan());

async function init(): Promise<void> {
  await refreshPlan();
  render(await getRoutines());
}

void init();
