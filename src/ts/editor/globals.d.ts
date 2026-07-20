/**
 * Editor globals, typed via @artemsemkin/elementor-types where the package
 * covers them. Verified gaps (upstream candidates for the types package):
 * - `elementor.elementsManager` is absent from ElementorEditor
 * - `elementor.modules.elements` is `any` (no NestedElementBase typing)
 * - `elementorCommon.elements` (the $window/$document cache) is absent
 *   from ElementorCommon
 * - `$e.components.get()` returns ComponentBase | undefined, and the
 *   nested-elements component's `exports` (NestedView) is untyped
 * - `$e.hooks` (registerUIAfter et al.) is absent from the $e type
 * - `$e.commands` (isCurrentFirstTrace et al.) is absent from the $e type
 * - `$e.modules.hookData` is absent (hookUI is typed, hookData is not)
 * - `elementor.helpers.scrollToView` is absent from HelpersManager
 */
import type {
  $e as EDollar,
  Editor,
  ElementorCommon,
  ElementorEditor
} from '@artemsemkin/elementor-types'

declare global {
  const elementorCommon: ElementorCommon & {
    elements: { $window: { on: (event: string, handler: () => void) => void } }
  }
  const elementor: ElementorEditor & {
    elementsManager: Editor.Elements.ElementsManager
  }
  const $e: EDollar & {
    hooks: any
    commands: any
    modules: EDollar['modules'] & { hookData: any }
  }
}
