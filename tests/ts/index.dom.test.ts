// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { section } from './support'

/**
 * The bundle entry. The shared vitest config excludes entry files from coverage
 * as wiring, but two things here are not wiring: the `$scope` unwrap decides
 * whether the engine ever finds its own markup (the runway moved inside
 * Elementor's widget container in 1.2.0, so the descendant branch is now the
 * live one), and `window.ARTS_HS` is a committed public surface.
 */

/** Spelled out, exactly as index.ts spells it — phpParity pins that literal to PHP. */
const HOOK = 'frontend/element_ready/arts-horizontal-scroll.default'

const mocks = vi.hoisted(() => {
  const order: string[] = []
  return {
    order,
    boot: vi.fn(),
    getTimeline: vi.fn(),
    note: (name: string) => order.push(name)
  }
})

vi.mock('@ts/engine', () => ({ boot: mocks.boot, getTimeline: mocks.getTimeline }))
vi.mock('@ts/anchor-scroll', () => ({ installAnchorScroll: () => mocks.note('anchor-scroll') }))
vi.mock('@ts/scrollspy', () => ({ installScrollspy: () => mocks.note('scrollspy') }))
vi.mock('@ts/motion-fx-compat', () => ({ installMotionFx: () => mocks.note('motion-fx') }))

const actions = new Map<string, (scope: unknown) => void>()

/** Re-evaluate the entry: its installs and the ARTS_HS write are module-scope. */
const load = async (): Promise<void> => {
  vi.resetModules()
  await import('@ts/index')
}

/** The hook only exists once Elementor announces itself. */
const elementorInit = (): ((scope: unknown) => void) => {
  window.dispatchEvent(new Event('elementor/frontend/init'))
  const ready = actions.get(HOOK)
  if (!ready) {
    throw new Error(`no action registered for ${HOOK}`)
  }
  return ready
}

beforeEach(() => {
  document.body.innerHTML = ''
  mocks.order.length = 0
  mocks.boot.mockClear()
  actions.clear()
  delete (window as { ARTS_HS?: unknown }).ARTS_HS
  vi.stubGlobal('elementorFrontend', {
    hooks: {
      addAction: (name: string, callback: (scope: unknown) => void) => actions.set(name, callback)
    }
  })
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

  it('exposes the documented ARTS_HS surface', async () => {
    await load()

    expect(window.ARTS_HS?.contract).toBe(1)
    expect(window.ARTS_HS?.getTimeline).toBe(mocks.getTimeline)
  })

  it('merges into an existing ARTS_HS rather than replacing it', async () => {
    // A second Arts plugin (or a re-executed bundle) must not drop what is there.
    ;(window as { ARTS_HS?: unknown }).ARTS_HS = { contract: 0, sibling: 'kept' }

    await load()

    expect((window.ARTS_HS as { sibling?: string }).sibling).toBe('kept')
    expect(window.ARTS_HS?.contract).toBe(1)
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
  })
})
