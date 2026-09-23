// The widget opts into core's `support_improved_repeaters` so a repeater
// insert/remove patches the canvas instead of re-rendering the whole widget
// (see get_initial_config() in the PHP widget). On insert, that path renders a
// `-content-single` template into the widget's `target_container` — this widget
// has neither, since its only per-row DOM is the child container the
// nested-elements create hook renders itself. Left on, the insert throws
// mid-command and the Add button then trips over the missing return value.
//
// renderAfterInsert: false skips core's canvas step for our inserts, including
// the re-insert behind undoing a removal; the child container still renders
// through the nested-elements hook.
import { defineDependency, isOurWidget, registerDependencies } from './dependency'

export const skipCanvasRender = (args: any): boolean => {
  args.renderAfterInsert = false
  return true // allow the insert, minus core's canvas step
}

export const registerInsertRenderSkip = (): void => {
  registerDependencies('insert-render skip', () => [
    defineDependency(
      'document/repeater/insert',
      'arts-hs-skip-insert-render',
      (args: any) => isOurWidget(args?.container),
      skipCanvasRender
    )
  ])
}
