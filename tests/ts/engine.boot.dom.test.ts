// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from './support'

/**
 * The tier half of the engine. SUPPORTS_NATIVE is evaluated at module scope on
 * purpose — the polyfill monkeypatches CSS.supports once it installs, so a
 * probe taken later would report native in Firefox and drive the track twice.
 * That design is what forces this file to load the engine dynamically: the
 * capability has to be decided before the import, never after it.
 */
const loadEngine = async (native: boolean) => {
  vi.resetModules()
  vi.stubGlobal('CSS', { supports: () => native })
  return import('@ts/engine')
}

/** Lets boot()'s polyfill branch settle — it is driven by a promise chain. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const fakeViewTimeline = () => {
  const calls: unknown[] = []
  class Fake {
    constructor(options: unknown) {
      calls.push(options)
    }
  }
  vi.stubGlobal('ViewTimeline', Fake)
  return calls
}

const readySignal = (wrapper: HTMLElement) => {
  const seen: CustomEvent[] = []
  wrapper.addEventListener('arts-hs:ready', (event) => seen.push(event as CustomEvent))
  return seen
}

const travelling = () =>
  section({
    viewport: 1000,
    trackWidth: 3000,
    panels: [
      { left: 0, width: 1000 },
      { left: 1000, width: 1000 },
      { left: 2000, width: 1000 }
    ]
  })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('boot on a browser with native scroll-driven animations', () => {
  it('measures and announces readiness', async () => {
    const { boot } = await loadEngine(true)
    const { wrapper } = travelling()
    const ready = readySignal(wrapper)

    boot(wrapper)

    expect(wrapper.style.getPropertyValue('--arts-hs-distance')).toBe('2000px')
    expect(ready).toHaveLength(1)
    expect(nth(ready, 0).detail).toEqual({ wrapper })
    // Integrators listen for this on ancestors, so it has to bubble.
    expect(nth(ready, 0).bubbles).toBe(true)
  })

  it('is idempotent per section', async () => {
    const { boot } = await loadEngine(true)
    const { wrapper } = travelling()
    const ready = readySignal(wrapper)

    boot(wrapper)
    boot(wrapper)

    expect(ready).toHaveLength(1)
  })

  it('does nothing when the track hook is missing', async () => {
    const { boot } = await loadEngine(true)
    const { wrapper, track } = travelling()
    track.remove()
    const ready = readySignal(wrapper)

    expect(() => boot(wrapper)).not.toThrow()
    expect(ready).toHaveLength(0)
  })
})

describe('getTimeline', () => {
  it('is null before the section has booted', async () => {
    const { getTimeline } = await loadEngine(true)
    fakeViewTimeline()
    const { panels } = travelling()

    expect(getTimeline(nth(panels, 0))).toBeNull()
  })

  it('is null outside any section', async () => {
    const { getTimeline } = await loadEngine(true)
    fakeViewTimeline()
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)

    expect(getTimeline(orphan)).toBeNull()
  })

  it('builds one timeline per section and caches it', async () => {
    const { boot, getTimeline } = await loadEngine(true)
    const calls = fakeViewTimeline()
    const { wrapper, panels } = travelling()
    boot(wrapper)

    const first = getTimeline(nth(panels, 0))
    const second = getTimeline(nth(panels, 2))

    expect(first).not.toBeNull()
    expect(second).toBe(first)
    // Built lazily, once — and pinned to the same inset the stylesheet uses.
    expect(calls).toHaveLength(1)
    expect(nth(calls, 0)).toMatchObject({ subject: wrapper, axis: 'block', inset: '0px 0px' })
  })

  it('is null when the browser has no ViewTimeline at all', async () => {
    const { boot, getTimeline } = await loadEngine(true)
    vi.stubGlobal('ViewTimeline', undefined)
    const { wrapper, panels } = travelling()
    boot(wrapper)

    expect(getTimeline(nth(panels, 0))).toBeNull()
  })
})

describe('boot on a polyfilled browser', () => {
  it('flips the layout and drives the track through the WAAPI surface', async () => {
    const { boot } = await loadEngine(false)
    fakeViewTimeline()
    vi.stubGlobal('__artsScrollTimelinePolyfillReady', Promise.resolve('polyfilled'))
    const { wrapper, track } = travelling()
    const animate = vi.fn()
    track.animate = animate
    const ready = readySignal(wrapper)

    boot(wrapper)
    await flush()

    expect(wrapper.classList.contains('arts-hs_polyfilled')).toBe(true)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(ready).toHaveLength(1)
    // `linear` is load-bearing: it keeps the track glued 1:1 to scroll.
    expect(nth(animate.mock.calls, 0)[1]).toMatchObject({
      rangeStart: 'contain 0%',
      rangeEnd: 'contain 100%',
      easing: 'linear',
      fill: 'both'
    })
  })

  it('takes the layout flip back off when the animation cannot be built', async () => {
    // The safety-critical branch: a pinned track with no scrub would strand
    // every panel behind `overflow-x: clip`. Better to stay vertical.
    const { boot } = await loadEngine(false)
    fakeViewTimeline()
    vi.stubGlobal('__artsScrollTimelinePolyfillReady', Promise.resolve('polyfilled'))
    const { wrapper, track } = travelling()
    track.animate = vi.fn(() => {
      throw new Error('no WAAPI here')
    })
    const ready = readySignal(wrapper)

    boot(wrapper)
    await flush()

    expect(wrapper.classList.contains('arts-hs_polyfilled')).toBe(false)
    expect(ready).toHaveLength(0)
  })

  it('keeps the designed vertical layout when the polyfill never installs', async () => {
    const { boot } = await loadEngine(false)
    vi.stubGlobal('__artsScrollTimelinePolyfillReady', Promise.resolve('unavailable'))
    const { wrapper } = travelling()
    const ready = readySignal(wrapper)

    boot(wrapper)
    await flush()

    expect(wrapper.classList.contains('arts-hs_polyfilled')).toBe(false)
    expect(wrapper.style.getPropertyValue('--arts-hs-distance')).toBe('')
    expect(ready).toHaveLength(0)
  })

  it('takes the layout flip back off when no ViewTimeline exists to bind', async () => {
    const { boot } = await loadEngine(false)
    vi.stubGlobal('ViewTimeline', undefined)
    vi.stubGlobal('__artsScrollTimelinePolyfillReady', Promise.resolve('polyfilled'))
    const { wrapper, track } = travelling()
    track.animate = vi.fn()
    const ready = readySignal(wrapper)

    boot(wrapper)
    await flush()

    expect(wrapper.classList.contains('arts-hs_polyfilled')).toBe(false)
    expect(ready).toHaveLength(0)
  })

  it('offers no timeline on a tier that never got one', async () => {
    // Polyfilled sections reuse the instance built for the track; when the
    // build never happened there is nothing to hand out, and the native
    // lazy path must not run on a non-native tier.
    const { boot, getTimeline } = await loadEngine(false)
    vi.stubGlobal('__artsScrollTimelinePolyfillReady', Promise.resolve('unavailable'))
    const { wrapper, panels } = travelling()
    boot(wrapper)
    await flush()

    expect(getTimeline(nth(panels, 0))).toBeNull()
  })

  it('offers no timeline once the track hook has gone', async () => {
    const { boot, getTimeline } = await loadEngine(true)
    fakeViewTimeline()
    const { wrapper, track } = travelling()
    boot(wrapper)
    track.remove()

    // Asked via the wrapper, not a panel: removing the track detaches the
    // panels with it, and a detached panel would fail the closest() lookup
    // several checks earlier than the one under test.
    expect(getTimeline(wrapper)).toBeNull()
  })

  it('treats a missing loader promise as unavailable', async () => {
    const { boot } = await loadEngine(false)
    const { wrapper } = travelling()
    const ready = readySignal(wrapper)

    boot(wrapper)
    await flush()

    expect(wrapper.classList.contains('arts-hs_polyfilled')).toBe(false)
    expect(ready).toHaveLength(0)
  })
})
