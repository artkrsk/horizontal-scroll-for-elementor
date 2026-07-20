import HorizontalScrollType from './horizontal-scroll-type'
import { registerPanelWidthGuard } from './patches/guard-panel-width'
import { registerPanelMoveLock } from './patches/lock-panel-moves'
import { suppressNativeScrollForPanels } from './patches/suppress-native-scroll'

export default class Module {
  constructor() {
    elementor.elementsManager.registerElementType(new HorizontalScrollType())
    suppressNativeScrollForPanels()
    registerPanelMoveLock()
    registerPanelWidthGuard()
  }
}
