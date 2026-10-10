// WordPress bundle entry: the Elementor host. The engine and its lifecycle
// live in ./app; this wires them to Elementor's frontend, and each
// Elementor-only compatibility feature exposes an install*() seam instead of
// registering listeners at import time.

import { initLoadCorrection } from './anchor-scroll'
import { createHorizontalScrollApp } from './app'
import { WRAPPER_CLASS, WRAPPER_SELECTOR } from './contract'
import { inspectSection } from './diagnostics'
import { installMotionFx } from './motion-fx-compat'
import { installScrollspy, requestScrollspyRescan } from './scrollspy'
import { onElementorFrontendInit } from './utils/onElementorFrontendInit'

// Deep links are corrected on every Elementor frontend init, not once: PJAX
// themes re-run init() per transition and land on the new page's hash there.
const app = createHorizontalScrollApp({ deepLink: false })

// Order matches the import-evaluation order these installs replaced, and all
// of it runs before the element_ready hook below: anchor-scroll's capture-phase
// click listener has to be attached as early as it was.
app.init()
// Deprecated alias, same object — 1.4.x published the service under this name.
window.ARTS_HS = app
onElementorFrontendInit(() => initLoadCorrection(app.signal))
installScrollspy()
installMotionFx()

// Elementor rebuilds its hooks object on every init(); an action added to one
// object must not be added to it twice when both the immediate path and a
// later init event reach it.
const registered = new WeakSet<object>()

onElementorFrontendInit(() => {
  const hooks = window.elementorFrontend?.hooks
  if (!hooks || registered.has(hooks)) {
    return
  }
  registered.add(hooks)
  // Spelled out, deliberately NOT composed from WIDGET_TYPE: AssetsTest greps
  // the BUILT bundle for this hook name, and an interpolated one leaves no
  // literal to find. phpParity.test.ts pins this literal against WIDGET_TYPE
  // and WIDGET_TYPE against PHP's get_name(), so the duplication can't drift.
  hooks.addAction('frontend/element_ready/arts-horizontal-scroll.default', ($scope: unknown) => {
    const el = (($scope as { 0?: HTMLElement })[0] ?? $scope) as HTMLElement
    const wrapper = el.classList?.contains(WRAPPER_CLASS)
      ? el
      : el.querySelector<HTMLElement>(WRAPPER_SELECTOR)
    if (wrapper) {
      app.mount(wrapper)
      requestScrollspyRescan()
      inspectSection(wrapper)
    }
  })
})
