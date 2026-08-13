import { createVitestConfig } from '@arts/wp-plugin-tooling/vitest'
import { defineConfig } from 'vitest/config'

// Shared shape; no JS tests yet — the suite gate starts passing
// (passWithNoTests) and tightens itself when the first test lands.
export default defineConfig(
  createVitestConfig({ defineKey: '__ARTS_HORIZONTAL_SCROLL_VERSION__', setupFiles: [] })
)
