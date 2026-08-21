import { WIDGET_TYPE } from '@ts/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDollarE, fakeElementor, fakeElementorCommon } from '../support'

/**
 * The editor bundle's wiring. Both classes it pulls in extend an Elementor base
 * resolved at MODULE EVALUATION time, so every import here has to be dynamic
 * and preceded by the globals — the same shape engine.boot.dom.test.ts uses for
 * its module-scope feature probe.
 */

/** Every id the two guard modules claim, and nothing else. */
const GUARD_IDS = [
  'arts-hs-lock-panel-moves',
  'arts-hs-lock-repeater-sort',
  'arts-hs-lock-repeater-duplicate',
  'arts-hs-default-panel-width',
  'arts-hs-coerce-panel-width'
]

const loadModule = async () => (await import('@ts/editor/module')).default

beforeEach(() => {
  vi.resetModules()
})

describe('editor Module', () => {
  it('registers the element type under the widget type PHP renders', async () => {
    const { registeredTypes } = fakeElementor()
    fakeDollarE()

    ;new (await loadModule())()

    expect(registeredTypes).toHaveLength(1)
    expect(registeredTypes[0].getType()).toBe(WIDGET_TYPE)
  })

  it('hands the element type the View that locks panels', async () => {
    const { registeredTypes } = fakeElementor()
    fakeDollarE()

    ;new (await loadModule())()

    // Locking lives in filter(); that it is OUR view and not the bare base is
    // the only thing the Module itself decides.
    expect(typeof registeredTypes[0].getView().prototype.filter).toBe('function')
  })

  it('wraps the editor scroll helper', async () => {
    const { helpers } = fakeElementor()
    fakeDollarE()
    const original = helpers.scrollToView

    ;new (await loadModule())()

    expect(helpers.scrollToView).not.toBe(original)
  })

  it('registers every panel guard and nothing more', async () => {
    fakeElementor()
    const $e = fakeDollarE()

    ;new (await loadModule())()

    expect($e.registered.map((d) => d.getId()).sort()).toEqual([...GUARD_IDS].sort())
  })

  it('warns instead of throwing when the readiness event fires twice', async () => {
    // $e hook ids are once per page load; a second registration is a real
    // throw. dependency.ts contains it so the editor keeps working with the
    // guards from the first pass still installed.
    fakeElementor()
    fakeDollarE(false, { rejectDuplicateIds: true })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const Module = await loadModule()

    new Module()
    expect(() => new Module()).not.toThrow()

    // One per guard module: each contains its own registration loop.
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('editor bundle entry', () => {
  it('constructs the module when Elementor announces its nested-element types', async () => {
    const { registeredTypes } = fakeElementor()
    fakeDollarE()
    const handlers = fakeElementorCommon()

    // The editor entry is a side-effecting script with no static import or
    // export, which TypeScript does not consider a module.
    // @ts-expect-error TS2306
    await import('@ts/editor/index')

    const boot = handlers.get('elementor/nested-element-type-loaded')
    if (!boot) {
      throw new Error('the editor bundle never subscribed to the readiness event')
    }
    expect(registeredTypes).toHaveLength(0)

    await boot()

    expect(registeredTypes).toHaveLength(1)
  })
})
