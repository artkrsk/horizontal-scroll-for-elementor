// Elementor rebuilds elementorFrontend.hooks inside every init() and only then
// dispatches elementor/frontend/init. AJAX navigators that run init() once per
// page lifetime (ArtsAJAXNavigator) evaluate this bundle on a later page, after
// that dispatch — waiting for the event alone never boots there. Run now when
// init already happened, and again on every later init.
export const onElementorFrontendInit = (callback: () => void): void => {
  window.addEventListener('elementor/frontend/init', callback)
  if (window.elementorFrontend?.hooks) {
    callback()
  }
}
