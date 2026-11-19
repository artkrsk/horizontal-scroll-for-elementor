// @vitest-environment happy-dom

import { installFocusScroll } from '@ts/focus-scroll'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section, setGeometry, setRect } from './support'

/**
 * Keyboard focus inside the track. The browser cannot scroll a control the
 * scrub parked off stage into view, so the module turns "where the control is
 * on screen" into a document scrollY. happy-dom has no layout and no focus
 * scroll of its own: the rects are stated, and what these tests pin is the
 * arithmetic, the gates and the two-frame wait. That a real Tab press ends
 * with the control on stage is the browser tier's to prove (06-keyboard-focus).
 */

/** The frames the module asked for; nothing runs until a test lets one pass. */
let frames: FrameRequestCallback[]
let scrollTo: ReturnType<typeof vi.fn>
let lifetime: AbortController

/** One frame passes: every callback queued so far runs, and what those queue waits for the next. */
const frame = (): void => {
  for (const callback of frames.splice(0)) {
    callback(0)
  }
}

/** The two frames the module lets pass before it looks at a focused control. */
const settle = (): void => {
  frame()
  frame()
}

const at = (scrollY: number): void => {
  vi.stubGlobal('scrollY', scrollY)
}

/** The scroll that brings a control in. closeTo: the progress fractions are not exact in binary. */
const movedTo = (top: number) => ({ top: expect.closeTo(top, 6), behavior: 'auto' })

/** The browser reports that scrolling has ended, as it does after a smooth scroll lands. */
const land = (): void => {
  window.dispatchEvent(new Event('scrollend'))
}

/**
 * A measured section on a 1000px stage: 2000px of travel over a 2200px pin
 * window, engaging at scrollY 1000 and releasing at 3200.
 */
const measured = (over: Parameters<typeof section>[0] = {}) => {
  const built = section({
    viewport: 1000,
    trackWidth: 3000,
    runwayHeight: 3000,
    trackHeight: 800,
    docTop: 1000,
    panels: [
      { left: 0, width: 1000 },
      { left: 1000, width: 1000 },
      { left: 2000, width: 1000 }
    ],
    ...over
  })
  built.wrapper.style.setProperty('--arts-hs-distance', '2000px')
  setRect(built.wrapper, { left: 0, right: 1000, width: 1000 })
  return built
}

/** Where the control is on screen: its left edge against the stage's, and its width. */
const place = (el: HTMLElement, left: number, width: number): void => {
  setRect(el, { left, right: left + width, width })
}

/**
 * A button in the track at the given on-screen place. `keyboard: false` is a
 * control focused by the pointer, which never matches :focus-visible.
 */
const control = (
  track: HTMLElement,
  left: number,
  width = 200,
  { keyboard = true }: { keyboard?: boolean } = {}
): HTMLButtonElement => {
  const button = document.createElement('button')
  nth(Array.from(track.children), 0).appendChild(button)
  // A layout-tree path to the track: without one the range math answers null.
  setGeometry(button, { offsetLeft: 0, offsetWidth: width })
  Object.defineProperty(button, 'offsetParent', { value: track, configurable: true })
  place(button, left, width)
  const matches = button.matches.bind(button)
  vi.spyOn(button, 'matches').mockImplementation((selector) =>
    selector === ':focus-visible' ? keyboard : matches(selector)
  )
  return button
}

/** Focus lands and the frames the module waits for pass. */
const tabTo = (el: HTMLElement): void => {
  el.focus()
  settle()
}

beforeEach(() => {
  document.body.innerHTML = ''
  frames = []
  scrollTo = vi.fn()
  lifetime = new AbortController()
  vi.stubGlobal('scrollTo', scrollTo)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  at(1000)
  installFocusScroll(lifetime.signal)
})

afterEach(() => {
  lifetime.abort()
  vi.unstubAllGlobals()
})

describe('bringing a focused control on stage', () => {
  it('centres a control parked past the stage end', () => {
    const { track } = measured()

    // Centre at 1500, the stage's at 500: half the travel away from engage.
    tabTo(control(track, 1400))

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(movedTo(2100))
  })

  it('centres a control the scrub has already carried past the stage start', () => {
    const { track } = measured()
    at(3200)

    tabTo(control(track, -1100))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1550))
  })

  it('brings a control cut by the stage edge fully in', () => {
    const { track } = measured()
    at(2100)

    tabTo(control(track, -50))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1605))
  })

  it('stops at pin release when the centre lies beyond the travel', () => {
    const { track } = measured()
    at(2100)

    tabTo(control(track, 1800))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(3200))
  })

  it('stops at pin engage when the centre lies before the travel', () => {
    const { track } = measured()
    at(2100)

    tabTo(control(track, -1000))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1000))
  })

  it('counts from engage while the section has not pinned yet', () => {
    const { track } = measured()
    at(400)

    tabTo(control(track, 1400))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(2100))
  })

  it('counts from release once the section has scrolled past its pin', () => {
    const { track } = measured()
    at(5000)

    tabTo(control(track, -1100))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1550))
  })

  it('measures against the stage, wherever the stage sits in the viewport', () => {
    const { wrapper, track } = measured()
    setRect(wrapper, { left: 200, right: 1200, width: 1000 })

    // Centre at 1700, the stage's at 700.
    tabTo(control(track, 1600))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(2100))
  })

  it('mirrors the traversal when the direction is inverted', () => {
    const { track } = measured({ dir: -1 })
    at(3200)

    // To the right of the stage, which an inverted traversal reaches by scrolling back.
    tabTo(control(track, 1400))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(2100))
  })

  it('scrolls forward for a control to the left of an inverted stage', () => {
    const { track } = measured({ dir: -1 })

    tabTo(control(track, -600))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(2100))
  })
})

describe('a control already on stage', () => {
  it('leaves the page where it is', () => {
    const { track } = measured()

    tabTo(control(track, 100))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('treats a control exactly as wide as the stage as on stage', () => {
    const { track } = measured()

    tabTo(control(track, 0, 1000))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('accepts a subpixel overhang at either edge', () => {
    const { track } = measured()

    tabTo(control(track, -0.5))
    tabTo(control(track, 800.5))

    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('a control wider than the stage', () => {
  it('leads with its left edge', () => {
    const { track } = measured()

    tabTo(control(track, 400, 1600))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1440))
  })

  it('leads with its right edge when the direction is inverted', () => {
    const { track } = measured({ dir: -1 })

    tabTo(control(track, -1000, 1600))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1440))
  })

  it('stays put once it spans the stage', () => {
    const { track } = measured()

    tabTo(control(track, -200, 1600))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('still moves when only one edge is covered', () => {
    const { track } = measured()
    at(2100)

    // Covers the stage start, ends 200px short of the stage end.
    tabTo(control(track, -800, 1600))

    expect(scrollTo).toHaveBeenCalledWith(movedTo(1220))
  })
})

describe('the frames it waits for', () => {
  it('scrolls neither inside the focus event nor in the frame after it', () => {
    const { track } = measured()

    control(track, 1400).focus()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(frames).toHaveLength(1)

    // WebKit's own focus scroll lands in this one and would replace ours.
    frame()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(frames).toHaveLength(1)

    frame()
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('reads the control where it is by then, not where it was at focus', () => {
    const { track } = measured()
    const button = control(track, 1400)

    button.focus()
    // What a carousel or inner scroller in the panel does in between: its own
    // focus scroll has already brought the control into view.
    place(button, 300, 200)
    settle()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('drops a control focus has already left', () => {
    const { track } = measured()
    const first = control(track, 1400)
    const second = control(track, 100)

    first.focus()
    second.focus()
    settle()

    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('a scroll of ours still in flight', () => {
  it('is given an on-stage control as its new destination', () => {
    const { track } = measured()
    const far = control(track, 1400)
    const near = control(track, 100)

    at(2100)
    tabTo(far)
    // Shift+Tab before the landing: the page is on its way to release and
    // would carry the control off stage again.
    at(2300)
    tabTo(near)

    // Centre at 200, the stage's at 500, from where the page is by then.
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo).toHaveBeenLastCalledWith(movedTo(1970))
  })

  it('leads a control that spans the stage with its edge then, too', () => {
    const { track } = measured()
    const far = control(track, 1400)
    const wide = control(track, -300, 1600)

    at(2100)
    tabTo(far)
    at(2210)
    tabTo(wide)

    expect(scrollTo).toHaveBeenLastCalledWith(movedTo(1880))
  })

  it('is over once the browser reports the landing', () => {
    const { track } = measured()
    const far = control(track, 1400)
    const near = control(track, 100)

    tabTo(far)
    at(2100)
    land()
    tabTo(near)

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not outlive its landing to redirect a scroll that is not ours', () => {
    const { track } = measured()
    const far = control(track, 1400)
    const last = control(track, 100)
    const outside = document.createElement('button')
    document.body.appendChild(outside)

    tabTo(far)
    land()
    // Focus leaves the section, the browser scrolls after it, and Shift+Tab
    // comes back to a control on stage: that scroll is the browser's to finish.
    outside.focus()
    at(5000)
    tabTo(last)

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('is not counted when the control already has its place: nothing moves, nothing lands', () => {
    const { track } = measured()
    at(3200)

    // Past the track's end, where the travel cannot follow: the place is release itself.
    tabTo(control(track, 1400))
    tabTo(control(track, 100))

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(movedTo(3200))
  })

  it('gives way to the next control when that one is off stage too', () => {
    const { track } = measured()
    const far = control(track, 1400)
    const farther = control(track, 1400)

    tabTo(far)
    // 300px of scroll is ~273px of travel: the next control is still off stage.
    at(1300)
    place(farther, 1700, 200)
    tabTo(farther)

    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo).toHaveBeenLastCalledWith(movedTo(2730))
  })

  it('is never assumed where the browser has no scrollend to end it', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'onscrollend')
    Reflect.deleteProperty(window, 'onscrollend')
    try {
      expect('onscrollend' in window).toBe(false)
      lifetime.abort()
      lifetime = new AbortController()
      installFocusScroll(lifetime.signal)
      const { track } = measured()
      const far = control(track, 1400)
      const near = control(track, 100)

      tabTo(far)
      at(1300)
      tabTo(near)

      expect(scrollTo).toHaveBeenCalledTimes(1)
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'onscrollend', descriptor)
      }
    }
  })
})

describe('what it leaves to the browser', () => {
  it('ignores focus outside any section', () => {
    measured()
    const outside = document.createElement('button')
    document.body.appendChild(outside)

    outside.focus()

    expect(frames).toHaveLength(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('ignores a focus event whose target is no element', () => {
    measured()

    document.dispatchEvent(new FocusEvent('focusin'))

    expect(frames).toHaveLength(0)
  })

  it('ignores a control focused by the pointer', () => {
    const { track } = measured()

    // Scrolling it from under the cursor mid-click would cancel the click.
    tabTo(control(track, 1400, 200, { keyboard: false }))

    expect(frames).toHaveLength(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stands down inside the editor canvas', () => {
    const { track } = measured()
    vi.stubGlobal('elementorFrontend', { isEditMode: () => true })

    tabTo(control(track, 1400))

    expect(frames).toHaveLength(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves a stacked section to the native focus scroll', () => {
    const { track } = measured({ sticky: false })

    tabTo(control(track, 1400))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('waits for the first measure', () => {
    const { wrapper, track } = measured()
    wrapper.style.setProperty('--arts-hs-distance', 'calc(2 * 80cqw)')

    tabTo(control(track, 1400))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('skips a control with no place in the traversal', () => {
    const { track } = measured()
    const fixed = control(track, 1400)
    // position: fixed — its offsetParent chain never reaches the track.
    Object.defineProperty(fixed, 'offsetParent', { value: null, configurable: true })

    tabTo(fixed)

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('ignores focus on the section itself', () => {
    const { wrapper } = measured()
    wrapper.tabIndex = 0
    vi.spyOn(wrapper, 'matches').mockReturnValue(true)

    tabTo(wrapper)

    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('the listeners', () => {
  it('hear a focus event the page stopped from bubbling', () => {
    const { wrapper, track } = measured()
    wrapper.addEventListener('focusin', (event) => event.stopPropagation())

    tabTo(control(track, 1400))

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('go away with the app lifetime', () => {
    const { track } = measured()
    lifetime.abort()

    tabTo(control(track, 1400))

    expect(frames).toHaveLength(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('drop the frames they were waiting for when the lifetime ends first', () => {
    const { track } = measured()

    control(track, 1400).focus()
    frame()
    lifetime.abort()
    frame()

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
