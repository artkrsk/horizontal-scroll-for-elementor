import { expect, type Page, test } from '@playwright/test'

/**
 * Keyboard focus inside the track, with real key presses. The unit tier states
 * the rects and pins the arithmetic; what only a browser can show is that Tab
 * ends with the focused control on stage — the browser's own focus scroll has
 * nothing to move behind the runway's `overflow-x: clip` — and that the
 * engine's scroll and the browser's vertical one do not fight.
 *
 * The fixture page (tests/e2e/fixtures/keyboard-page.php) carries the controls:
 * none of them animated, since an Elementor entrance animation keeps a control
 * out of the tab order until it has been revealed. The polyfilled tier has its
 * own case in 04-standalone.
 */

const FIXTURE = '/ahs-keyboard/'

/** Every focusable control on the fixture page, in document order. */
const CONTROLS = [
  { name: 'before', selector: '#kb-before a', inTrack: false },
  { name: 'one', selector: '#kb-one-button a', inTrack: true },
  { name: 'two-left', selector: '#kb-two-left a', inTrack: true },
  { name: 'two-right', selector: '#kb-two-right a', inTrack: true },
  { name: 'wide-start', selector: '#kb-wide-start a', inTrack: true },
  { name: 'wide-middle', selector: '#kb-wide-middle a', inTrack: true },
  { name: 'wide-end', selector: '#kb-wide-end a', inTrack: true },
  { name: 'input', selector: '#kb-input', inTrack: true },
  { name: 'link', selector: '#kb-link', inTrack: true },
  { name: 'banner', selector: '#kb-banner-link', inTrack: true },
  { name: 'last', selector: '#kb-last-button a', inTrack: true },
  { name: 'after', selector: '#kb-after a', inTrack: false }
] as const

type TControl = (typeof CONTROLS)[number]['name']

const selectorOf = (name: TControl): string => {
  const control = CONTROLS.find((entry) => entry.name === name)
  if (!control) {
    throw new Error(`the fixture page has no control "${name}"`)
  }
  return control.selector
}

declare global {
  interface Window {
    /** Scroll events since the document started, counted by an init script. */
    __hsScrolls?: number
    /** Set by the pointer case's click listener. */
    __hsClicked?: boolean
  }
}

const waitForEngine = (page: Page) =>
  page.waitForFunction(() => {
    const wrapper = document.querySelector('.js-arts-hs')
    return Boolean(wrapper && window.artsHorizontalScroll?.getTimeline(wrapper))
  })

/** Resolves once the page has stood still for a run of frames, so a smooth scroll has landed. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY
        let still = 0
        const tick = (): void => {
          still = window.scrollY === last ? still + 1 : 0
          last = window.scrollY
          if (still >= 12) {
            resolve()
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      })
  )

/** Where a control is, measured from the stage's left edge and the viewport's top. */
const read = (page: Page, name: TControl) =>
  page.evaluate((selector) => {
    const el = document.querySelector<HTMLElement>(selector)
    const stage = document.querySelector<HTMLElement>('.js-arts-hs')
    if (!el || !stage) {
      throw new Error(`the fixture page rendered no "${selector}" or no section`)
    }
    const box = el.getBoundingClientRect()
    const view = stage.getBoundingClientRect()
    return {
      focused: document.activeElement === el,
      left: box.left - view.left,
      right: box.right - view.left,
      centre: box.left + box.width / 2 - (view.left + view.width / 2),
      stage: view.width,
      top: box.top,
      bottom: box.bottom,
      viewport: window.innerHeight,
      scrollY: window.scrollY
    }
  }, selectorOf(name))

type TPlace = Awaited<ReturnType<typeof read>>

const expectInView = (place: TPlace): void => {
  expect(place.top).toBeGreaterThanOrEqual(0)
  expect(place.bottom).toBeLessThanOrEqual(place.viewport)
}

const expectOnStage = (place: TPlace): void => {
  expect(place.left).toBeGreaterThanOrEqual(-1)
  expect(place.right).toBeLessThanOrEqual(place.stage + 1)
  expectInView(place)
}

const press = async (page: Page, key: 'Tab' | 'Shift+Tab'): Promise<void> => {
  await page.keyboard.press(key)
  await settle(page)
}

/** Presses the key until focus is on the control, letting every scroll land on the way. */
const walkTo = async (
  page: Page,
  name: TControl,
  key: 'Tab' | 'Shift+Tab' = 'Tab'
): Promise<TPlace> => {
  for (let presses = 0; presses <= CONTROLS.length; presses++) {
    const place = await read(page, name)
    if (place.focused) {
      return place
    }
    await press(page, key)
  }
  throw new Error(`focus never reached "${name}"`)
}

const pinWindow = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector('.js-arts-hs__track > *')
    const range = panel ? window.artsHorizontalScroll?.getScrollRange(panel) : null
    if (!range) {
      throw new Error('the section has not measured')
    }
    return { engage: range.engage, release: range.release, distance: range.distance }
  })

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__hsScrolls = 0
    window.addEventListener('scroll', () => {
      window.__hsScrolls = (window.__hsScrolls ?? 0) + 1
    })
  })
  await page.goto(FIXTURE)
  await waitForEngine(page)
})

test.describe('with reduced motion', () => {
  // Elementor's `html { scroll-behavior: smooth }` sits behind
  // prefers-reduced-motion: no-preference, so every scroll here is one jump.
  test.use({ reducedMotion: 'reduce' })

  test('Tab reaches every control in order and each one ends on stage', async ({ page }) => {
    const places: Partial<Record<TControl, TPlace>> = {}

    for (const control of CONTROLS) {
      await press(page, 'Tab')
      const place = await read(page, control.name)
      expect(place.focused, `Tab landed on "${control.name}"`).toBe(true)
      if (control.name === 'banner') {
        // Wider than the stage: its leading edge is what gets brought in.
        expect(Math.abs(place.left)).toBeLessThanOrEqual(2)
        expectInView(place)
      } else if (control.inTrack) {
        expectOnStage(place)
      } else {
        expectInView(place)
      }
      places[control.name] = place
    }

    // A control that was on stage already does not move the page.
    expect(places.input?.scrollY).toBe(places['wide-end']?.scrollY)
    expect(places.link?.scrollY).toBe(places.input?.scrollY)
  })

  test('Shift+Tab walks back and each control ends on stage', async ({ page }) => {
    await walkTo(page, 'after')

    for (const control of [...CONTROLS].reverse().slice(1)) {
      await press(page, 'Shift+Tab')
      const place = await read(page, control.name)
      expect(place.focused, `Shift+Tab landed on "${control.name}"`).toBe(true)
      if (control.name === 'banner') {
        expectInView(place)
      } else if (control.inTrack) {
        // "last" is the case a remembered scroll once broke: focus comes back
        // from below the section and the browser's vertical scroll must finish.
        expectOnStage(place)
      } else {
        expectInView(place)
      }
    }
  })

  test('centres a control it had to bring in, inside the pin window', async ({ page }) => {
    const { engage, release } = await pinWindow(page)

    const place = await walkTo(page, 'two-left')

    expect(Math.abs(place.centre)).toBeLessThanOrEqual(2)
    expect(place.scrollY).toBeGreaterThan(engage)
    expect(place.scrollY).toBeLessThan(release)
  })

  test('moves in one jump', async ({ page }) => {
    await walkTo(page, 'one')
    const before = await page.evaluate(() => window.__hsScrolls ?? 0)

    await press(page, 'Tab')

    expect((await read(page, 'two-left')).focused).toBe(true)
    expect(await page.evaluate(() => window.__hsScrolls ?? 0)).toBe(before + 1)
  })

  test('leaves a control focused by the pointer where it is', async ({ page }) => {
    // Park "Two, left" half past the stage end, its left half still clickable.
    await page.evaluate((selector) => {
      const el = document.querySelector<HTMLElement>(selector)
      const stage = document.querySelector<HTMLElement>('.js-arts-hs')
      const range = el ? window.artsHorizontalScroll?.getScrollRange(el) : null
      if (!el || !stage || !range) {
        throw new Error('the section has not measured')
      }
      el.addEventListener('click', (event) => {
        // The fixture's buttons link to "#", which would scroll to the top.
        event.preventDefault()
        window.__hsClicked = true
      })
      const half = el.offsetWidth / 2
      const scrollPerPx = (range.release - range.engage) / range.distance
      // Measured at the top of the page, where the track has not moved yet:
      // the travel counts from pin engage.
      const travel = el.getBoundingClientRect().left - stage.getBoundingClientRect().right + half
      window.scrollTo({ top: range.engage + travel * scrollPerPx, behavior: 'instant' })
    }, selectorOf('two-left'))
    await settle(page)
    const parked = await read(page, 'two-left')
    expect(parked.left).toBeLessThan(parked.stage)
    expect(parked.right).toBeGreaterThan(parked.stage + 10)

    await page.mouse.click((parked.left + parked.stage) / 2, (parked.top + parked.bottom) / 2)
    await settle(page)

    const after = await read(page, 'two-left')
    expect(await page.evaluate(() => window.__hsClicked)).toBe(true)
    expect(after.scrollY).toBe(parked.scrollY)
  })
})

test.describe('where the page scrolls smoothly', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('paces the move with the page scroll-behavior and lands on stage', async ({ page }) => {
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
    ).toBe('smooth')
    await walkTo(page, 'one')
    const before = await page.evaluate(() => window.__hsScrolls ?? 0)

    await press(page, 'Tab')

    const place = await read(page, 'two-left')
    expect(place.focused).toBe(true)
    expectOnStage(place)
    expect(Math.abs(place.centre)).toBeLessThanOrEqual(2)
    // A flight, not a jump.
    expect(await page.evaluate(() => window.__hsScrolls ?? 0)).toBeGreaterThan(before + 3)
  })

  test('a step back during the flight keeps that control on stage', async ({ page }) => {
    const start = await walkTo(page, 'two-left')

    // Off to "Two, right", a screen of travel away, and back once the flight is
    // under way. Whether "Two, left" is still on stage by then is the browser's
    // pace to decide; either way the page must come back to it.
    await page.keyboard.press('Tab')
    await page.waitForFunction((from) => window.scrollY > from + 10, start.scrollY)
    await page.keyboard.press('Shift+Tab')
    await settle(page)

    const back = await read(page, 'two-left')
    expect(back.focused).toBe(true)
    expectOnStage(back)
    expect(Math.abs(back.centre)).toBeLessThanOrEqual(2)
    expect(Math.abs(back.scrollY - start.scrollY)).toBeLessThanOrEqual(2)
  })
})

test.describe('in a stacked section', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Firefox has no touch emulation')
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 900, height: 800 },
    reducedMotion: 'reduce'
  })

  test('the browser scrolls each control into view and the engine stays out', async ({ page }) => {
    expect(
      await page.evaluate(() => {
        const track = document.querySelector('.js-arts-hs__track')
        return track ? getComputedStyle(track).position : null
      })
    ).toBe('static')

    for (const control of CONTROLS) {
      await press(page, 'Tab')
      const place = await read(page, control.name)
      expect(place.focused, `Tab landed on "${control.name}"`).toBe(true)
      // Banner aside: stacked, it is as wide as the section and may be taller than the viewport's remainder.
      expect(place.bottom).toBeGreaterThan(0)
      expect(place.top).toBeLessThan(place.viewport)
    }
  })
})
