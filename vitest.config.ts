import { createVitestConfig } from '@arts/wp-plugin-tooling/vitest'
import { defineConfig } from 'vitest/config'

const base = createVitestConfig({
  defineKey: '__ARTS_HORIZONTAL_SCROLL_VERSION__',
  setupFiles: []
})

/**
 * The one editor file that can only be exercised by reconstructing Elementor
 * rather than standing in for one function we wrap. `horizontal-scroll-type.ts`
 * is a class declaration over `elementor.modules.elements.types.NestedElementBase`
 * whose two methods hand back a constant and a class — both already pinned from
 * the Module that registers it.
 *
 * `module.ts` and `views/view.ts` were here too and no longer are: calling into
 * a fake is not the same as a fake writing the behaviour, and what those two
 * decide (which type is registered, that every admitted child comes back
 * locked) is ours, not the base class's.
 */
const EDITOR_ADAPTERS = ['src/ts/editor/horizontal-scroll-type.ts']

/**
 * The shared config excludes every entry file as wiring. That premise stopped
 * holding here when the runway moved inside Elementor's widget container: the
 * `$scope` unwrap in src/ts/index.ts is what decides whether the engine ever
 * finds its own markup, and it publishes `window.ARTS_HS` — a committed public
 * surface. tests/ts/index.dom.test.ts covers both, so it counts.
 */
const excluded = base.test.coverage.exclude.filter((path) => path !== 'src/ts/index.ts')

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      ...base.test.coverage,
      exclude: [...excluded, ...EDITOR_ADAPTERS],
      // Set just under the measured baseline (100 / 97.3 / 100 / 100). Raise
      // as coverage grows; never lower without discussion — the point is that a
      // future change cannot quietly stop covering what is covered today.
      thresholds: { statements: 99, branches: 97, functions: 98, lines: 99 }
    }
  }
})
