// Panels are core Containers. A Container with no explicit Width inherits
// Elementor's `--width: 100%`, which resolves circularly against our
// `max-content` flex track: the panel blows out far past the viewport AND the scrub
// geometry breaks (the track's scroll width and layout width diverge, so the
// pin travels past only the earlier panels). Two ways a panel reaches that
// state, two guards — both scoped to our widget's own panels:
//
//   1. "+ Add Panel" — core's NestedRepeaterCreateContainer runs
//      document/elements/create with a bare model {elType, isLocked, _title};
//      it never consults our PHP panel_container() default (that only seeds the
//      INITIAL children). Stamp a one-screen width onto the create model so
//      added panels match the initial ones.
//   2. Author sets the Width control to a percentage — coerce the unit to `vw`
//      (keeping the number, so 50% -> 50vw) on the settings command. A `%`
//      panel width is never sane here (it means "% of the track", never "one
//      screen"), so this preserves intent in a unit that actually works.
import { defineDependency, editedContainers, isOurWidget, registerDependencies } from './dependency'

const PANEL_WIDTH = { unit: 'vw', size: 100 }

export const registerPanelWidthGuard = (): void => {
  registerDependencies('panel-width guard', () => [
    // Guard 1: bare panels created via "+ Add Panel" get a definite default width.
    defineDependency(
      'document/elements/create',
      'arts-hs-default-panel-width',
      (args: any) => isOurWidget(args?.container) && 'container' === args?.model?.elType,
      (args: any) => {
        const model = args.model
        model.settings = model.settings ?? {}
        // Respect an already-authored width (initial panels carry the PHP default).
        if (!model.settings.width) {
          // Match panel_container(): `full` is required for the Width control to
          // take effect (its `--width` selector is gated on content_width:full),
          // and it's what the initial panels already use.
          model.settings.content_width = 'full'
          model.settings.width = { ...PANEL_WIDTH }
        }
        return true // allow the (now-enriched) create
      }
    ),

    // Guard 2: a percentage Width on a panel is coerced to vw (per breakpoint).
    defineDependency(
      'document/elements/settings',
      'arts-hs-coerce-panel-width',
      (args: any) => editedContainers(args).some((c: any) => isOurWidget(c?.parent)),
      (args: any) => {
        editedContainers(args).forEach((container: any) => {
          if (!isOurWidget(container?.parent)) {
            return
          }
          const settings = args.isMultiSettings ? args.settings?.[container.id] : args.settings
          if (!settings) {
            return
          }
          // `width`, `width_tablet`, `width_mobile`, … — every responsive variant.
          for (const key of Object.keys(settings)) {
            if (/^width($|_)/.test(key) && '%' === settings[key]?.unit) {
              settings[key] = { ...settings[key], unit: 'vw' }
            }
          }
        })
        return true // allow the (now-coerced) settings change
      }
    )
  ])
}
