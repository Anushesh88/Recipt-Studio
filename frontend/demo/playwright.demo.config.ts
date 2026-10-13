import { defineConfig } from '@playwright/test';

// Records the product demo video (see record-demo.spec.ts and README.md).
// With the app running locally: npx playwright test -c demo/playwright.demo.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: 'record-demo.spec.ts',
  timeout: 5 * 60_000,
  outputDir: './out',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 60 },
  },
});
