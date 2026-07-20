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
//
// Mutating the command args in a Dependency hook (then returning true) is the
// sanctioned single-transaction path — same mechanism as lock-panel-moves.
const PANEL_WIDTH = { unit: 'vw', size: 100 }

export const registerPanelWidthGuard = (): void => {
  if (
    typeof $e?.modules?.hookData?.Dependency !== 'function' ||
    typeof $e?.hooks?.registerDataDependency !== 'function'
  ) {
    return
  }

  const isOurWidget = (container: any): boolean =>
    'arts-horizontal-scroll' === container?.model?.get?.('widgetType')

  // Guard 1: bare panels created via "+ Add Panel" get a definite default width.
  class DefaultPanelWidth extends $e.modules.hookData.Dependency {
    getCommand(): string {
      return 'document/elements/create'
    }

    getId(): string {
      return 'arts-hs-default-panel-width'
    }

    getConditions(args: any): boolean {
      return isOurWidget(args?.container) && 'container' === args?.model?.elType
    }

    apply(args: any): boolean {
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
  }

  // Guard 2: a percentage Width on a panel is coerced to vw (per breakpoint).
  class CoercePanelWidth extends $e.modules.hookData.Dependency {
    getCommand(): string {
      return 'document/elements/settings'
    }

    getId(): string {
      return 'arts-hs-coerce-panel-width'
    }

    getConditions(args: any): boolean {
      const edited = args?.containers ?? (args?.container ? [args.container] : [])
      return edited.some((c: any) => isOurWidget(c?.parent))
    }

    apply(args: any): boolean {
      const edited = args?.containers ?? (args?.container ? [args.container] : [])
      edited.forEach((container: any) => {
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
  }

  try {
    $e.hooks.registerDataDependency(new DefaultPanelWidth())
    $e.hooks.registerDataDependency(new CoercePanelWidth())
  } catch (e) {
    console.warn('[arts-horizontal-scroll] panel-width guard registration failed:', e)
  }
}
