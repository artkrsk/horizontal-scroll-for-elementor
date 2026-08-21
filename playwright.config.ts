import { defineConfig, devices } from '@playwright/test'

/**
 * The browser tier. Everything else in this repo runs in happy-dom, which has
 * no layout and no scroll — so the pin, the scrub and the polyfill path, the
 * three things the plugin exists to do, were the only parts nothing executed.
 *
 * It runs against the same wp-env the PHPUnit suites use (the shared CI
 * workflow starts one and hands it to both), on the DEV port: the tests port
 * belongs to WordPress's own test bootstrap.
 */
export default defineConfig({
  testDir: './tests/e2e/specs',
  globalSetup: './tests/e2e/global-setup.ts',
  // One wp-env, one MySQL: parallel workers would race the same site.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8892',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The self-hosted runner is slow enough that the default 30s can flake a
    // cold Elementor page load.
    navigationTimeout: 60000
  },
  projects: [
    // Chromium drives the native tier: real view-timeline, real animation-range.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox drives the POLYFILLED tier, and is the only thing anywhere in the
    // repo that does. Its failure mode is the worst one the plugin has — a
    // pinned track that never scrubs strands every panel behind overflow-x:
    // clip — and a stubbed ViewTimeline can't tell us it works.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } }
  ]
})
