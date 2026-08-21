// @vitest-environment happy-dom

import { horizontalPercentage, pinProgress } from '@ts/motion-fx-compat'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section, setRect } from './support'

/**
 * The Pro compatibility seam. Pro derives every viewport-range scrolling effect
 * from one core utility whose answer stops changing while the section is
 * pinned; this module wraps it. The wrap is the risky part — it runs inside
 * Pro's rAF loop, so the dispatch has to be exactly right and nothing may
 * escape — and it is what the second half of this file exercises.
 *
 * Each dispatch test reloads the module: the install guard is module-scope, so
 * a second install against a fresh fake would silently no-op.
 */
const trackRect = { left: 0, right: 1000, width: 1000 }

/** The engine's measure() publishes exactly this shape. */
type TUpdateTrackState = (
  wrapper: HTMLElement,
  state: { active: boolean; inverted: boolean; insetStart: number; pinWindow: number }
) => void

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('horizontalPercentage', () => {
  const stageAndElement = (elementRect: { left: number; width: number }) => {
    const { wrapper } = section()
    const el = document.createElement('div')
    document.body.appendChild(el)
    setRect(wrapper, trackRect)
    setRect(el, elementRect)
    return { wrapper, el }
  }

  it('is 0 as the leading edge touches the stage', () => {
    const { wrapper, el } = stageAndElement({ left: 1000, width: 500 })

    expect(horizontalPercentage(el, wrapper, false)).toBe(0)
  })

  it('is 100 once the trailing edge has left it', () => {
    const { wrapper, el } = stageAndElement({ left: -500, width: 500 })

    expect(horizontalPercentage(el, wrapper, false)).toBe(100)
  })

  it('interpolates in between, rounded like core does', () => {
    const { wrapper, el } = stageAndElement({ left: 0, width: 500 })

    // (1000 - 0) / (1000 + 500) = 0.6666… → core keeps two decimals.
    expect(horizontalPercentage(el, wrapper, false)).toBe(66.67)
  })

  it('mirrors when the traversal is inverted', () => {
    const { wrapper, el } = stageAndElement({ left: 0, width: 500 })

    expect(horizontalPercentage(el, wrapper, true)).toBe(33.33)
  })

  it('is 0 rather than NaN when the stage has collapsed', () => {
    const { wrapper } = section()
    const el = document.createElement('div')
    setRect(wrapper, { left: 0, right: 0, width: 0 })
    setRect(el, { left: 0, width: 0 })

    expect(horizontalPercentage(el, wrapper, false)).toBe(0)
  })
})

describe('pinProgress', () => {
  const state = { active: true, inverted: false, insetStart: 0, pinWindow: 2200 }

  it('is 0 at pin engage', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: 0 })

    expect(pinProgress(wrapper, state)).toBe(0)
  })

  it('is 100 at pin release', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: -2200 })

    expect(pinProgress(wrapper, state)).toBe(100)
  })

  it('tracks the traversal in between', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: -1100 })

    expect(pinProgress(wrapper, state)).toBe(50)
  })

  it('accounts for a pin offset', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: 80 })

    expect(pinProgress(wrapper, { ...state, insetStart: 80 })).toBe(0)
  })

  it('clamps before the section is reached', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: 500 })

    expect(pinProgress(wrapper, state)).toBe(0)
  })

  it('has no answer without a pin window, and clamp01 does not invent one', () => {
    const { wrapper } = section()
    setRect(wrapper, { top: 0 })

    // Stated, not desired: the one caller gates on pinWindow > 0 before ever
    // reaching here, and a second caller has to do the same. Math.min/max pass
    // NaN straight through, so nothing downstream would flag it.
    expect(pinProgress(wrapper, { ...state, pinWindow: 0 })).toBeNaN()
  })
})

describe('the wrapped core utility', () => {
  const ORIGINAL_ANSWER = 42

  /** Install against a fresh fake of the one core utility Pro rides. */
  const patched = async () => {
    vi.resetModules()
    const original = vi.fn(
      (_$element: { 0?: Element }, _offsets?: { start?: number; end?: number }) => ORIGINAL_ANSWER
    )
    const scroll = { getElementViewportPercentage: original }
    vi.stubGlobal('elementorModules', { utils: { Scroll: scroll } })

    const { installMotionFx, updateTrackState } = await import('@ts/motion-fx-compat')
    installMotionFx()
    window.dispatchEvent(new Event('elementor/frontend/init'))

    return {
      original,
      updateTrackState,
      call: (el: unknown, offsets?: { start?: number; end?: number }) =>
        scroll.getElementViewportPercentage({ 0: el } as { 0?: Element }, offsets)
    }
  }

  /** An active section with a panel child whose rect puts it mid-stage. */
  const activeSection = (updateTrackState: TUpdateTrackState) => {
    const { wrapper, track, panels } = section({ panels: [{ left: 0, width: 500 }] })
    setRect(wrapper, trackRect)
    setRect(nth(panels, 0), { left: 0, width: 500 })
    updateTrackState(wrapper, {
      active: true,
      inverted: false,
      insetStart: 0,
      pinWindow: 2200
    })
    return { wrapper, track, panel: nth(panels, 0) }
  }

  it('leaves elements outside any section to the original', async () => {
    const { original, call } = await patched()
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)

    expect(call(orphan)).toBe(ORIGINAL_ANSWER)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('leaves a section that has never measured to the original', async () => {
    const { original, call } = await patched()
    const { panels } = section({ panels: [{ left: 0, width: 500 }] })

    expect(call(nth(panels, 0))).toBe(ORIGINAL_ANSWER)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('leaves an inactive section to the original', async () => {
    // Vertical states and zero travel: Pro's own vertical math is right again.
    const { original, updateTrackState, call } = await patched()
    const { wrapper, panel } = activeSection(updateTrackState)
    updateTrackState(wrapper, { active: false, inverted: false, insetStart: 0, pinWindow: 2200 })

    expect(call(panel)).toBe(ORIGINAL_ANSWER)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('answers content inside an active section with horizontal progress', async () => {
    const { original, updateTrackState, call } = await patched()
    const { panel } = activeSection(updateTrackState)

    expect(call(panel)).toBe(66.67)
    expect(original).not.toHaveBeenCalled()
  })

  it('answers Progress Tracker with true pin progress', async () => {
    // Its Selector mode queries the section itself with these signature
    // offsets; the horizontal mirror degenerates there (rect == stage).
    const { updateTrackState, call } = await patched()
    const { wrapper } = activeSection(updateTrackState)
    setRect(wrapper, { ...trackRect, top: -1100 })

    expect(call(wrapper, { start: 0, end: -100 })).toBe(50)
  })

  it('answers Progress Tracker pointed at the track the same way', async () => {
    const { updateTrackState, call } = await patched()
    const { wrapper, track } = activeSection(updateTrackState)
    setRect(wrapper, { ...trackRect, top: -2200 })

    expect(call(track, { start: 0, end: -100 })).toBe(100)
  })

  it('leaves the section itself to the original when no offsets are passed', async () => {
    // Motion FX passes none, and for it the wrapper is an ordinary tall block
    // whose vertical math already works.
    const { original, updateTrackState, call } = await patched()
    const { wrapper } = activeSection(updateTrackState)

    expect(call(wrapper)).toBe(ORIGINAL_ANSWER)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('falls back to the original rather than throwing into Pro rAF loop', async () => {
    // Nothing may escape: a throw here would kill every scrolling effect on
    // the page, not just ours.
    const { original, call } = await patched()
    const hostile = {
      closest: () => {
        throw new Error('realm mismatch')
      }
    }

    expect(call(hostile)).toBe(ORIGINAL_ANSWER)
    expect(original).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the core utility is absent', async () => {
    vi.resetModules()
    vi.stubGlobal('elementorModules', undefined)
    const { installMotionFx } = await import('@ts/motion-fx-compat')

    expect(() => {
      installMotionFx()
      window.dispatchEvent(new Event('elementor/frontend/init'))
    }).not.toThrow()
  })
})
