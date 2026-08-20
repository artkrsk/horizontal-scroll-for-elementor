// Bundle entry: wiring only. The engine lives in ./engine, and each
// compatibility feature exposes an install*() seam instead of registering
// listeners at import time.

import { installAnchorScroll } from './anchor-scroll'
import { WRAPPER_CLASS, WRAPPER_SELECTOR } from './contract'
import { boot, getTimeline } from './engine'
import { installMotionFx } from './motion-fx-compat'
import { installScrollspy } from './scrollspy'

// Order matches the import-evaluation order these installs replaced, and all
// three run before the element_ready hook below: anchor-scroll's capture-phase
// click listener has to be attached as early as it was.
installAnchorScroll()
installScrollspy()
installMotionFx()

window.ARTS_HS = { ...window.ARTS_HS, contract: 1, getTimeline }

window.addEventListener('elementor/frontend/init', () => {
  // Spelled out, deliberately NOT composed from WIDGET_TYPE: AssetsTest greps
  // the BUILT bundle for this hook name, and an interpolated one leaves no
  // literal to find. The widget type has to stay in sync with PHP's get_name()
  // regardless, which no TS constant can enforce.
  window.elementorFrontend.hooks.addAction(
    'frontend/element_ready/arts-horizontal-scroll.default',
    ($scope: unknown) => {
      const el = (($scope as { 0?: HTMLElement })[0] ?? $scope) as HTMLElement
      const wrapper = el.classList?.contains(WRAPPER_CLASS)
        ? el
        : el.querySelector<HTMLElement>(WRAPPER_SELECTOR)
      if (wrapper) {
        boot(wrapper)
      }
    }
  )
})
