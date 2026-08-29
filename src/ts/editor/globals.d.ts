/**
 * Editor globals, typed via @artemsemkin/elementor-types.
 */
import type { $e as EDollar, ElementorCommon, ElementorEditor } from '@artemsemkin/elementor-types'

declare global {
  const elementorCommon: ElementorCommon
  const elementor: ElementorEditor
  const $e: EDollar
}
