// Navigator/canvas drags of nested children run plain document/elements/move,
// which reorders elements[] only — core has NO reverse sync into the repeater
// rows (verified in modules/nested-elements at HEAD; Nested Tabs shares the
// gap: its children desync the same way). The panel repeater is the only
// reorder surface core designed for, so foreign moves of our panels are
// blocked instead of silently desyncing.
//
// Core's own nested-repeater move hook syncs the child container by running
// document/elements/move UNDER a document/repeater/move first-trace — that
// legitimate path is let through via the first-trace discriminator.
export const registerPanelMoveLock = (): void => {
  if (
    typeof $e?.modules?.hookData?.Dependency !== 'function' ||
    typeof $e?.hooks?.registerDataDependency !== 'function'
  ) {
    return
  }

  const isOurWidget = (container: any): boolean =>
    'arts-horizontal-scroll' === container?.model?.get?.('widgetType')

  class LockPanelMoves extends $e.modules.hookData.Dependency {
    getCommand(): string {
      return 'document/elements/move'
    }

    getId(): string {
      return 'arts-hs-lock-panel-moves'
    }

    getConditions(args: any): boolean {
      if ($e.commands.isCurrentFirstTrace('document/repeater/move')) {
        return false // repeater-driven sync — the sanctioned path
      }
      const moved = args?.containers ?? (args?.container ? [args.container] : [])
      const movesOurPanel = moved.some((c: any) => isOurWidget(c?.parent))
      const dropsIntoOurTrack = isOurWidget(args?.target)
      return movesOurPanel || dropsIntoOurTrack
    }

    apply(): boolean {
      return false // dependency contract: false blocks the command
    }
  }

  // Row drag-sort and row duplicate both corrupt nested children in
  // current Elementor (verified live — core's own Nested Tabs drops a
  // child on the same move command; duplicate clones the row but not the
  // child container, and the index-only correlation then deletes wrong
  // children). The repeater declares item_actions sort/duplicate = false,
  // but that flag's wiring to the UI is unreliable across versions —
  // these vetoes are the enforcement. Add/remove are healthy and stay
  // open.
  const lockRepeaterCommand = (command: string, id: string) => {
    class LockRepeaterMutation extends $e.modules.hookData.Dependency {
      getCommand(): string {
        return command
      }

      getId(): string {
        return id
      }

      getConditions(args: any): boolean {
        return isOurWidget(args?.container)
      }

      apply(): boolean {
        return false // dependency contract: false blocks the command
      }
    }
    return new LockRepeaterMutation()
  }

  try {
    $e.hooks.registerDataDependency(new LockPanelMoves())
    $e.hooks.registerDataDependency(
      lockRepeaterCommand('document/repeater/move', 'arts-hs-lock-repeater-sort')
    )
    $e.hooks.registerDataDependency(
      lockRepeaterCommand('document/repeater/duplicate', 'arts-hs-lock-repeater-duplicate')
    )
  } catch (e) {
    console.warn('[arts-horizontal-scroll] move-lock registration failed:', e)
  }
}
