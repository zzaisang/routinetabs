import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// RoutineTabs Manifest V3
//
// Permission justification:
//  - "alarms":  needed to trigger routines at the user's chosen time.
//  - "storage": needed to persist routines/settings locally.
//
// We intentionally do NOT request "tabs" or any host_permissions.
//  - chrome.tabs.create({ url }) does NOT require the "tabs" permission;
//    "tabs" is only needed to *read* sensitive tab properties (url/title).
//  - We never read page content, so no host_permissions either.
// This is a marketing point: "Minimal permissions — we never read your browsing data."
export default defineManifest({
  manifest_version: 3,
  name: 'RoutineTabs',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  options_page: 'src/options/options.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['alarms', 'storage'],
});
