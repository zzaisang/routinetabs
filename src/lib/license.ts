// ExtensionPay wrapper (PLAN.md §4 / §5.1 / M5).
//
// Monetization model: $9 one-time (lifetime). Free = 1 routine, Pro = unlimited.
//
// ┌───────────────────────────── TODO (USER ACTION REQUIRED) ──────────────────────────────┐
// │ 1. Sign up at https://extensionpay.com and register this extension to get its           │
// │    ExtensionPay id, then set EXTPAY_ID below (or via the VITE_EXTPAY_ID env var).        │
// │ 2. Configure a $9 one-time product in the ExtensionPay dashboard.                        │
// │ 3. ExtensionPay's `extpay.startBackground()` must be called from the service worker      │
// │    (already wired in background.ts) so the payment flow can message it.                  │
// │ 4. ExtensionPay injects its own content script for its payment domain; with the official │
// │    library no extra manifest permissions beyond "storage" are required for the basic     │
// │    flow. If the library complains, follow its setup docs for the exact manifest keys.    │
// └─────────────────────────────────────────────────────────────────────────────────────────┘
//
// Until EXTPAY_ID is set, the wrapper runs in a safe "stub" mode: isPaid() returns
// false (free tier) and openPaymentPage() shows a console warning instead of
// crashing. This lets the entire free product ship & be tested without an account.

import ExtPay from 'extpay';

// TODO(user): replace with your real ExtensionPay extension id after registering.
export const EXTPAY_ID: string =
  (import.meta as any)?.env?.VITE_EXTPAY_ID || '';

const STUB_MODE = !EXTPAY_ID;

type ExtPayInstance = ReturnType<typeof ExtPay>;

let _extpay: ExtPayInstance | null = null;

function extpay(): ExtPayInstance | null {
  if (STUB_MODE) return null;
  if (!_extpay) _extpay = ExtPay(EXTPAY_ID);
  return _extpay;
}

/**
 * Call once from the service worker top level so ExtensionPay can run its
 * background message handlers. No-op in stub mode.
 */
export function startBackgroundLicense(): void {
  const ep = extpay();
  if (!ep) {
    console.info('[RoutineTabs] ExtensionPay in STUB mode (no EXTPAY_ID set).');
    return;
  }
  ep.startBackground();
}

/** Whether the user has purchased Pro. Always false in stub mode. */
export async function isPaid(): Promise<boolean> {
  const ep = extpay();
  if (!ep) return false;
  try {
    const user = await ep.getUser();
    return Boolean(user.paid);
  } catch (e) {
    console.warn('[RoutineTabs] isPaid() failed, treating as free', e);
    return false;
  }
}

/** Open the ExtensionPay payment page. No-op (warn) in stub mode. */
export async function openPaymentPage(): Promise<void> {
  const ep = extpay();
  if (!ep) {
    console.warn(
      '[RoutineTabs] openPaymentPage() called in STUB mode. Set EXTPAY_ID to enable payments.'
    );
    alert(
      'Payments are not configured in this build.\n\n(Developer: set EXTPAY_ID in src/lib/license.ts)'
    );
    return;
  }
  ep.openPaymentPage();
}

/**
 * Subscribe to paid-status changes. Returns an unsubscribe fn.
 * NOTE: ExtensionPay's onPaid only exposes addListener (no removeListener), so in
 * non-stub mode the returned unsubscribe is a no-op. Callers in popup/options are
 * short-lived pages, so this is fine.
 */
export function onPaidChanged(cb: (paid: boolean) => void): () => void {
  const ep = extpay();
  if (!ep) return () => {};
  ep.onPaid.addListener((user) => cb(Boolean(user.paid)));
  return () => {};
}
