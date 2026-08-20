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
import { defineDependency, editedContainers, isOurWidget, registerDependencies } from './dependency'

const blocked = (): boolean => false // dependency contract: false blocks the command

export const registerPanelMoveLock = (): void => {
  registerDependencies('move-lock', () => [
    defineDependency(
      'document/elements/move',
      'arts-hs-lock-panel-moves',
      (args: any) => {
        if ($e.commands.isCurrentFirstTrace('document/repeater/move')) {
          return false // repeater-driven sync — the sanctioned path
        }
        const moved = editedContainers(args)
        const movesOurPanel = moved.some((c: any) => isOurWidget(c?.parent))
        const dropsIntoOurTrack = isOurWidget(args?.target)
        return movesOurPanel || dropsIntoOurTrack
      },
      blocked
    ),

    // Row drag-sort and row duplicate both corrupt nested children in
    // current Elementor (verified live — core's own Nested Tabs drops a
    // child on the same move command; duplicate clones the row but not the
    // child container, and the index-only correlation then deletes wrong
    // children). The repeater declares item_actions sort/duplicate = false,
    // but that flag's wiring to the UI is unreliable across versions —
    // these vetoes are the enforcement. Add/remove are healthy and stay
    // open.
    defineDependency(
      'document/repeater/move',
      'arts-hs-lock-repeater-sort',
      (args: any) => isOurWidget(args?.container),
      blocked
    ),
    defineDependency(
      'document/repeater/duplicate',
      'arts-hs-lock-repeater-duplicate',
      (args: any) => isOurWidget(args?.container),
      blocked
    )
  ])
}
