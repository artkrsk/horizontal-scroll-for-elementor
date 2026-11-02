import { expect, type Page, test } from '@playwright/test'

/**
 * Panel width across the two states (issue #44). Horizontally a panel is as
 * wide as its authored Width — or as its content, with Fit Content on, or with
 * the legacy `max-content` typed into Width. Stacked, every panel fills the
 * section whatever that authored width says: Elementor cascades a Container's
 * desktop Width into the tablet band and into every touch stack at desktop
 * widths, where a content-sized panel around percentage content is 0px wide.
 *
 * The fixture page carries the cases the demo's design does not; the demo
 * itself proves the stack under touch emulation now that its seed no longer
 * carries a per-breakpoint Width override.
 */

const FIXTURE = '/ahs-stacking/'
const DEMO = '/ahs-demo/'

/** Horizontal tiers boot asynchronously (Firefox waits on the polyfill); measure only once the timeline exists. */
const waitForEngine = (page: Page) =>
  page.waitForFunction(() => {
    const wrapper = document.querySelector('.js-arts-hs')
    return Boolean(wrapper && window.artsHorizontalScroll?.getTimeline(wrapper))
  })

const widths = (page: Page) =>
  page.evaluate(() => {
    const runway = document.querySelector<HTMLElement>('.js-arts-hs')
    const track = runway?.querySelector<HTMLElement>('.js-arts-hs__track')
    const heading = document.querySelector<HTMLElement>('#fit .elementor-widget-heading')
    if (!runway || !track || !heading) {
      throw new Error('the fixture page rendered no section, track or heading')
    }
    const width = (id: string) => {
      const panel = document.getElementById(id)
      if (!panel) {
        throw new Error(`the fixture page has no panel #${id}`)
      }
      return panel.getBoundingClientRect().width
    }
    return {
      trackPosition: getComputedStyle(track).position,
      stage: runway.clientWidth,
      inner: window.innerWidth,
      full: width('full'),
      fit: width('fit'),
      legacy: width('legacy'),
      boxed: width('boxed'),
      heading: heading.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }
  })

test('Fit Content sizes a panel to its content on the horizontal tier', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(FIXTURE)
  await waitForEngine(page)

  const m = await widths(page)

  expect(m.trackPosition).toBe('sticky')
  // 100vw includes the scrollbar; the stage does not.
  expect(Math.abs(m.full - m.inner)).toBeLessThanOrEqual(1)
  // Padding is 0 on the fixture, so max-content is exactly the heading.
  expect(m.heading).toBeGreaterThanOrEqual(599)
  expect(Math.abs(m.fit - m.heading)).toBeLessThanOrEqual(1)
  // The power-user path — `max-content` typed into Width — still works.
  expect(Math.abs(m.legacy - m.fit)).toBeLessThanOrEqual(1)
  // A boxed panel's outer is one screen; its inner is what the cap narrows.
  expect(Math.abs(m.boxed - m.stage)).toBeLessThanOrEqual(1)
})

test('every panel fills the section once Layout stacks on tablet', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto(FIXTURE)
  await page.waitForFunction(() => document.querySelector('.js-arts-hs') !== null)

  const m = await widths(page)

  expect(m.trackPosition).toBe('static')
  for (const width of [m.full, m.fit, m.legacy, m.boxed]) {
    expect(Math.abs(width - m.stage)).toBeLessThanOrEqual(1)
  }
  expect(m.overflow).toBe(0)
})

test.describe('on a touch tablet', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Firefox has no touch emulation')
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 900, height: 800 } })

  test('the demo stacks every panel at section width without a per-breakpoint override', async ({
    page
  }) => {
    await page.goto(DEMO)
    await page.waitForFunction(() => document.querySelector('.js-arts-hs') !== null)

    const m = await page.evaluate(() => {
      const runway = document.querySelector<HTMLElement>('.js-arts-hs')
      if (!runway) {
        throw new Error('the demo page rendered no horizontal scroll section')
      }
      const panels = Array.from(runway.querySelectorAll<HTMLElement>('.js-arts-hs__track > .e-con'))
      return {
        stage: runway.clientWidth,
        panels: panels.map((panel) => panel.getBoundingClientRect().width),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }
    })

    expect(m.panels.length).toBeGreaterThan(1)
    for (const width of m.panels) {
      expect(Math.abs(width - m.stage)).toBeLessThanOrEqual(1)
    }
    expect(m.overflow).toBe(0)
  })
})
