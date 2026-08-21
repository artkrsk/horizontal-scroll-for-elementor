import { createVitestConfig } from '@arts/wp-plugin-tooling/vitest'
import { defineConfig } from 'vitest/config'

const base = createVitestConfig({
  defineKey: '__ARTS_HORIZONTAL_SCROLL_VERSION__',
  setupFiles: []
})

/**
 * Editor files that can only be exercised by reconstructing Elementor rather
 * than standing in for one function we wrap. The test that separates them from
 * the guards, which ARE covered: does our code call INTO the fake?
 * `views/view.ts` calls `super.filter` and `module.ts` calls
 * `elementor.elementsManager`, so a fake base would be writing the behaviour
 * under test — whereas nothing ever calls `super` on the guards' Dependency
 * base. The remaining two are bootstrap and a class declaration.
 *
 * Same "wiring, not logic" grounds on which the shared config excludes
 * src/ts/index.ts.
 */
const EDITOR_ADAPTERS = [
  'src/ts/editor/index.ts',
  'src/ts/editor/module.ts',
  'src/ts/editor/horizontal-scroll-type.ts',
  'src/ts/editor/views/view.ts'
]

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      ...base.test.coverage,
      exclude: [...base.test.coverage.exclude, ...EDITOR_ADAPTERS]
    }
  }
})
