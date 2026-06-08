# RoutineTabs

> Reliably open your daily tab sets on a schedule. **DST-safe. Toggle that actually works. One-time price. Minimal permissions.**

A Chrome (Manifest V3) extension that opens a chosen set of URLs at the days/times
you pick — the way the category leader *should* have worked. The whole product is
about **execution quality**, not new features. See [`PLAN.md`](./PLAN.md) for the
full product/market rationale.

---

## What it does

- **Routines** = `{ name, URL list, schedule (days + time), enabled }`.
- Opens the tab set automatically at the scheduled local time (as new tabs or a new window).
- **"Run now"** button to fire a routine immediately.
- **Enable/disable toggle that truly stops a routine** (the #1 competitor's core bug).
- **Reliability engine**: DST-safe scheduling, recovery after the service worker is
  evicted, and catch-up for runs missed while the browser was closed.
- **Free**: 1 routine. **Pro ($9 one-time)**: unlimited routines.
- Dark mode, English UI, **only `alarms` + `storage` permissions** (never reads your browsing data).

---

## Tech stack

- **TypeScript + Vite + [@crxjs/vite-plugin](https://crxjs.dev/)** (MV3 build + HMR).
- No UI framework (vanilla TS + CSS) for low maintenance.
- Payments via **[ExtensionPay](https://extensionpay.com)** (serverless license handling).
- **Vitest** unit tests for the pure scheduling logic.

---

## Project layout

```
routinetabs/
├── PLAN.md                  # product spec & rationale
├── manifest.config.ts       # MV3 manifest (permissions: alarms, storage only)
├── vite.config.ts           # Vite + crxjs + vitest config
├── public/icons/            # 16/32/48/128 PNG placeholders (replace before launch)
├── src/
│   ├── background.ts         # service worker: alarms, firing, rehydration, catch-up
│   ├── lib/
│   │   ├── schedule.ts       # PURE functions: nextOccurrence / previousOccurrence / getMissedOccurrence
│   │   ├── alarms.ts         # self-rescheduling one-shot alarm helpers
│   │   ├── storage.ts        # chrome.storage.local wrapper + migration
│   │   ├── tabs.ts           # opening tabs / windows
│   │   ├── url.ts            # URL normalization + validation
│   │   ├── license.ts        # ExtensionPay wrapper (stub-safe)
│   │   ├── messaging.ts      # typed popup/options -> background messages
│   │   ├── format.ts         # display helpers (next-run, day labels)
│   │   └── types.ts          # data model
│   ├── popup/                # popup.html / .css / .ts
│   ├── options/              # options.html / .css / .ts
│   └── styles/theme.css      # shared tokens + dark mode
└── tests/schedule.test.ts    # DST / weekday / catch-up boundary tests
```

---

## Build & run

```bash
npm install
npm run build      # tsc --noEmit + vite build  -> dist/
npm test           # vitest: schedule engine unit tests
npm run dev        # vite dev server with HMR (for local development)
```

### Load the unpacked extension in Chrome

1. Run `npm run build` (produces `dist/`).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the `dist/` folder.
5. The RoutineTabs icon appears in the toolbar. Click it to open the popup.

> For live development, `npm run dev` + Load unpacked on `dist/` gives HMR via crxjs.

### Quick manual test of scheduling

1. Open the options page → **New routine**.
2. Add a URL or two, select today's weekday, set the time **2 minutes from now**, Save.
3. Wait — the tabs should open at that minute. Then toggle the routine **off** and
   confirm it does **not** open at the next scheduled time.

---

## Reliability design (the whole point)

All implemented in `src/background.ts`, `src/lib/alarms.ts`, `src/lib/schedule.ts`:

- **No `setTimeout`/`setInterval`** in the service worker — only `chrome.alarms`.
  (Verified: the built SW chunk contains zero timers.)
- **Listeners registered synchronously at module top level** so an evicted worker
  can be woken with handlers already attached.
- **Self-rescheduling one-shot alarms** (not `periodInMinutes`): on every fire we
  recompute the next *local wall-clock* occurrence, so DST transitions never drift
  the "9:00 the user sees".
- **Re-read `enabled` from storage on every fire** before opening tabs — this is the
  toggle fix the competitor can't ship.
- **`onInstalled` / `onStartup` rehydration** rebuilds all alarms from storage.
- **Missed-run catch-up**: on startup we run occurrences missed while the browser was
  off, but only within a configurable grace window (default 120 min) and only if not
  already run.

---

## Monetization status (ExtensionPay)

The client integration is fully wired but runs in a **safe stub mode** until you
register the extension with ExtensionPay. In stub mode `isPaid()` returns `false`
(free tier) and the upgrade buttons show an info message instead of crashing — so
the entire free product builds, loads, and is testable today.

To enable real payments (`src/lib/license.ts`):

1. Sign up at <https://extensionpay.com> and register this extension to get its id.
2. Set `EXTPAY_ID` in `src/lib/license.ts` (or define `VITE_EXTPAY_ID` at build time).
3. Configure a **$9 one-time** product in the ExtensionPay dashboard.
4. Rebuild. `background.ts` already calls `startBackgroundLicense()`, and the popup /
   options pages call `isPaid()` / `openPaymentPage()`.

---

## Remaining TODO (user action required)

| # | Task | Why it can't be done here |
|---|------|---------------------------|
| 1 | **Register with ExtensionPay** and set `EXTPAY_ID` (+ create the $9 product) | Requires your account; see `src/lib/license.ts`. |
| 2 | **Replace placeholder icons** in `public/icons/` (16/32/48/128) with real artwork | Auto-generated clock placeholders are functional but plain. Regenerate or drop in your own PNGs of the same names/sizes. |
| 3 | **Chrome Web Store developer registration ($5 one-time)** and store submission | Paid, manual, account-bound. |
| 4 | **Confirm the name "RoutineTabs"** is free of store/trademark conflicts | Manual check; have 1–2 backup names ready. |
| 5 | Capture **screenshots + a demo GIF** (routine setup → tabs auto-open) for the listing | Needs a real browser session. |
| 6 | Manual integration QA from `PLAN.md §10` (browser-restart catch-up, multi-routine, etc.) | Requires loading in a real Chrome. |

### Regenerating the placeholder icons

The icons were generated by a small dependency-free Node script (a blue rounded
square + white clock face). To recreate or tweak them, re-run the PNG generation
snippet from the project history, or simply overwrite the four files in
`public/icons/` with your own PNGs named `icon16.png`, `icon32.png`, `icon48.png`,
`icon128.png`.

---

## Chrome Web Store listing copy (draft)

**Name:** RoutineTabs — Scheduled Tab Sets

**Short description (≤132 chars):**
> Open your daily tab sets automatically, on schedule. DST-safe, the off-toggle really works, one-time $9 — no subscription.

**Detailed description:**
> RoutineTabs opens your everyday websites — mail, calendar, dashboards, project
> tools — automatically at the days and times you choose. It's built for one thing:
> **working reliably.**
>
> ✅ **It just works.** Daylight-saving time won't shift your routines an hour. Turn
> a routine off and it genuinely stays off. No surprise tabs.
>
> ✅ **One-time price.** Free for 1 routine. Unlock unlimited routines for a single
> **$9** payment — no subscriptions, ever.
>
> ✅ **Minimal permissions.** RoutineTabs only uses `alarms` and `storage`. It
> **never reads your browsing data**, never touches page content, and requests no
> host permissions.
>
> **How it works**
> 1. Create a routine: name it, paste your URLs, pick days + a time.
> 2. RoutineTabs opens that tab set on schedule — as new tabs or a new window.
> 3. Use "Run now" anytime, or toggle a routine off when you don't need it.
>
> **Honest note about browser restarts:** Chrome can only run a routine while it's
> open. If Chrome was closed at the scheduled time, RoutineTabs catches up the
> missed run when you reopen it (within a grace window you control).

**Category:** Productivity
**Permission justification:**
- `alarms`: to trigger routines at the user's chosen time.
- `storage`: to save routines and settings locally on the device.
- No `tabs` permission and no host permissions — we never read your browsing data.

---

## License / status

Pre-release MVP (`v0.1.0`). Solo project; see `PLAN.md` for scope and roadmap (auto-close,
tab groups, sync, import/export are explicitly **out of scope** for the MVP).
