import { defineConfig } from '@playwright/test';

// Point at a deployed environment by setting SMOKE_BASE_URL. With it unset, the
// suite starts a local backend itself and tests that.
const externalBaseUrl = process.env.SMOKE_BASE_URL;
const localPort = 4000;
const baseURL = externalBaseUrl ?? `http://localhost:${localPort}`;

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    // JSON so a failure is machine-readable; the HTML report is for humans.
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['html', { outputFolder: 'playwright-report/html', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Playwright polls this URL until it answers, which is the readiness gate —
  // without it, tests race the server's first connection to Postgres.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'node ../backend/dist/index.js',
        url: `http://localhost:${localPort}/api/links`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          PORT: String(localPort),
          DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shortloop',
        },
      },
});
