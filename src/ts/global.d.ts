import type { ElementorFrontend, ElementorModules } from '@artemsemkin/elementor-types'

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
    /** Elementor core's frontend-modules global. */
    elementorModules?: ElementorModules
    ViewTimeline?: new (options: {
      subject: Element
      axis: string
      inset?: string
    }) => AnimationTimeline
  }
}
