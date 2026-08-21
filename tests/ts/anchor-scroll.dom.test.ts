// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "navigation": { "disableMainFrameNavigation": true } } }

import { computeTargetScrollY, installAnchorScroll } from '@ts/anchor-scroll'
import { beforeAll, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { nth, section } from './support'

/**
 * Deep-linking into a panel. Elementor's anchor machinery is vertical-only and
 * every panel shares one vertical position while the section is pinned, so the
 * whole value of this module is turning a panel into a scroll POSITION. These
 * tests state the geometry rather than render it — happy-dom has no layout —
 * which is the right level anyway: what can break here is the arithmetic and
 * the guards, not the browser's box model.
 */

/** A measured section: 2000px of travel over a 2200px pin window at doc 1000. */
const measured = (over: Parameters<typeof section>[0] = {}) => {
  const built = section({
    viewport: 1000,
    trackWidth: 3000,
    runwayHeight: 3000,
    trackHeight: 800,
    docTop: 1000,
    panels: [
      { left: 0, width: 1000, id: 'one' },
      { left: 1000, width: 1000, id: 'two' },
      { left: 2000, width: 1000, id: 'three' }
    ],
    ...over
  })
  // A px value is the marker for "the engine has measured"; render() prints a
  // cqw calc() estimate into the very same property.
  built.wrapper.style.setProperty('--arts-hs-distance', '2000px')
  return built
}

// Installed once, as on a real page: the capture-phase click listener is
// attached at bundle evaluation, long before any section boots.
beforeAll(() => {
  installAnchorScroll()
})

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('computeTargetScrollY', () => {
  it('lands the first panel at pin engage', () => {
    const { wrapper, track, panels } = measured()

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBe(1000)
  })

  it('maps a mid panel to its share of the pin window', () => {
    const { wrapper, track, panels } = measured()

    expect(computeTargetScrollY(wrapper, track, nth(panels, 1))).toBe(2100)
  })

  it('lands the last panel at pin release', () => {
    const { wrapper, track, panels } = measured()

    expect(computeTargetScrollY(wrapper, track, nth(panels, 2))).toBe(3200)
  })

  it('mirrors the traversal when the direction is inverted', () => {
    const { wrapper, track, panels } = measured({ dir: -1 })

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBe(3200)
    expect(computeTargetScrollY(wrapper, track, nth(panels, 2))).toBe(1000)
  })

  it('subtracts the pin offset from the engage point', () => {
    const { wrapper, track, panels } = measured()
    track.style.top = '80px'

    // Engage happens 80px earlier, because the pin sticks 80px down.
    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBe(920)
  })

  it('clamps a panel that sits past the end of the travel', () => {
    const { wrapper, track, panels } = measured()
    Object.defineProperty(nth(panels, 2), 'offsetLeft', { value: 9000, configurable: true })

    expect(computeTargetScrollY(wrapper, track, nth(panels, 2))).toBe(3200)
  })

  it('defers to the browser before the engine has measured', () => {
    const { wrapper, track, panels } = measured()
    // The server-side estimate: non-empty, but not a measurement.
    wrapper.style.setProperty('--arts-hs-distance', 'calc(2 * 80cqw)')

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBeNull()
  })

  it('defers to the browser in a vertical state', () => {
    const { wrapper, track, panels } = measured({ sticky: false })

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBeNull()
  })

  it('defers to the browser when there is no travel', () => {
    const { wrapper, track, panels } = measured({ trackWidth: 600 })

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBeNull()
  })

  it('defers to the browser when the pin window has collapsed', () => {
    const { wrapper, track, panels } = measured({ runwayHeight: 800, trackHeight: 800 })

    expect(computeTargetScrollY(wrapper, track, nth(panels, 0))).toBeNull()
  })
})

describe('the click path', () => {
  let scrollTo: ReturnType<typeof vi.fn>
  let pushState: Mock<(data: unknown, unused: string, url?: string | URL | null) => void>

  beforeEach(() => {
    scrollTo = vi.fn()
    pushState = vi.fn((_data: unknown, _unused: string, _url?: string | URL | null): void => {})
    vi.stubGlobal('scrollTo', scrollTo)
    vi.spyOn(history, 'pushState').mockImplementation(pushState)
  })

  const linkTo = (hash: string): HTMLAnchorElement => {
    const anchor = document.createElement('a')
    anchor.href = hash
    document.body.appendChild(anchor)
    return anchor
  }

  const click = (anchor: HTMLAnchorElement, over: MouseEventInit = {}): MouseEvent => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...over })
    anchor.dispatchEvent(event)
    return event
  }

  it('takes over the navigation and scrolls to the panel', () => {
    measured()
    const event = click(linkTo('#two'))

    expect(event.defaultPrevented).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ top: 2100, behavior: 'smooth' })
    // pushState rather than assigning location.hash: a hash assignment fires a
    // native fragment scroll that would race ours under scroll-behavior: smooth.
    expect(pushState).toHaveBeenCalledWith(null, '', '#two')
  })

  it('leaves modified clicks to the browser', () => {
    measured()

    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      const event = click(linkTo('#two'), { [modifier]: true })
      expect(event.defaultPrevented, modifier).toBe(false)
    }
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves non-primary buttons alone', () => {
    measured()

    const event = click(linkTo('#two'), { button: 1 })

    expect(event.defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('ignores links that open in a new tab', () => {
    measured()
    const anchor = linkTo('#two')
    anchor.target = '_blank'

    expect(click(anchor).defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('ignores links pointing at another page', () => {
    measured()
    const anchor = linkTo('/elsewhere#two')

    expect(click(anchor).defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves section-level anchors to the browser', () => {
    // The hash resolves inside the widget but not to a panel — native
    // behaviour is already correct there.
    const { wrapper } = measured()
    wrapper.id = 'whole-section'

    expect(click(linkTo('#whole-section')).defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves anchors outside any section alone', () => {
    measured()
    const elsewhere = document.createElement('div')
    elsewhere.id = 'footer'
    document.body.appendChild(elsewhere)

    expect(click(linkTo('#footer')).defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stands down inside the editor preview', () => {
    vi.stubGlobal('elementorFrontend', { isEditMode: () => true })
    measured()

    expect(click(linkTo('#two')).defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('the page-load correction', () => {
  let scrollTo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Drain any load-repass listener a previous test armed but never fired,
    // before the fixture and the spy for this one exist.
    window.dispatchEvent(new Event('load'))
    document.body.innerHTML = ''
    history.replaceState(null, '', '#')
    // A cold load is the condition this code runs in — the bundle evaluates
    // well before `load` fires. Vitest hands us a document that is already
    // complete, which would make armLoadRepass return early and every repass
    // assertion below pass without exercising anything.
    Object.defineProperty(document, 'readyState', { value: 'interactive', configurable: true })
    scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
  })

  /** What Elementor fires once its frontend is up. */
  const frontendInit = () => window.dispatchEvent(new Event('elementor/frontend/init'))

  it('corrects the browser landing instantly', () => {
    // The browser has already scrolled to the section top by now — every panel
    // shares that position, so it is wrong for all but the first.
    measured()
    history.replaceState(null, '', '#two')

    frontendInit()

    // `instant`, never smooth: Elementor ships `scroll-behavior: smooth`, which
    // would turn this into a visible seconds-long ease on a cold load.
    expect(scrollTo).toHaveBeenCalledWith({ top: 2100, behavior: 'instant' })
  })

  it('waits for the section to measure before trusting the geometry', () => {
    const { wrapper } = measured()
    // The server-side estimate is in place but measure() has not run; the
    // runway height still rides that estimate, so the maths would be wrong.
    wrapper.style.setProperty('--arts-hs-distance', 'calc(2 * 80cqw)')
    history.replaceState(null, '', '#two')

    frontendInit()
    expect(scrollTo).not.toHaveBeenCalled()

    wrapper.style.setProperty('--arts-hs-distance', '2000px')
    wrapper.dispatchEvent(new CustomEvent('arts-hs:ready', { bubbles: true }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 2100, behavior: 'instant' })
  })

  it('leaves a hash that is not a panel to the browser', () => {
    measured()
    history.replaceState(null, '', '#nowhere')

    frontendInit()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stands down inside the editor preview', () => {
    vi.stubGlobal('elementorFrontend', { isEditMode: () => true })
    measured()
    history.replaceState(null, '', '#two')

    frontendInit()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('takes one more pass at window load', () => {
    // Layout above the section shifts as images arrive, and the browser re-runs
    // its own (wrong) fragment scroll late.
    measured()
    history.replaceState(null, '', '#two')
    frontendInit()
    scrollTo.mockClear()

    window.dispatchEvent(new Event('load'))

    expect(scrollTo).toHaveBeenCalledWith({ top: 2100, behavior: 'instant' })
  })

  it('abandons the repass once the visitor takes over scrolling', () => {
    measured()
    history.replaceState(null, '', '#two')
    frontendInit()
    scrollTo.mockClear()

    window.dispatchEvent(new Event('wheel'))
    window.dispatchEvent(new Event('load'))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('is not abandoned by a mere tap during load', () => {
    // touchmove, not touchstart: tapping while a phone loads is common and
    // must not cancel the correction.
    measured()
    history.replaceState(null, '', '#two')
    frontendInit()
    scrollTo.mockClear()

    window.dispatchEvent(new Event('touchstart'))
    window.dispatchEvent(new Event('load'))

    expect(scrollTo).toHaveBeenCalledWith({ top: 2100, behavior: 'instant' })
  })

  it('skips the repass entirely on an already-complete document', () => {
    // Nothing left to shift, and `load` may already have fired — arming would
    // never pay off.
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
    measured()
    history.replaceState(null, '', '#two')
    frontendInit()
    scrollTo.mockClear()

    window.dispatchEvent(new Event('load'))

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
