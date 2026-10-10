// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { section } from './support'

/**
 * The WordPress bundle entry. Two things here are not mere wiring: the
 * `$scope` unwrap decides whether the engine ever finds its own markup (the
 * runway moved inside Elementor's widget container in 1.2.0, so the descendant
 * branch is now the live one), and `window.artsHorizontalScroll` — with its
 * deprecated `ARTS_HS` alias — is a committed public surface.
 */

/** Spelled out, exactly as index.ts spells it — phpParity pins that literal to PHP. */
const HOOK = 'frontend/element_ready/arts-horizontal-scroll.default'

const mocks = vi.hoisted(() => {
  const order: string[] = []
  return {
    order,
    boot: vi.fn(),
    teardown: vi.fn(),
    getTimeline: vi.fn(),
    initLoadCorrection: vi.fn(),
    getScrollTop: vi.fn(),
    getScrollRange: vi.fn(),
    requestScrollspyRescan: vi.fn(),
    note: (name: string) => order.push(name)
  }
})

vi.mock('@ts/engine', () => ({
  boot: mocks.boot,
  teardown: mocks.teardown,
  getTimeline: mocks.getTimeline
}))
vi.mock('@ts/anchor-scroll', () => ({
  installAnchorScroll: () => mocks.note('anchor-scroll'),
  initLoadCorrection: mocks.initLoadCorrection,
  getScrollTop: mocks.getScrollTop,
  getScrollRange: mocks.getScrollRange
}))
vi.mock('@ts/scrollspy', () => ({
  installScrollspy: () => mocks.note('scrollspy'),
  requestScrollspyRescan: mocks.requestScrollspyRescan
}))
vi.mock('@ts/motion-fx-compat', () => ({ installMotionFx: () => mocks.note('motion-fx') }))

const actions = new Map<string, (scope: unknown) => void>()

/** Registrations per hooks object — Elementor rebuilds that object on every init(). */
const registrations = new Map<object, number>()

/** A fresh hooks object, as Elementor's init() builds one. */
const createHooks = () => {
  const hooks = {
    addAction: (name: string, callback: (scope: unknown) => void) => {
      actions.set(name, callback)
      registrations.set(hooks, (registrations.get(hooks) ?? 0) + 1)
    }
  }
  return hooks
}

/** Re-evaluate the entry: its installs and the global write are module-scope. */
const load = async (): Promise<void> => {
  vi.resetModules()
  await import('@ts/boot')
}

/** Elementor's init(): rebuild the hooks object, then announce. */
const elementorInit = (): ((scope: unknown) => void) => {
  ;(window.elementorFrontend as { hooks?: object }).hooks = createHooks()
  window.dispatchEvent(new Event('elementor/frontend/init'))
  const ready = actions.get(HOOK)
  if (!ready) {
    throw new Error(`no action registered for ${HOOK}`)
  }
  return ready
}

// Every load() evaluates a fresh module instance that subscribes to
// elementor/frontend/init; a real page evaluates the bundle once. Unsubscribe each
// test's instance so earlier ones can't answer a later test's init.
const initListeners: EventListenerOrEventListenerObject[] = []
const addEventListener = window.addEventListener.bind(window)

beforeEach(() => {
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'elementor/frontend/init' && listener) {
      initListeners.push(listener)
    }
    addEventListener(type, listener, options)
  })
})

afterEach(() => {
  for (const listener of initListeners.splice(0)) {
    window.removeEventListener('elementor/frontend/init', listener)
  }
  vi.restoreAllMocks()
})

beforeEach(() => {
  document.body.innerHTML = ''
  mocks.order.length = 0
  mocks.boot.mockClear()
  mocks.initLoadCorrection.mockClear()
  mocks.requestScrollspyRescan.mockClear()
  actions.clear()
  registrations.clear()
  delete (window as { ARTS_HS?: unknown }).ARTS_HS
  delete (window as { artsHorizontalScroll?: unknown }).artsHorizontalScroll
  // Before init() Elementor's frontend object exists but has no hooks yet.
  vi.stubGlobal('elementorFrontend', {})
})

describe('bundle entry', () => {
  it('runs all three compatibility installs before registering the element_ready hook', async () => {
    await load()

    // Order is load-bearing: anchor-scroll's capture-phase click listener has
    // to be attached as early as the import-evaluation order it replaced.
    expect(mocks.order).toEqual(['anchor-scroll', 'scrollspy', 'motion-fx'])
    expect(actions.size).toBe(0)

    elementorInit()

    expect(actions.has(HOOK)).toBe(true)
  })

  it('registers straight away when Elementor started before the bundle loaded', async () => {
    // An AJAX navigator that runs init() once per page lifetime loads this
    // bundle on a later page, long after elementor/frontend/init fired.
    const hooks = createHooks()
    ;(window.elementorFrontend as { hooks?: object }).hooks = hooks

    await load()

    expect(actions.has(HOOK)).toBe(true)
    expect(registrations.get(hooks)).toBe(1)
  })

  it('registers only once on the same hooks object', async () => {
    const hooks = createHooks()
    ;(window.elementorFrontend as { hooks?: object }).hooks = hooks

    await load()
    window.dispatchEvent(new Event('elementor/frontend/init'))

    expect(registrations.get(hooks)).toBe(1)
  })

  it('registers again when init() rebuilds the hooks', async () => {
    const first = createHooks()
    ;(window.elementorFrontend as { hooks?: object }).hooks = first

    await load()
    elementorInit()

    const rebuilt = (window.elementorFrontend as { hooks?: object }).hooks as object
    expect(rebuilt).not.toBe(first)
    expect(registrations.get(first)).toBe(1)
    expect(registrations.get(rebuilt)).toBe(1)
  })

  it('exposes the documented artsHorizontalScroll surface', async () => {
    await load()

    expect(window.artsHorizontalScroll?.contract).toBe(1)
    expect(window.artsHorizontalScroll?.getTimeline).toBe(mocks.getTimeline)
    expect(window.artsHorizontalScroll?.getScrollTop).toBe(mocks.getScrollTop)
    expect(window.artsHorizontalScroll?.getScrollRange).toBe(mocks.getScrollRange)
  })

  it('keeps the 1.4.x name as an alias of the very same object', async () => {
    await load()

    expect(window.ARTS_HS).toBeDefined()
    expect(window.ARTS_HS).toBe(window.artsHorizontalScroll)
  })
})

describe('deep-link correction', () => {
  it('runs on every Elementor frontend init, not at bundle evaluation', async () => {
    await load()
    expect(mocks.initLoadCorrection).not.toHaveBeenCalled()

    elementorInit()
    elementorInit()

    // PJAX themes re-run init() per transition and land on the new page's hash.
    expect(mocks.initLoadCorrection).toHaveBeenCalledTimes(2)
    expect(mocks.initLoadCorrection).toHaveBeenCalledWith(window.artsHorizontalScroll?.signal)
  })

  it('runs straight away when Elementor started before the bundle loaded', async () => {
    ;(window.elementorFrontend as { hooks?: object }).hooks = createHooks()

    await load()

    expect(mocks.initLoadCorrection).toHaveBeenCalledTimes(1)
  })
})

describe('element_ready → boot', () => {
  it('boots the runway nested inside the widget root', async () => {
    const { wrapper } = section()
    const widget = document.createElement('div')
    widget.className = 'elementor-widget elementor-widget-arts-horizontal-scroll'
    widget.appendChild(wrapper)
    document.body.appendChild(widget)

    await load()
    // What Elementor actually hands the handler: a jQuery object over the
    // widget element, with the runway a descendant.
    elementorInit()({ 0: widget })

    expect(mocks.boot).toHaveBeenCalledWith(wrapper)
    expect(mocks.requestScrollspyRescan).toHaveBeenCalledTimes(1)
  })

  it('boots when the scope is a raw element rather than a jQuery object', async () => {
    const { wrapper } = section()
    const widget = document.createElement('div')
    widget.appendChild(wrapper)
    document.body.appendChild(widget)

    await load()
    elementorInit()(widget)

    expect(mocks.boot).toHaveBeenCalledWith(wrapper)
  })

  it('boots when the scope is the runway itself', async () => {
    const { wrapper } = section()

    await load()
    elementorInit()({ 0: wrapper })

    expect(mocks.boot).toHaveBeenCalledWith(wrapper)
  })

  it('does nothing for a scope holding no runway', async () => {
    const stranger = document.createElement('div')
    document.body.appendChild(stranger)

    await load()
    const ready = elementorInit()

    expect(() => ready({ 0: stranger })).not.toThrow()
    expect(mocks.boot).not.toHaveBeenCalled()
    expect(mocks.requestScrollspyRescan).not.toHaveBeenCalled()
  })
})
