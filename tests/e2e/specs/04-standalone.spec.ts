import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

/**
 * The package without WordPress: authored wrapper/track/panel markup, the
 * built library and stylesheet, and the shared polyfill loader — served from
 * disk on a made-up origin, so no Elementor, no PHP and no wp-env site is in
 * the page. Chromium drives the native tier, Firefox the polyfilled one: the
 * same split the WordPress specs use, and the only place the standalone
 * polyfilled path runs for real.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const ESM = path.join(ROOT, 'dist/esm')
const POLYFILL = path.join(
  ROOT,
  'vendor/arts/scroll-timeline-polyfill/src/php/libraries/scroll-timeline'
)
const ORIGIN = 'http://hs.standalone.test'

interface IPageOptions {
  dir?: 'ltr' | 'rtl'
  /** Mark the stylesheet for the polyfill's CSS layer to skip, as the WP plugin does. */
  aphrodite?: boolean
  touchVertical?: boolean
}

const html = ({
  dir = 'ltr',
  aphrodite = true,
  touchVertical = false
}: IPageOptions) => `<!doctype html>
<html lang="en" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/hs/styles.css"${aphrodite ? ' data-aphrodite' : ''}>
<style>
  body { margin: 0; }
  .spacer { height: 100vh; }
  .arts-hs__panel { display: grid; place-items: center; min-height: 50vh; font: 48px sans-serif; }
</style>
<script>window.__artsScrollTimelinePolyfillSrc = '/polyfill/scroll-timeline.js'</script>
<script src="/polyfill/loader.js"></script>
</head>
<body>
<div class="spacer"></div>
<div class="arts-hs js-arts-hs${touchVertical ? ' arts-hs_touch-vertical' : ''}">
  <div class="arts-hs__track js-arts-hs__track">
    <div class="arts-hs__panel" id="p1">1</div>
    <div class="arts-hs__panel" id="p2">2</div>
    <div class="arts-hs__panel" id="p3">3</div>
  </div>
</div>
<div class="spacer"></div>
<script type="module">
  import { createHorizontalScrollApp } from '/hs/index.js'
  window.__layouts = []
  document.addEventListener('arts-hs:layout', (event) => window.__layouts.push(event.detail.horizontal))
  window.__create = () => {
    const app = createHorizontalScrollApp()
    app.init()
    app.mount()
    return app
  }
  window.__app = window.__create()
</script>
</body>
</html>`

const serve = async (page: Page, options: IPageOptions = {}) => {
  await page.route(`${ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname.startsWith('/hs/')) {
      const file = path.join(ESM, pathname.slice('/hs/'.length))
      return route.fulfill({
        path: file,
        contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript'
      })
    }
    if (pathname.startsWith('/polyfill/')) {
      return route.fulfill({
        path: path.join(POLYFILL, pathname.slice('/polyfill/'.length)),
        contentType: 'text/javascript'
      })
    }
    return route.fulfill({ body: html(options), contentType: 'text/html' })
  })
}

declare global {
  interface Window {
    __layouts: boolean[]
    __app: { mount(): void; unmount(): void; destroy(): void }
    __create: () => Window['__app']
  }
}

/** Waits until the section has measured and reported horizontal. */
const horizontal = (page: Page) =>
  page.waitForFunction(() => window.__layouts?.includes(true), undefined, { timeout: 15000 })

/** Scrolls to where the API says `id` is on stage, then reports the panel's left edge. */
const landOn = async (page: Page, id: string) => {
  const top = await page.evaluate((target) => {
    const panel = document.getElementById(target) as HTMLElement
    return window.artsHorizontalScroll?.getScrollTop(panel) ?? null
  }, id)
  expect(top).not.toBeNull()
  await page.evaluate((y) => window.scrollTo({ top: y as number, behavior: 'instant' }), top)
  // The scrub follows on the next frames (the polyfill drives WAAPI from rAF).
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
  return page.evaluate(
    (target) => (document.getElementById(target) as HTMLElement).getBoundingClientRect().left,
    id
  )
}

const trackState = (page: Page) =>
  page.evaluate(() => {
    const wrapper = document.querySelector('.js-arts-hs') as HTMLElement
    const track = document.querySelector('.js-arts-hs__track') as HTMLElement
    return {
      position: getComputedStyle(track).position,
      polyfilled: wrapper.classList.contains('arts-hs_polyfilled'),
      animations: track.getAnimations().length,
      timeline: Boolean(window.artsHorizontalScroll?.getTimeline(wrapper))
    }
  })

test.beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build-library.mjs'], { cwd: ROOT, stdio: 'ignore' })
  expect(readdirSync(ESM)).toContain('styles.css')
  expect(readFileSync(path.join(POLYFILL, 'loader.js'), 'utf8').length).toBeGreaterThan(0)
})

test('mounts authored markup and lands each panel on stage', async ({ page, browserName }) => {
  await serve(page)
  await page.goto(`${ORIGIN}/`)
  await horizontal(page)

  const state = await trackState(page)
  expect(state.position).toBe('sticky')
  expect(state.timeline).toBe(true)
  expect(state.polyfilled).toBe(browserName === 'firefox')

  const width = await page.evaluate(() => window.innerWidth)
  const panelWidth = await page.evaluate(
    () => (document.getElementById('p1') as HTMLElement).getBoundingClientRect().width
  )
  // `100cqw` of the runway: the stage, never wider than the viewport.
  expect(Math.abs(panelWidth - width)).toBeLessThanOrEqual(1)

  expect(Math.abs(await landOn(page, 'p2'))).toBeLessThanOrEqual(2)
  expect(Math.abs(await landOn(page, 'p3'))).toBeLessThanOrEqual(2)
})

test('tears down and remounts without leaving a second scrub behind', async ({
  page,
  browserName
}) => {
  await serve(page)
  await page.goto(`${ORIGIN}/`)
  await horizontal(page)

  await page.evaluate(() => window.__app.unmount())
  const torn = await trackState(page)
  expect(torn.timeline).toBe(false)
  if (browserName === 'firefox') {
    // The polyfilled scrub is ours to cancel; the layout flips back to the stack.
    expect(torn.polyfilled).toBe(false)
    expect(torn.animations).toBe(0)
    expect(torn.position).toBe('static')
  }

  const before = await page.evaluate(() => window.__layouts.length)
  await page.evaluate(() => window.__app.mount())
  await page.waitForFunction((count) => window.__layouts.length > count, before)

  const again = await trackState(page)
  expect(again.position).toBe('sticky')
  // One scrub either way: the CSS animation natively, our WAAPI build when polyfilled.
  expect(again.animations).toBe(1)
  expect(Math.abs(await landOn(page, 'p2'))).toBeLessThanOrEqual(2)
})

test('survives a destroy-and-recreate cycle, as a hot module reload does', async ({ page }) => {
  await serve(page)
  await page.goto(`${ORIGIN}/`)
  await horizontal(page)

  const published = await page.evaluate(() => {
    const old = window.__app
    old.destroy()
    const gone = window.artsHorizontalScroll === undefined
    window.__app = window.__create()
    return { gone, replaced: window.artsHorizontalScroll === (window.__app as unknown) }
  })
  expect(published).toEqual({ gone: true, replaced: true })
  await page.waitForFunction(() => window.__layouts.filter(Boolean).length >= 2)

  expect((await trackState(page)).animations).toBe(1)
  expect(Math.abs(await landOn(page, 'p3'))).toBeLessThanOrEqual(2)
})

test('corrects a page-load deep link into a panel', async ({ page }) => {
  await serve(page)
  await page.goto(`${ORIGIN}/#p3`)
  await horizontal(page)
  await page.waitForFunction(() => {
    const panel = document.getElementById('p3') as HTMLElement
    return Math.abs(panel.getBoundingClientRect().left) <= 2
  })
})

test('mirrors the traversal on an RTL page', async ({ page }) => {
  await serve(page, { dir: 'rtl' })
  await page.goto(`${ORIGIN}/`)
  await horizontal(page)

  const dir = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.js-arts-hs') as HTMLElement)
      .getPropertyValue('--arts-hs-dir')
      .trim()
  )
  expect(dir).toBe('-1')
  // The first panel starts at the right edge; travelling moves the rest in from the left.
  expect(Math.abs(await landOn(page, 'p2'))).toBeLessThanOrEqual(2)
  expect(Math.abs(await landOn(page, 'p3'))).toBeLessThanOrEqual(2)
})

test('scrubs on the polyfilled tier without the stylesheet skip marker', async ({
  page,
  browserName
}) => {
  test.skip(browserName !== 'firefox', 'only the polyfill has a CSS layer to skip')
  await serve(page, { aphrodite: false })
  await page.goto(`${ORIGIN}/`)
  await horizontal(page)

  expect((await trackState(page)).animations).toBe(1)
  expect(Math.abs(await landOn(page, 'p2'))).toBeLessThanOrEqual(2)
})

test.describe('on a touch device', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Firefox has no mobile emulation')
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('stacks the panels vertically at full width', async ({ page }) => {
    await serve(page, { touchVertical: true })
    await page.goto(`${ORIGIN}/`)
    await page.waitForFunction(() => window.__layouts?.length > 0)

    const layout = await page.evaluate(() => {
      const panels = ['p1', 'p2'].map((id) =>
        (document.getElementById(id) as HTMLElement).getBoundingClientRect()
      )
      return {
        position: getComputedStyle(document.querySelector('.js-arts-hs__track') as HTMLElement)
          .position,
        horizontal: window.__layouts.at(-1),
        stacked: (panels[1]?.top ?? 0) >= (panels[0]?.bottom ?? 0) - 1,
        width: panels[0]?.width,
        viewport: document.documentElement.clientWidth
      }
    })
    expect(layout.position).toBe('static')
    expect(layout.horizontal).toBe(false)
    expect(layout.stacked).toBe(true)
    expect(Math.abs((layout.width ?? 0) - layout.viewport)).toBeLessThanOrEqual(1)
  })
})
