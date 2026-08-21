import { expect, test } from '@playwright/test'

/**
 * The frontend smoke tier: does the section actually pin, and does the track
 * actually move? Neither question can be asked anywhere else in this repo —
 * happy-dom has no layout and no scroll, so every offset the unit suite reads
 * is one the fixture stated rather than the browser computed.
 *
 * Chromium answers on the native tier and Firefox, today, on the polyfilled
 * one. The tier is deliberately not asserted: what the contract promises is a
 * pinned, scrubbing section, both paths owe the visitor exactly that, and the
 * day Firefox ships scroll-driven animations this same file simply starts
 * covering the other tier instead of failing.
 */

const DEMO = '/ahs-demo/'

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)

  // The engine boots on element_ready and, under the polyfill, only after the
  // shared loader's readiness promise settles. A non-null timeline is the same
  // signal arts-hs:ready carries, and survives having been dispatched already.
  await page.waitForFunction(() => {
    const wrapper = document.querySelector('.js-arts-hs')
    return Boolean(wrapper && window.ARTS_HS?.getTimeline?.(wrapper))
  })
})

test('pins the track and publishes its measured travel', async ({ page }) => {
  const state = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('.js-arts-hs')
    const track = wrapper?.querySelector<HTMLElement>('.js-arts-hs__track')
    if (!wrapper || !track) {
      throw new Error('the demo page rendered no horizontal scroll section')
    }

    return {
      position: getComputedStyle(track).position,
      // Inline, and read from style rather than computed: render() prints a
      // cqw-based calc() estimate on this same property as the no-JS fallback,
      // so a plain px value is what proves measure() has run.
      distance: wrapper.style.getPropertyValue('--arts-hs-distance'),
      panels: Array.from(track.children).map((panel) => {
        const styles = getComputedStyle(panel)
        return {
          start: styles.getPropertyValue('--arts-hs-panel-start').trim(),
          end: styles.getPropertyValue('--arts-hs-panel-end').trim()
        }
      })
    }
  })

  expect(state.position).toBe('sticky')
  expect(state.distance).toMatch(/^\d+(\.\d+)?px$/)
  expect(Number.parseFloat(state.distance)).toBeGreaterThan(0)

  // Every panel carries its own stage window, inherited by everything inside it
  // — the pair the README's per-panel recipe is written against.
  expect(state.panels.length).toBeGreaterThan(1)
  for (const panel of state.panels) {
    expect(panel.start).toMatch(/%$/)
    expect(panel.end).toMatch(/%$/)
  }
})

test('scrubs the track across the pin window without scrolling the page sideways', async ({
  page
}) => {
  const travel = await page.evaluate(async () => {
    /** Two frames: one for the scroll to land, one for the timeline to paint. */
    const settle = (): Promise<void> =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const wrapper = document.querySelector<HTMLElement>('.js-arts-hs')
    const track = wrapper?.querySelector<HTMLElement>('.js-arts-hs__track')
    if (!wrapper || !track) {
      throw new Error('the demo page rendered no horizontal scroll section')
    }

    const pinWindow = wrapper.offsetHeight - track.offsetHeight
    const engage = wrapper.getBoundingClientRect().top + window.scrollY

    // instant, never smooth: Elementor's frontend CSS sets scroll-behavior:
    // smooth on html, which would turn each of these into a seconds-long ease.
    window.scrollTo({ top: engage, behavior: 'instant' })
    await settle()
    const atEngage = track.getBoundingClientRect().x

    window.scrollTo({ top: engage + pinWindow / 2, behavior: 'instant' })
    await settle()
    const midway = track.getBoundingClientRect().x

    return {
      pinWindow,
      atEngage,
      midway,
      pageScrolledSideways: document.documentElement.scrollLeft
    }
  })

  expect(travel.pinWindow).toBeGreaterThan(0)
  // LTR traversal moves the track left as the pin progresses.
  expect(travel.midway).toBeLessThan(travel.atEngage)
  // The runway clips rather than scrolls — a scroll container here would
  // hijack the sticky scrollport and kill the pin outright.
  expect(travel.pageScrolledSideways).toBe(0)
})
