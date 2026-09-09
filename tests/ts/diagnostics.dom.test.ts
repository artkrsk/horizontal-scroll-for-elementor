// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observerSpy, section } from './support'

/**
 * The editor-only "why isn't this pinning" bar. Two halves worth pinning: WHAT
 * counts as a blocker — the narrow set that actually kills the pin, and just as
 * importantly the ancestor styles that must NOT trip it — and the fact that the
 * bar clears itself, since Elementor applies the fix as injected CSS without
 * ever re-rendering the widget.
 *
 * happy-dom resolves computed overflow/position/contain from inline styles for
 * real, which is all the walk reads — but it does not expand the `overflow`
 * shorthand into computed longhands the way a browser does, so the fixtures
 * state `overflow-x`/`overflow-y` directly. That is the pair the walk reads and
 * the pair a browser computes either way. Its MutationObserver delivers on its
 * own schedule and cannot be handed a batch, so observerSpy stands in for it.
 *
 * The module keeps the watched sections and its observer at module scope (one
 * observer per preview document, not per widget), so every test loads a fresh
 * copy the way engine.boot.dom.test.ts does.
 */
const load = async () => {
  vi.resetModules()
  return import('@ts/diagnostics')
}

const STRINGS = {
  blocked: 'Cannot pin.',
  overflow: '%1$s has %2$s, so it is a scroll container.',
  fixed: '%1$s has %2$s.'
}

const BAR = '.js-arts-hs__diagnostic'

/** A wrapper under `depth` plain ancestors, so a blocker can be placed anywhere. */
const nest = (depth: number) => {
  const ancestors: HTMLElement[] = []
  let host = document.body
  for (let index = 0; index < depth; index++) {
    const el = document.createElement('div')
    el.className = 'e-con'
    host.appendChild(el)
    ancestors.push(el)
    host = el
  }
  const { wrapper, track } = section()
  host.appendChild(wrapper)
  return { wrapper, track, ancestors, outermost: ancestors[0] as HTMLElement }
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  document.head.innerHTML = ''
  window.ARTS_HS_DIAGNOSTICS = { ...STRINGS }
})

afterEach(() => {
  delete window.ARTS_HS_DIAGNOSTICS
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('what counts as a blocker', () => {
  it('flags the reported case: overflow-x hidden on BOTH html and body', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    expect(findBlocker(wrapper)).toEqual({
      kind: 'overflow',
      label: 'body',
      declaration: 'overflow-x: hidden'
    })
  })

  // The propagation rule, measured in Chrome across every html/body pairing.
  // While the root is `visible`, body's overflow is what reaches the viewport
  // and body itself behaves `visible`; only a root with its own non-visible
  // overflow strands body's on body and makes it a real scroll container.
  it('does not flag body overflow on its own — it propagates to the viewport', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    document.body.style.overflowX = 'hidden'

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('does not flag the root on its own — its overflow IS the viewport', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('flags body when the root only clips, which still ends propagation', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'clip'
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    expect(findBlocker(wrapper)?.label).toBe('body')
  })

  it('does not flag a body that only clips, whatever the root does', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'clip'

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('reports the NEAREST offender, not the outermost', async () => {
    const { findBlocker } = await load()
    const { wrapper, ancestors } = nest(2)
    document.documentElement.style.overflowY = 'hidden'
    document.body.style.overflowY = 'hidden'
    const inner = ancestors[1] as HTMLElement
    inner.id = 'row'
    inner.style.overflowX = 'auto'

    expect(findBlocker(wrapper)?.label).toBe('div#row.e-con')
  })

  // Names the axis the AUTHOR wrote. CSS forces the companion axis to `auto`,
  // so reporting `overflow-x: auto` for an authored `overflow-y: hidden` would
  // send them hunting for a rule that isn't in their stylesheet.
  it.each([
    ['overflow-y', 'scroll'],
    ['overflow-x', 'auto'],
    ['overflow-y', 'hidden'],
    ['overflow-x', 'hidden']
  ])('flags %s: %s and names that axis', async (property, value) => {
    const { findBlocker } = await load()
    const { wrapper, outermost } = nest(1)
    // The companion axis, as a browser computes it.
    outermost.style.setProperty(property, value)
    outermost.style.setProperty(property === 'overflow-x' ? 'overflow-y' : 'overflow-x', 'auto')

    expect(findBlocker(wrapper)).toMatchObject({
      kind: 'overflow',
      declaration: `${property}: ${value}`
    })
  })

  it('falls back to overflow-x when both axes were authored', async () => {
    const { findBlocker } = await load()
    const { wrapper, outermost } = nest(1)
    outermost.style.overflowX = 'hidden'
    outermost.style.overflowY = 'scroll'

    expect(findBlocker(wrapper)?.declaration).toBe('overflow-x: hidden')
  })

  it.each(['overflow-x', 'overflow-y'])('does not flag %s: clip', async (property) => {
    const { findBlocker } = await load()
    const { wrapper, outermost } = nest(1)
    outermost.style.setProperty(property, 'clip')

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('never self-reports the runway, whose own overflow-x is clip', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(1)
    wrapper.style.overflowX = 'clip'
    wrapper.style.overflowY = 'hidden'

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('flags a fixed ancestor, which stops the page scrolling at all', async () => {
    const { findBlocker } = await load()
    const { wrapper, outermost } = nest(1)
    outermost.style.position = 'fixed'

    expect(findBlocker(wrapper)).toMatchObject({
      kind: 'fixed',
      declaration: 'position: fixed'
    })
  })

  // Every one of these was measured working in Chrome against a real pinned
  // section. The containment pair is the sharper lesson: `contain: size`
  // collapses the ancestor's box, yet its scrollable overflow still reaches the
  // viewport, so the pin traverses exactly as before.
  it.each([
    ['transform', 'translateY(40px)'],
    ['will-change', 'transform'],
    ['filter', 'blur(2px)'],
    ['perspective', '800px'],
    ['contain', 'size'],
    ['contain', 'paint'],
    ['contain', 'layout'],
    ['contain', 'content'],
    ['content-visibility', 'auto'],
    ['position', 'sticky'],
    ['position', 'absolute'],
    ['max-height', '400px']
  ])('does not flag %s: %s on an ancestor', async (property, value) => {
    const { findBlocker } = await load()
    const { wrapper, outermost } = nest(1)
    outermost.style.setProperty(property, value)

    expect(findBlocker(wrapper)).toBeNull()
  })

  it('finds nothing on a healthy tree', async () => {
    const { findBlocker } = await load()
    const { wrapper } = nest(3)

    expect(findBlocker(wrapper)).toBeNull()
  })
})

describe('the bar', () => {
  it('stays absent on a public page, where PHP emits no strings', async () => {
    const { inspectSection } = await load()
    delete window.ARTS_HS_DIAGNOSTICS
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    inspectSection(wrapper)

    expect(wrapper.querySelector(BAR)).toBeNull()
  })

  it('renders the reason and the offender ahead of the track', async () => {
    const { inspectSection } = await load()
    const { wrapper, track } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    inspectSection(wrapper)

    const bar = wrapper.querySelector(BAR)
    expect(bar?.textContent).toBe(
      '\u26a0\ufe0f Cannot pin. body has overflow-x: hidden, so it is a scroll container.'
    )
    expect(wrapper.firstElementChild).toBe(bar)
    expect(bar?.nextElementSibling).toBe(track)
  })

  it('emphasises the offending element and its declaration', async () => {
    const { inspectSection } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    inspectSection(wrapper)

    const emphasised = [...wrapper.querySelectorAll(`${BAR} strong`)].map((el) => el.textContent)
    expect(emphasised).toEqual(['body', 'overflow-x: hidden'])
  })

  // The template is translator-supplied and the label is assembled from page
  // attributes; neither may ever reach an HTML parser.
  it('inserts the element label as text, never as markup', async () => {
    const { inspectSection } = await load()
    const { wrapper, outermost } = nest(1)
    outermost.id = '<img src=x onerror=alert(1)>'
    outermost.style.overflowX = 'hidden'

    inspectSection(wrapper)

    const strong = wrapper.querySelector(`${BAR} strong`)
    expect(strong?.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.querySelector(`${BAR} img`)).toBeNull()
  })

  it('stays quiet in a vertical state, where there is no pin to break', async () => {
    const { inspectSection } = await load()
    const { wrapper, track } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    // A vertical Layout breakpoint (or touch) renders the track static.
    track.style.position = 'static'

    inspectSection(wrapper)

    expect(wrapper.querySelector(BAR)).toBeNull()
  })

  it('does not duplicate when the same section mounts again', async () => {
    const { inspectSection } = await load()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    inspectSection(wrapper)
    inspectSection(wrapper)

    expect(wrapper.querySelectorAll(BAR)).toHaveLength(1)
  })
})

describe('clearing itself when the CSS is fixed', () => {
  const armed = async () => {
    const { spy, Fake } = observerSpy()
    vi.stubGlobal('MutationObserver', Fake)
    vi.useFakeTimers()
    return { spy, ...(await load()) }
  }

  it('watches the preview head, where Elementor rewrites its injected CSS', async () => {
    const { spy, inspectSection } = await armed()
    const { wrapper } = nest(1)

    inspectSection(wrapper)

    expect(spy.observed).toEqual([document.head])
    expect(spy.observeOptions).toEqual({ childList: true, subtree: true })
  })

  it('removes the bar once the offending rule is gone', async () => {
    const { spy, inspectSection } = await armed()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    inspectSection(wrapper)
    expect(wrapper.querySelector(BAR)).not.toBeNull()

    document.body.style.overflowX = 'visible'
    document.documentElement.style.overflowX = 'visible'
    spy.deliver([])
    vi.runAllTimers()

    expect(wrapper.querySelector(BAR)).toBeNull()
  })

  it('adds the bar when the mistake is made mid-edit', async () => {
    const { spy, inspectSection } = await armed()
    const { wrapper } = nest(1)
    inspectSection(wrapper)
    expect(wrapper.querySelector(BAR)).toBeNull()

    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    spy.deliver([])
    vi.runAllTimers()

    expect(wrapper.querySelector(BAR)).not.toBeNull()
  })

  it('collapses a burst of style rewrites into one sweep', async () => {
    const { spy, inspectSection } = await armed()
    const { wrapper } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    inspectSection(wrapper)

    spy.deliver([])
    spy.deliver([])
    spy.deliver([])
    document.body.style.overflowX = 'visible'
    document.documentElement.style.overflowX = 'visible'
    vi.runAllTimers()

    expect(wrapper.querySelector(BAR)).toBeNull()
    expect(wrapper.querySelectorAll(BAR)).toHaveLength(0)
  })

  // Elementor's device switcher resizes the preview without touching the head,
  // and the verdict depends on the layout state — a vertical breakpoint has no
  // pin to break.
  it('re-checks on resize, so a switch to a vertical breakpoint clears the bar', async () => {
    const { inspectSection } = await armed()
    const { wrapper, track } = nest(1)
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    inspectSection(wrapper)
    expect(wrapper.querySelector(BAR)).not.toBeNull()

    track.style.position = 'static'
    window.dispatchEvent(new Event('resize'))
    vi.runAllTimers()

    expect(wrapper.querySelector(BAR)).toBeNull()
  })

  it('drops a detached section and stops observing once none are left', async () => {
    const { spy, inspectSection } = await armed()
    const { wrapper } = nest(1)
    inspectSection(wrapper)
    expect(spy.disconnected).toBe(0)

    wrapper.remove()
    spy.deliver([])
    vi.runAllTimers()

    expect(spy.disconnected).toBe(1)
  })
})
