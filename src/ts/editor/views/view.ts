import { PANEL_FLAG } from '../patches/guard-panel-width'

export default class View extends $e.components.get('nested-elements').exports.NestedView {
  /**
   * Stamp every panel as locked as its child view is admitted (the same
   * per-child hook nested-tabs overrides). Locked models render
   * data-locked="true" in the Navigator, whose sortable cancels the drag
   * gesture — reordering desyncs repeater rows from children (core gap).
   * Covers panels from older saves/imports that predate the locked PHP
   * defaults.
   *
   * The panel marker rides the same hook for the same reason: it gates the
   * Fit Content switch on the panel's Layout tab, and panels saved before it
   * existed carry none. Set silently so merely opening an old page neither
   * re-renders nor reads as an unsaved change; the value still serialises on
   * the next save — which is also the only moment the switch itself can be
   * turned on, so its CSS always finds its marker alongside.
   */
  filter(child: any, index: number): boolean {
    child.attributes.isLocked = true
    child.attributes.settings?.set?.(PANEL_FLAG, 'yes', { silent: true })
    return super.filter ? super.filter(child, index) : true
  }
}
