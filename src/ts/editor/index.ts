// Ported from elementor/modules/nested-tabs/assets/js/editor/index.js —
// core dispatches the readiness signal on window as a native CustomEvent
// (jQuery's .on() picks those up too), once its nested-elements exports exist.
elementorCommon.elements.$window.on('elementor/nested-element-type-loaded', async () => {
  ;new (await import('./module')).default()
})
