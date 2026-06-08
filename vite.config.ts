import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      // crxjs discovers html entry points from the manifest automatically.
    },
  },
  // Vitest config lives here too so the schedule engine tests run with `npm test`.
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
