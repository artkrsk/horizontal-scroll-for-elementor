import { expect, type Page, test } from '@playwright/test'

/**
 * The Integration contract in a real browser. The unit tier states every offset
 * the engine reads; these specs let the browser compute them, on the native tier
 * (Chromium) and the polyfilled one (Firefox) alike — the anchor landing, the
 * scroll window getScrollRange promises, and when arts-hs:layout fires.
 */

const DEMO = '/ahs-demo/'

declare global {
  interface Window {
    /** Every arts-hs:layout detail since the document started, recorded by an init script. */
    __hsLayout?: boolean[]
  }
}

/** Three frames: the scroll lands, the timeline samples, the frame paints. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      )
  )

test.beforeEach(async ({ page }) => {
  // From document start: the first measure fires during boot, before any spec
  // code could attach a listener.
  await page.addInitScript(() => {
    window.__hsLayout = []
    document.addEventListener('arts-hs:layout', (event) => {
      window.__hsLayout?.push((event as CustomEvent<{ horizontal: boolean }>).detail.horizontal)
    })
  })
  await page.goto(DEMO)
  await page.waitForFunction(() => {
    const wrapper = document.querySelector('.js-arts-hs')
    return Boolean(wrapper && window.ARTS_HS?.getTimeline?.(wrapper))
  })
})

test('lands an anchor link on the panel the plugin reports', async ({ page }) => {
  await page.evaluate(() => {
    const track = document.querySelector('.js-arts-hs__track')
    const panel = track?.children[Math.floor((track?.children.length ?? 0) / 2)]
    if (!panel) {
      throw new Error('the demo page rendered no panels')
    }
    panel.id ||= 'e2e-panel'
    const link = document.createElement('a')
    link.href = `#${panel.id}`
    link.id = 'e2e-anchor'
    link.textContent = 'to the panel'
    document.body.appendChild(link)
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await settle(page)

  const landing = await page.evaluate(async () => {
    const link = document.getElementById('e2e-anchor') as HTMLAnchorElement
    const panel = document.getElementById(link.hash.slice(1)) as HTMLElement
    link.click()

    // The click path scrolls smoothly; wait until the page holds still.
    let last = -1
    let still = 0
    const started = performance.now()
    while (still < 3 && performance.now() - started < 8000) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      still = window.scrollY === last ? still + 1 : 0
      last = window.scrollY
    }
    return { scrollY: window.scrollY, target: window.ARTS_HS?.getScrollTop?.(panel) ?? null }
  })

  expect(landing.target).not.toBeNull()
  expect(Math.abs(landing.scrollY - (landing.target as number))).toBeLessThanOrEqual(2)
})

test('getScrollRange brackets the moment a panel enters and leaves the stage', async ({ page }) => {
  const picked = await page.evaluate(() => {
    const track = document.querySelector('.js-arts-hs__track')
    const panels = Array.from(track?.children ?? []) as HTMLElement[]
    const ranges = panels.map((panel) => window.ARTS_HS?.getScrollRange?.(panel) ?? null)
    if (ranges.some((range) => range === null)) {
      throw new Error('a panel of a horizontal section returned no range')
    }
    const starts = ranges.map((range) => (range as { start: number }).start)
    const ends = ranges.map((range) => (range as { end: number }).end)
    // Unclamped at both ends: the panel enters after the pin engages and leaves
    // before it releases, so both edges can be checked against the stage.
    const index = ranges.findIndex(
      (range) =>
        range !== null && range.start > Math.min(...starts) && range.end < Math.max(...ends)
    )
    if (index === -1) {
      throw new Error('the demo page has no panel that crosses the whole stage')
    }
    const panel = panels[index] as HTMLElement
    panel.id ||= 'e2e-range-panel'
    return {
      id: panel.id,
      range: ranges[index] as { start: number; end: number },
      top: window.ARTS_HS?.getScrollTop?.(panel) ?? null
    }
  })

  expect(picked.top).not.toBeNull()
  expect(picked.range.start).toBeLessThan(picked.top as number)
  expect(picked.top as number).toBeLessThan(picked.range.end)

  const edgesAt = async (scrollTop: number) => {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scrollTop)
    await settle(page)
    return page.evaluate((id) => {
      const wrapper = document.querySelector('.js-arts-hs') as HTMLElement
      const stage = wrapper.getBoundingClientRect()
      const panel = (document.getElementById(id) as HTMLElement).getBoundingClientRect()
      return {
        stageLeft: stage.left,
        stageRight: stage.left + wrapper.clientWidth,
        panelLeft: panel.left,
        panelRight: panel.right
      }
    }, picked.id)
  }

  const atStart = await edgesAt(picked.range.start)
  expect(Math.abs(atStart.panelLeft - atStart.stageRight)).toBeLessThanOrEqual(2)

  const atEnd = await edgesAt(picked.range.end)
  expect(Math.abs(atEnd.panelRight - atEnd.stageLeft)).toBeLessThanOrEqual(2)
})

test('announces layout changes but never a scroll', async ({ page }) => {
  // Under the polyfill the section only settles horizontal once the polyfill is
  // ready — whatever happened during boot, the last word has to be horizontal.
  const boot = await page.evaluate(() => window.__hsLayout ?? [])
  expect(boot.length).toBeGreaterThan(0)
  expect(boot.at(-1)).toBe(true)

  const duringScroll = await page.evaluate(async () => {
    window.__hsLayout = []
    const wrapper = document.querySelector('.js-arts-hs') as HTMLElement
    const top = wrapper.getBoundingClientRect().top + window.scrollY
    for (let step = 0; step <= 8; step++) {
      window.scrollTo({ top: top + (wrapper.offsetHeight * step) / 8, behavior: 'instant' })
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    return window.__hsLayout.length
  })
  expect(duringScroll).toBe(0)

  // Narrower than the desktop default: the vw-sized panels change the travel.
  await page.setViewportSize({ width: 1100, height: 800 })
  await expect.poll(() => page.evaluate(() => window.__hsLayout ?? [])).not.toHaveLength(0)
  expect((await page.evaluate(() => window.__hsLayout ?? [])).at(-1)).toBe(true)

  // The demo stacks vertically below the mobile breakpoint.
  await page.setViewportSize({ width: 700, height: 800 })
  await expect.poll(() => page.evaluate(() => (window.__hsLayout ?? []).at(-1))).toBe(false)
  const stacked = await page.evaluate(() => {
    const panel = document.querySelector('.js-arts-hs__track')?.children[1] as HTMLElement
    return {
      range: window.ARTS_HS?.getScrollRange?.(panel) ?? null,
      top: window.ARTS_HS?.getScrollTop?.(panel) ?? null
    }
  })
  expect(stacked).toEqual({ range: null, top: null })
})
