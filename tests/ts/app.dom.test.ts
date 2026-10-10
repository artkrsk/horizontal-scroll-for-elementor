// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { section } from './support'

/**
 * The host lifecycle — what a standalone page (and the WordPress boot) drives.
 * The engine and anchor handling are stood in for: their own suites pin what
 * boot/teardown and the correction do, and what is ours here is WHICH sections
 * reach them, WHEN, and that every listener and global goes away again.
 */

const mocks = vi.hoisted(() => ({
  boot: vi.fn(),
  teardown: vi.fn(),
  getTimeline: vi.fn(),
  getScrollTop: vi.fn(),
  getScrollRange: vi.fn(),
  installAnchorScroll: vi.fn(),
  initLoadCorrection: vi.fn()
}))

vi.mock('@ts/engine', () => ({
  boot: mocks.boot,
  teardown: mocks.teardown,
  getTimeline: mocks.getTimeline
}))
vi.mock('@ts/anchor-scroll', () => ({
  installAnchorScroll: mocks.installAnchorScroll,
  initLoadCorrection: mocks.initLoadCorrection,
  getScrollTop: mocks.getScrollTop,
  getScrollRange: mocks.getScrollRange
}))

const { createHorizontalScrollApp } = await import('@ts/app')

/** A section attached to the page, inside its own host element. */
const mountedSection = () => {
  const host = document.createElement('div')
  const { wrapper } = section()
  host.appendChild(wrapper)
  document.body.appendChild(host)
  return { host, wrapper }
}

const setReadyState = (value: DocumentReadyState) =>
  Object.defineProperty(document, 'readyState', { value, configurable: true })

beforeEach(() => {
  document.body.innerHTML = ''
  for (const mock of Object.values(mocks)) {
    mock.mockClear()
  }
  delete (window as { artsHorizontalScroll?: unknown }).artsHorizontalScroll
  delete (window as { ARTS_HS?: unknown }).ARTS_HS
  setReadyState('complete')
})

afterEach(() => {
  window.artsHorizontalScroll?.destroy()
})

describe('construction', () => {
  it('does nothing until the host asks', () => {
    mountedSection()

    const app = createHorizontalScrollApp()

    expect(window.artsHorizontalScroll).toBeUndefined()
    expect(mocks.installAnchorScroll).not.toHaveBeenCalled()
    expect(mocks.boot).not.toHaveBeenCalled()
    expect(app.contract).toBe(1)
    expect(app.getTimeline).toBe(mocks.getTimeline)
    expect(app.getScrollTop).toBe(mocks.getScrollTop)
    expect(app.getScrollRange).toBe(mocks.getScrollRange)
  })

  it('leaves the package root import passive', async () => {
    const root = await import('@ts/index')

    expect(Object.keys(root)).toEqual(['createHorizontalScrollApp'])
    expect(window.artsHorizontalScroll).toBeUndefined()
  })
})

describe('init', () => {
  it('publishes the app itself under the documented global', () => {
    const app = createHorizontalScrollApp()

    app.init()

    expect(window.artsHorizontalScroll).toBe(app)
    // The 1.4.x alias belongs to the WordPress boot alone.
    expect(window.ARTS_HS).toBeUndefined()
  })

  it('scopes anchor handling to the app lifetime, once', () => {
    const app = createHorizontalScrollApp()

    app.init()
    app.init()

    expect(mocks.installAnchorScroll).toHaveBeenCalledTimes(1)
    expect(mocks.installAnchorScroll).toHaveBeenCalledWith(app.signal)
  })

  it('corrects a deep link straight away on a parsed document', () => {
    const app = createHorizontalScrollApp()

    app.init()

    expect(mocks.initLoadCorrection).toHaveBeenCalledWith(app.signal)
  })

  it('waits for the markup when the document is still loading', () => {
    setReadyState('loading')
    const app = createHorizontalScrollApp()

    app.init()
    expect(mocks.initLoadCorrection).not.toHaveBeenCalled()

    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(mocks.initLoadCorrection).toHaveBeenCalledTimes(1)
  })

  it('leaves the correction to the host when deep links are off', () => {
    createHorizontalScrollApp({ deepLink: false }).init()

    expect(mocks.initLoadCorrection).not.toHaveBeenCalled()
  })
})

describe('mount', () => {
  it('boots every section on the page by default', () => {
    const first = mountedSection()
    const second = mountedSection()
    const app = createHorizontalScrollApp()

    app.mount()

    expect(mocks.boot.mock.calls).toEqual([[first.wrapper], [second.wrapper]])
  })

  it('boots only the sections inside the given root', () => {
    const inside = mountedSection()
    mountedSection()
    const app = createHorizontalScrollApp()

    app.mount(inside.host)

    expect(mocks.boot.mock.calls).toEqual([[inside.wrapper]])
  })

  it('boots the root itself when it is a section', () => {
    const { wrapper } = mountedSection()
    const app = createHorizontalScrollApp()

    app.mount(wrapper)

    expect(mocks.boot).toHaveBeenCalledWith(wrapper)
  })

  it('releases sections that were replaced without an unmount', () => {
    const { host, wrapper } = mountedSection()
    const app = createHorizontalScrollApp()
    app.mount()

    // What an editor re-render does: the old wrapper is simply gone.
    host.remove()
    app.mount()

    expect(mocks.teardown).toHaveBeenCalledWith(wrapper)
  })
})

describe('unmount', () => {
  it('tears down only the sections inside the given root', () => {
    const inside = mountedSection()
    const outside = mountedSection()
    const app = createHorizontalScrollApp()
    app.mount()

    app.unmount(inside.host)

    expect(mocks.teardown.mock.calls).toEqual([[inside.wrapper]])
    app.unmount()
    expect(mocks.teardown).toHaveBeenLastCalledWith(outside.wrapper)
  })

  it('tears down everything when called bare, detached sections included', () => {
    const { host, wrapper } = mountedSection()
    const app = createHorizontalScrollApp()
    app.mount()
    // An AJAX swap removes the old content before the host gets to unmount.
    host.remove()

    app.unmount()

    expect(mocks.teardown).toHaveBeenCalledWith(wrapper)
  })

  it('reaches a detached root the host still holds', () => {
    const { host, wrapper } = mountedSection()
    const app = createHorizontalScrollApp()
    app.mount()
    host.remove()

    app.unmount(host)

    expect(mocks.teardown).toHaveBeenCalledWith(wrapper)
  })

  it('never tears down a section it did not mount', () => {
    mountedSection()
    const app = createHorizontalScrollApp()

    app.unmount()

    expect(mocks.teardown).not.toHaveBeenCalled()
  })
})

describe('destroy', () => {
  it('tears down every mounted section and ends the lifetime', () => {
    const { wrapper } = mountedSection()
    const app = createHorizontalScrollApp()
    app.init()
    app.mount()

    app.destroy()

    expect(mocks.teardown).toHaveBeenCalledWith(wrapper)
    expect(app.signal.aborted).toBe(true)
    expect(window.artsHorizontalScroll).toBeUndefined()
  })

  it('keeps a global another app has since taken over', () => {
    const first = createHorizontalScrollApp()
    first.init()
    const second = createHorizontalScrollApp()
    second.init()

    first.destroy()

    expect(window.artsHorizontalScroll).toBe(second)
  })

  it('is terminal: no init, no mounts afterwards', () => {
    mountedSection()
    const app = createHorizontalScrollApp()
    app.destroy()

    app.init()
    app.mount()

    expect(window.artsHorizontalScroll).toBeUndefined()
    expect(mocks.boot).not.toHaveBeenCalled()
  })

  it('follows the host signal', () => {
    const host = new AbortController()
    const app = createHorizontalScrollApp({ signal: host.signal })
    app.init()

    host.abort()

    expect(app.signal.aborted).toBe(true)
    expect(window.artsHorizontalScroll).toBeUndefined()
  })

  it('is born destroyed under a signal that already aborted', () => {
    const host = new AbortController()
    host.abort()

    const app = createHorizontalScrollApp({ signal: host.signal })
    app.init()

    expect(app.signal.aborted).toBe(true)
    expect(window.artsHorizontalScroll).toBeUndefined()
  })
})
