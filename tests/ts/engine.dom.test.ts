// @vitest-environment happy-dom

import { measure, stampPanelRanges } from '@ts/engine'
import { updateTrackState } from '@ts/motion-fx-compat'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from './support'

/**
 * The measuring half of the engine. The boot/tier half needs control over
 * module-scope SUPPORTS_NATIVE and lives in engine.boot.dom.test.ts.
 *
 * motion-fx-compat is mocked here so the track state measure() publishes is
 * assertable directly — the `active` gate in particular, which is what stops
 * the horizontal correction from firing in a vertical state.
 */
vi.mock('@ts/motion-fx-compat', () => ({ updateTrackState: vi.fn() }))

/** The track state measure() last published. */
const lastState = () => vi.mocked(updateTrackState).mock.lastCall?.[1]

const panelVars = (panel: HTMLElement) => [
  panel.style.getPropertyValue('--arts-hs-panel-start'),
  panel.style.getPropertyValue('--arts-hs-panel-end')
]

beforeEach(() => {
  document.body.innerHTML = ''
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Three full-viewport panels on a 1000px scrollport: 2000px of travel. */
const threePanels = () =>
  section({
    viewport: 1000,
    trackWidth: 3000,
    panels: [
      { left: 0, width: 1000 },
      { left: 1000, width: 1000 },
      { left: 2000, width: 1000 }
    ]
  })

describe('stampPanelRanges', () => {
  it('stamps the window during which each panel crosses the scrollport', () => {
    const { wrapper, track, panels } = threePanels()

    stampPanelRanges(wrapper, track, 2000, false)

    // Panel 1 is already on stage at scrub 0, so its entry clamps to 0.
    expect(panelVars(nth(panels, 0))).toEqual(['0.000%', '50.000%'])
    expect(panelVars(nth(panels, 1))).toEqual(['0.000%', '100.000%'])
    // The last panel never fully leaves, so its exit clamps to 100.
    expect(panelVars(nth(panels, 2))).toEqual(['50.000%', '100.000%'])
  })

  it('mirrors the window when the traversal is inverted', () => {
    const { wrapper, track, panels } = threePanels()

    stampPanelRanges(wrapper, track, 2000, true)

    expect(panelVars(nth(panels, 0))).toEqual(['50.000%', '100.000%'])
    expect(panelVars(nth(panels, 1))).toEqual(['0.000%', '100.000%'])
    expect(panelVars(nth(panels, 2))).toEqual(['0.000%', '50.000%'])
  })

  it('gives every panel the whole range when there is no travel', () => {
    // Zero distance is a vertical state or a single short panel: the section
    // is an ordinary block and every panel is "on stage" for all of it.
    const { wrapper, track, panels } = threePanels()

    stampPanelRanges(wrapper, track, 0, false)

    for (const panel of panels) {
      expect(panelVars(panel)).toEqual(['0.000%', '100.000%'])
    }
  })

  it('skips children that are not HTML elements', () => {
    // An SVG element is a child element but not an HTMLElement, which is the
    // shape this guard exists for — text nodes never reach `.children`.
    const { wrapper, track, panels } = threePanels()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    track.appendChild(svg)

    expect(() => stampPanelRanges(wrapper, track, 2000, false)).not.toThrow()
    expect(svg.getAttribute('style')).toBeNull()
    expect(panelVars(nth(panels, 0))).toEqual(['0.000%', '50.000%'])
  })
})

describe('measure', () => {
  it('publishes the measured distance and inset as pixels', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 3000, docTop: 500 })
    track.style.top = '80px'

    measure(wrapper, track)

    // A px value is what marks the distance as MEASURED — render() prints a
    // cqw-based calc() estimate into the same property.
    expect(wrapper.style.getPropertyValue('--arts-hs-distance')).toBe('2000px')
    expect(wrapper.style.getPropertyValue('--arts-hs-inset-start')).toBe('80px')
  })

  it('reports the track as active while it is pinned and has travel', () => {
    const { wrapper, track } = threePanels()

    measure(wrapper, track)

    expect(updateTrackState).toHaveBeenLastCalledWith(wrapper, {
      active: true,
      inverted: false,
      insetStart: 0,
      pinWindow: 2200
    })
  })

  it('reports inactive in a vertical state, handing Pro back its own math', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 3000, sticky: false })

    measure(wrapper, track)

    expect(lastState()?.active).toBe(false)
  })

  it('reports inactive when there is no travel', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 600 })

    measure(wrapper, track)

    expect(lastState()?.active).toBe(false)
  })

  it('carries the inverted flag through to the correction', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 3000, dir: -1 })

    measure(wrapper, track)

    expect(lastState()?.inverted).toBe(true)
  })

  it('nudges Pro to re-measure once per burst', () => {
    const trigger = vi.fn()
    vi.stubGlobal('elementorFrontend', { elements: { $window: { trigger } } })
    const { wrapper, track } = threePanels()

    // A ResizeObserver burst during image/font load is the case this debounce
    // exists for.
    measure(wrapper, track)
    measure(wrapper, track)
    measure(wrapper, track)
    vi.advanceTimersByTime(100)

    expect(trigger).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('elementor-pro/motion-fx/recalc')
  })

  it('survives a page with no Motion FX listener at all', () => {
    const { wrapper, track } = threePanels()

    measure(wrapper, track)

    expect(() => vi.advanceTimersByTime(100)).not.toThrow()
  })
})
