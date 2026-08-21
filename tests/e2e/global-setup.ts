import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Seeds the site the specs run against.
 *
 * The fixture is dev/seed/demo-page.php — the same script the wp.org Live
 * Preview blueprint inlines, deliberately rather than a purpose-built one: it
 * is already idempotent and WP_CLI-guarded, and pointing both consumers at it
 * means a page that stops rendering breaks the suite and the shop-window
 * preview together, on the same signal.
 *
 * No login here. Every spec is a frontend visitor, which is also the state the
 * pin math is tuned for — an admin bar shifts the sticky offset.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** test-workspace is the repo root, mounted by .wp-env.json. */
const SEED = '/var/www/html/test-workspace/dev/seed/demo-page.php'

const wp = (command: string): string =>
  execSync(`pnpm exec wp-env run cli -- ${command}`, {
    cwd: ROOT,
    timeout: 120000
  }).toString()

export default function globalSetup(): void {
  // The blueprint's landingPage is a pretty permalink, and so is DEMO_PAGE.
  wp("wp rewrite structure '/%postname%/' --hard")
  wp('wp rewrite flush')

  const seeded = wp(`wp eval-file ${SEED} --user=1`)
  console.log(`[e2e] ${seeded.trim()}`)

  // Elementor's one-time activation redirect would otherwise hijack the first
  // navigation of the run.
  try {
    wp('wp transient delete elementor_activation_redirect')
  } catch {
    // Absent on an already-onboarded site, which is the normal case.
  }
}
