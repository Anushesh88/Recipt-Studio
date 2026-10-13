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
    launchOptions: { slowMo: 60 },
  },
  projects: [
    // Landscape, for YouTube, LinkedIn and the website
    {
      name: 'landscape',
      use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, video: { mode: 'on', size: { width: 1280, height: 720 } } },
    },
    // Vertical 9:16, for Reels, Shorts and WhatsApp Status: the app's phone layout
    {
      name: 'vertical',
      // Recorded at 540x960 and scaled 2x to 1080x1920 (README.md)
      use: { viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, video: { mode: 'on', size: { width: 540, height: 960 } } },
    },
  ],
});
