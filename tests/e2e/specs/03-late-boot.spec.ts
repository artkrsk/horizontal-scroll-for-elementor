import { expect, test } from '@playwright/test'

/**
 * An AJAX navigator that runs elementorFrontend.init() once per page lifetime
 * (ArtsAJAXNavigator) loads this bundle on a later page, long after
 * elementor/frontend/init fired, and then runs Elementor's ready triggers for
 * the new content. Holding the bundle back until Elementor is up and replaying
 * that trigger reproduces the order on a single page, with the real Elementor
 * frontend and — in Firefox — a scroll-timeline polyfill that is already
 * installed by the time the bundle evaluates.
 */

const DEMO = '/ahs-demo/'
const BUNDLE = '**/horizontal-scroll-for-elementor.js*'

test('boots when Elementor started before the bundle loaded', async ({ page }) => {
  await page.route(BUNDLE, (route) => route.abort())
  await page.goto(DEMO)
  await page.waitForFunction(() => Boolean(window.elementorFrontend?.hooks))

  const before = await page.evaluate(() => ({
    api: typeof window.ARTS_HS,
    distance: (document.querySelector('.js-arts-hs') as HTMLElement).style.getPropertyValue(
      '--arts-hs-distance'
    )
  }))
  expect(before.api).toBe('undefined')
  // Still the server-side cqw estimate: nothing has measured the runway.
  expect(before.distance).not.toMatch(/^\d+(\.\d+)?px$/)

  await page.unroute(BUNDLE)
  const src = await page.evaluate(
    () => (document.getElementById('arts-horizontal-scroll-js') as HTMLScriptElement).src
  )
  await page.addScriptTag({ url: src })

  // What the navigator's settle step does for the content it just swapped in.
  await page.evaluate(() => {
    const widget = document.querySelector<HTMLElement>('.elementor-widget-arts-horizontal-scroll')
    if (!widget) {
      throw new Error('the demo page rendered no horizontal scroll widget')
    }
    window.elementorFrontend.elementsHandler.runReadyTrigger(widget)
  })

  await page.waitForFunction(() => {
    const wrapper = document.querySelector<HTMLElement>('.js-arts-hs')
    return Boolean(
      wrapper &&
        /^\d+(\.\d+)?px$/.test(wrapper.style.getPropertyValue('--arts-hs-distance')) &&
        window.ARTS_HS?.getTimeline?.(wrapper)
    )
  })
  const position = await page.evaluate(
    () => getComputedStyle(document.querySelector('.js-arts-hs__track') as HTMLElement).position
  )
  expect(position).toBe('sticky')
})
