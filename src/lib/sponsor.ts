// GitHub Sponsors donation link (PLAN.md §4 — monetization model is
// "free + donations", not paid). RoutineTabs is fully free; this is an optional
// "support development" link that opens the maintainer's GitHub Sponsors page.
//
// ┌───────────────────────────── TODO (USER ACTION REQUIRED) ─────────────────────────────┐
// │ Enable GitHub Sponsors for your account at https://github.com/sponsors and confirm     │
// │ the handle below. Until Sponsors is active, SPONSOR_URL 404s. Korea payouts are        │
// │ supported via Stripe Connect / GitHub's manual payout — verify region at signup.       │
// └────────────────────────────────────────────────────────────────────────────────────────┘

export const SPONSOR_URL = 'https://github.com/sponsors/zzaisang';

/** Open the GitHub Sponsors page in a new tab. (chrome.tabs.create needs no permission.) */
export function openSponsorPage(): void {
  chrome.tabs.create({ url: SPONSOR_URL });
}
