// Dictionary-based i18n with a runtime, user-toggleable language (EN ⇄ KO).
//
// Why not chrome.i18n / _locales? That is locked to the browser UI locale and
// cannot be switched in-app at runtime. The user wants an in-app toggle, so we
// keep a small dictionary here and persist the choice in settings.language.

import { getState, setState } from './storage';
import type { Language } from './types';

type Dict = Record<string, string>;

// Module-level current language. Set by initI18n() before any rendering.
let currentLang: Language = 'en';

export function getCurrentLang(): Language {
  return currentLang;
}

/** Load the persisted language into module state. Call once before rendering. */
export async function initI18n(): Promise<Language> {
  const state = await getState();
  currentLang = state.settings.language;
  return currentLang;
}

/** Persist + apply a new language. Caller typically reloads the view afterwards. */
export async function setLanguage(lang: Language): Promise<void> {
  const state = await getState();
  state.settings.language = lang;
  await setState(state);
  currentLang = lang;
}

/** Translate a key for the current language, with optional {param} interpolation. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = MESSAGES[currentLang] ?? MESSAGES.en;
  let out = dict[key] ?? MESSAGES.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

/** Short weekday label (0=Sun..6=Sat) for the current language. */
export function shortDay(d: number): string {
  return t(`day.${d}`);
}

/** Tab-count phrase, respecting plural rules per language. */
export function tabCount(n: number): string {
  if (currentLang === 'ko') return `탭 ${n}개`;
  return n === 1 ? '1 tab' : `${n} tabs`;
}

/** Locale tag for Intl/toLocale* formatting. */
export function localeTag(): string {
  return currentLang === 'ko' ? 'ko-KR' : 'en-US';
}

/**
 * Apply translations to static DOM nodes:
 *   data-i18n           -> textContent
 *   data-i18n-html      -> innerHTML (for strings with inline markup)
 *   data-i18n-placeholder -> placeholder attribute
 *   data-i18n-title     -> title attribute
 */
export function applyStaticI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    (el as HTMLInputElement | HTMLTextAreaElement).placeholder = t(
      el.dataset.i18nPlaceholder!
    );
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
}

/** Label for the language-toggle button: shows the language you'd switch TO. */
export function languageToggleLabel(): string {
  return currentLang === 'en' ? '🌐 한국어' : '🌐 English';
}

/** The language the toggle switches to. */
export function otherLang(): Language {
  return currentLang === 'en' ? 'ko' : 'en';
}

// ── Messages ──────────────────────────────────────────────────────────────────
const MESSAGES: Record<Language, Dict> = {
  en: {
    // Shared
    'routine.untitled': 'Untitled routine',

    // Days
    'day.0': 'Sun',
    'day.1': 'Mon',
    'day.2': 'Tue',
    'day.3': 'Wed',
    'day.4': 'Thu',
    'day.5': 'Fri',
    'day.6': 'Sat',
    'days.none': 'No days set',
    'days.every': 'Every day',
    'days.weekdays': 'Weekdays',
    'days.weekends': 'Weekends',

    // Next-run
    'next.disabled': 'Disabled',
    'next.notScheduled': 'Not scheduled',
    'next.today': 'Today at {time}',
    'next.tomorrow': 'Tomorrow at {time}',
    'next.onDay': '{day} at {time}',

    // Popup
    'popup.empty.title': 'No routines yet',
    'popup.empty.sub':
      'Create your first routine to open your daily tabs automatically.',
    'popup.add': '＋ Add routine',
    'popup.sponsor': '❤️ Sponsor',
    'card.runNow': '▶ Run now',
    'card.edit': 'Edit',
    'card.enabledTitle': 'Enabled',
    'card.disabledTitle': 'Disabled',
    'card.toggleAria': 'Toggle {name}',

    // Options
    'options.docTitle': 'RoutineTabs — Settings',
    'options.tagline': 'It just works. Open your daily tabs, on schedule.',
    'options.routines': 'Routines',
    'options.newRoutine': '＋ New routine',
    'options.listEmpty': 'No routines yet. Create one above.',

    // Editor
    'editor.titleEdit': 'Edit routine',
    'editor.titleNew': 'New routine',
    'field.name': 'Name',
    'field.name.ph': 'Morning work tabs',
    'field.urls': 'URLs (one per line)',
    'field.urls.hint': 'http/https only. A scheme will be added if you omit it.',
    'field.days': 'Days',
    'field.time': 'Time (local)',
    'field.newWindow': 'Open in a new window',
    'field.enabled': 'Enabled',
    'editor.delete': 'Delete',
    'editor.cancel': 'Cancel',
    'editor.save': 'Save',

    // Catch-up settings
    'catchup.title': 'Catch-up',
    'catchup.desc':
      'If your browser was closed during a scheduled time, RoutineTabs can run the missed routine when you reopen Chrome (within a grace window).',
    'catchup.enable': 'Enable catch-up for missed runs',
    'catchup.grace': 'Grace window (minutes)',
    'catchup.graceHint':
      "Missed runs older than this are ignored (so yesterday's tabs don't open today).",
    'catchup.save': 'Save settings',
    'catchup.saved': 'Saved ✓',

    // Support section
    'support.title': 'Support',
    'support.body':
      'RoutineTabs is <strong>free</strong>, with all features unlocked. If it saves you time, you can support development through <strong>GitHub Sponsors</strong> — entirely optional, no features are locked behind it.',
    'support.button': '❤️ Sponsor on GitHub',
    'options.footer':
      'Minimal permissions — RoutineTabs never reads your browsing data.',

    // Validation / confirm
    'error.noValidUrl': 'Add at least one valid http/https URL.',
    'error.invalidUrls': 'Invalid URL(s): {list}',
    'error.noDays': 'Select at least one day.',
    'confirm.delete': 'Delete "{name}"? This cannot be undone.',
    'confirm.thisRoutine': 'this routine',
  },

  ko: {
    // Shared
    'routine.untitled': '이름 없는 루틴',

    // Days
    'day.0': '일',
    'day.1': '월',
    'day.2': '화',
    'day.3': '수',
    'day.4': '목',
    'day.5': '금',
    'day.6': '토',
    'days.none': '요일 미설정',
    'days.every': '매일',
    'days.weekdays': '평일',
    'days.weekends': '주말',

    // Next-run
    'next.disabled': '꺼짐',
    'next.notScheduled': '예약 없음',
    'next.today': '오늘 {time}',
    'next.tomorrow': '내일 {time}',
    'next.onDay': '{day} {time}',

    // Popup
    'popup.empty.title': '아직 루틴이 없습니다',
    'popup.empty.sub': '첫 루틴을 만들어 매일 쓰는 탭을 자동으로 열어보세요.',
    'popup.add': '＋ 루틴 추가',
    'popup.sponsor': '❤️ 후원',
    'card.runNow': '▶ 지금 실행',
    'card.edit': '편집',
    'card.enabledTitle': '켜짐',
    'card.disabledTitle': '꺼짐',
    'card.toggleAria': '{name} 켜기/끄기',

    // Options
    'options.docTitle': 'RoutineTabs — 설정',
    'options.tagline': '그냥 작동합니다. 매일 쓰는 탭을 정해진 시간에 자동으로.',
    'options.routines': '루틴',
    'options.newRoutine': '＋ 새 루틴',
    'options.listEmpty': '아직 루틴이 없습니다. 위에서 만들어 보세요.',

    // Editor
    'editor.titleEdit': '루틴 편집',
    'editor.titleNew': '새 루틴',
    'field.name': '이름',
    'field.name.ph': '아침 업무 탭',
    'field.urls': 'URL (한 줄에 하나)',
    'field.urls.hint': 'http/https만 가능합니다. 생략하면 자동으로 붙습니다.',
    'field.days': '요일',
    'field.time': '시간 (로컬)',
    'field.newWindow': '새 창에서 열기',
    'field.enabled': '켜짐',
    'editor.delete': '삭제',
    'editor.cancel': '취소',
    'editor.save': '저장',

    // Catch-up settings
    'catchup.title': '놓친 실행 보정',
    'catchup.desc':
      '예약된 시간에 브라우저가 꺼져 있었다면, Chrome을 다시 열 때(유예 시간 내) 놓친 루틴을 실행할 수 있습니다.',
    'catchup.enable': '놓친 실행 보정 사용',
    'catchup.grace': '유예 시간 (분)',
    'catchup.graceHint':
      '이보다 오래된 놓친 실행은 무시합니다 (어제 탭이 오늘 열리지 않도록).',
    'catchup.save': '설정 저장',
    'catchup.saved': '저장됨 ✓',

    // Support section
    'support.title': '후원',
    'support.body':
      'RoutineTabs는 <strong>무료</strong>이며 모든 기능이 열려 있습니다. 시간을 아껴 준다면 <strong>GitHub Sponsors</strong>로 개발을 후원할 수 있어요 — 전적으로 선택이며, 어떤 기능도 잠겨 있지 않습니다.',
    'support.button': '❤️ GitHub에서 후원',
    'options.footer':
      '최소 권한 — RoutineTabs는 브라우징 데이터를 절대 읽지 않습니다.',

    // Validation / confirm
    'error.noValidUrl': '유효한 http/https URL을 하나 이상 입력하세요.',
    'error.invalidUrls': '잘못된 URL: {list}',
    'error.noDays': '요일을 하나 이상 선택하세요.',
    'confirm.delete': '"{name}" 루틴을 삭제할까요? 되돌릴 수 없습니다.',
    'confirm.thisRoutine': '이 루틴',
  },
};
