import { defineConfig } from '@playwright/test';

const port = process.env.FIMKEN_PORT || 5173;

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1080 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
