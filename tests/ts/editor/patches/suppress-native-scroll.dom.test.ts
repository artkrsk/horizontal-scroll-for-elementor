// @vitest-environment happy-dom

import { suppressNativeScrollForPanels } from '@ts/editor/patches/suppress-native-scroll'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from '../../support'

/**
 * Elementor scrolls the preview to any selected element via
 * elementor.helpers.scrollToView. For content inside a pinned section that is
 * categorically wrong — panels live at a scroll PROGRESS, so "element top"
 * resolves to the section start for every one of them.
 *
 * One function is wrapped and one function is faked, which makes this the same
 * shape as the motion-fx test: what is asserted is our dispatch, never
 * Elementor's behaviour.
 */
type Helpers = { scrollToView?: (...args: any[]) => unknown }

const ORIGINAL_RESULT = 'elementor scrolled'

/** Install the suppression over a fake helpers object and hand both back. */
const install = (helpers: Helpers = {}) => {
  const original = vi.fn((..._args: any[]) => ORIGINAL_RESULT)
  const withScroll: Helpers = { scrollToView: original, ...helpers }
  vi.stubGlobal('elementor', { helpers: withScroll })

  suppressNativeScrollForPanels()

  return {
    original,
    /** Call whatever scrollToView is NOW — the wrapper replaced it. */
    scrollToView: (...args: any[]) => withScroll.scrollToView?.(...args)
  }
}

const panelSection = () => section({ panels: [{ left: 0, width: 1000, id: 'one' }] })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('suppressNativeScrollForPanels', () => {
  it('swallows a scroll to content inside a section', () => {
    const { panels } = panelSection()
    const { original, scrollToView } = install()

    expect(scrollToView({ 0: nth(panels, 0) })).toBeUndefined()
    expect(original).not.toHaveBeenCalled()
  })

  it('swallows a scroll to something deep inside a panel', () => {
    const { panels } = panelSection()
    const heading = document.createElement('h2')
    nth(panels, 0).appendChild(heading)
    const { original, scrollToView } = install()

    scrollToView({ 0: heading })

    expect(original).not.toHaveBeenCalled()
  })

  it('accepts a raw element as readily as a jQuery-ish wrapper', () => {
    const { panels } = panelSection()
    const { original, scrollToView } = install()

    scrollToView(nth(panels, 0))

    expect(original).not.toHaveBeenCalled()
  })

  it('leaves every other element to Elementor', () => {
    // Everything outside our widget keeps the editor's native behaviour.
    panelSection()
    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    const { original, scrollToView } = install()

    expect(scrollToView({ 0: elsewhere })).toBe(ORIGINAL_RESULT)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('forwards every argument it passes through', () => {
    panelSection()
    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    const { original, scrollToView } = install()
    const $element = { 0: elsewhere }

    scrollToView($element, 400, 'ease')

    expect(original).toHaveBeenCalledWith($element, 400, 'ease')
  })

  it('passes through anything that is not element-like', () => {
    // Duck-typed on purpose: preview elements belong to the iframe realm, so
    // an instanceof check would be false for the very elements we care about.
    panelSection()
    const { original, scrollToView } = install()

    scrollToView(undefined)
    scrollToView({ 0: { nodeName: 'DIV' } })

    expect(original).toHaveBeenCalledTimes(2)
  })

  it('does nothing when Elementor exposes no helpers', () => {
    vi.stubGlobal('elementor', undefined)

    expect(() => suppressNativeScrollForPanels()).not.toThrow()
  })

  it('does nothing when scrollToView is not there to wrap', () => {
    const helpers: Helpers = {}
    vi.stubGlobal('elementor', { helpers })

    expect(() => suppressNativeScrollForPanels()).not.toThrow()
    // And it must not invent one — Elementor would then call a function it
    // never installed.
    expect(helpers.scrollToView).toBeUndefined()
  })
})
