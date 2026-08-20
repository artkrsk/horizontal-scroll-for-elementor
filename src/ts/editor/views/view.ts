export default class View extends $e.components.get('nested-elements').exports.NestedView {
  /**
   * Stamp every panel as locked as its child view is admitted (the same
   * per-child hook nested-tabs overrides). Locked models render
   * data-locked="true" in the Navigator, whose sortable cancels the drag
   * gesture — reordering desyncs repeater rows from children (core gap).
   * Covers panels from older saves/imports that predate the locked PHP
   * defaults.
   */
  filter(child: any, index: number): boolean {
    child.attributes.isLocked = true
    return super.filter ? super.filter(child, index) : true
  }
}
