import type { ElementorFrontend } from '@artemsemkin/elementor-types'

declare global {
  interface Window {
    /** Public integration surface — see the Integration contract in README.md. Created by this bundle. */
    ARTS_HS?: {
      contract?: number
      getTimeline?: (el: Element) => AnimationTimeline | null
    }
    /**
     * Published by the shared arts/scroll-timeline-polyfill loader, which our
     * script handle depends on. Settles 'native' | 'polyfilled' | 'unavailable';
     * never rejects.
     */
    __artsScrollTimelinePolyfillReady?: Promise<string>
    elementorFrontend: ElementorFrontend
    /**
     * Elementor core's frontend-modules global. Only the utility the Motion FX
     * correction wraps is typed here — upstream candidate for
     * `@artemsemkin/elementor-types`.
     */
    elementorModules?: {
      utils?: {
        Scroll?: {
          getElementViewportPercentage?: (
            $element: { 0?: Element },
            offsetObj?: { start?: number; end?: number }
          ) => number
        }
      }
    }
    ViewTimeline?: new (options: {
      subject: Element
      axis: string
      inset?: string
    }) => AnimationTimeline
  }
}
