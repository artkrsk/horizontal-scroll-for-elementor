// Navigator/canvas drags of nested children run plain document/elements/move,
// which reorders elements[] only — core has NO reverse sync into the repeater
// rows (verified in modules/nested-elements; Nested Tabs shares the gap: its
// children desync the same way). The panel repeater is the only
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

    // Row drag-sort and row duplicate are locked as a precaution, not because
    // a failure was reproduced: on Elementor 4.1.5 both `$e` commands (what
    // the repeater UI runs) kept rows, child models, canvas DOM and serialized
    // elements in step, for core's Nested Tabs and for this widget with these
    // vetoes bypassed. The recorded concern — a duplicate cloning only the
    // row, Nested Tabs dropping a child on move, and the index-only row-to-child
    // correlation then deleting wrong children — did not reproduce; re-test
    // before relaxing. The repeater declares item_actions sort/duplicate =
    // false, but those flags only gate the UI affordances —
    // $e.run('document/repeater/*') never reads them — so these vetoes are the
    // enforcement. Add/remove are healthy and stay open.
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
