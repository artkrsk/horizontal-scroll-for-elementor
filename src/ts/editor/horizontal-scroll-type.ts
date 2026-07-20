import View from './views/view'

export default class HorizontalScrollType extends elementor.modules.elements.types
  .NestedElementBase {
  // Inherited from NestedElementTypesBase at runtime; the base class is
  // untyped (`modules.elements` gap), so declare it for ElementBase compat.
  declare getModel: () => unknown

  getType(): string {
    return 'arts-horizontal-scroll'
  }

  getView(): any {
    return View
  }
}
