import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/integrated',
  timeout: 30000,
  workers: 1,
  outputDir: '/tmp/climbing-demo-test-results',
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'chrome' },
  webServer: {
    command: 'npm run demo:run',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 60000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
