import type { ElementorFrontend, ElementorModules } from '@artemsemkin/elementor-types'
import type { IHorizontalScrollApp } from './app'

// Producer-only: the WordPress boot, the editor bundle and the Elementor
// adapters compile against this. Modules the package root reaches (./index,
// transitively) must never rely on it — they read globals through a locally
// typed cast instead, and tests/ts/packageEntries.test.ts typechecks them
// without this file.
declare global {
  interface Window {
    /** Public integration surface — see the Integration contract in README.md. Published by app.init(). */
    artsHorizontalScroll?: IHorizontalScrollApp
    /** @deprecated 1.4.x name of `artsHorizontalScroll`, the same object. Published by the WordPress boot only. */
    ARTS_HS?: IHorizontalScrollApp
    /**
     * Editor-only diagnostic strings, already translated by PHP and emitted
     * into the Elementor preview only. Its ABSENCE is the gate: a public page
     * never carries it, so diagnostics.ts stays inert there by construction.
     */
    artsHorizontalScrollDiagnostics?: {
      blocked: string
      overflow: string
      fixed: string
    }
    /**
     * Published by the shared arts/scroll-timeline-polyfill loader, which our
     * script handle depends on. Settles 'native' | 'polyfilled' | 'unavailable';
     * never rejects.
     */
    __artsScrollTimelinePolyfillReady?: Promise<'native' | 'polyfilled' | 'unavailable'>
    elementorFrontend: ElementorFrontend
    /** Elementor core's frontend-modules global. */
    elementorModules?: ElementorModules
    ViewTimeline?: new (options: {
      subject: Element
      axis: string
      inset?: string
    }) => AnimationTimeline
  }
}
