import { vi } from 'vitest'

/**
 * Shared mechanical fixtures. happy-dom runs no layout engine, so every
 * offset/client/scroll metric and getBoundingClientRect reads 0 — the geometry
 * a test cares about has to be stated, not rendered. These helpers make that
 * statement the readable part of a test instead of a wall of defineProperty.
 *
 * What is NOT stubbed matters just as much: computed `position`, computed
 * custom properties and computed `top` are real in happy-dom, so isScrubbing,
 * isInverted and computeInsetStart run against genuine style resolution here.
 *
 * The filename deliberately does not end in `.test.ts`, so Vitest never
 * collects it; coverage never sees it either, since it only instruments src/ts.
 */

/** Layout metrics happy-dom leaves at 0. Only the keys passed are overridden. */
export interface IGeometry {
  offsetLeft?: number
  offsetTop?: number
  offsetWidth?: number
  offsetHeight?: number
  clientWidth?: number
  scrollWidth?: number
}

export const setGeometry = (el: HTMLElement, geometry: IGeometry): HTMLElement => {
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(el, key, { value, configurable: true })
  }
  return el
}

export interface IPanelSpec {
  left: number
  width: number
  id?: string
}

export interface ISectionSpec {
  /** wrapper.clientWidth — the scrollport the panels travel across. */
  viewport?: number
  /** wrapper.offsetHeight — the pin runway. */
  runwayHeight?: number
  /** track.scrollWidth — the full width of the panel row. */
  trackWidth?: number
  /** track.offsetHeight — the pinned track. */
  trackHeight?: number
  /** wrapper.offsetTop — its document offset. */
  docTop?: number
  /** `false` renders the track static, i.e. a vertical state. */
  sticky?: boolean
  /** computed `top` on the track, which computeInsetStart reads. */
  stickyTop?: number
  /** -1 mirrors the traversal (RTL page or a forced Right to Left). */
  dir?: 1 | -1
  panels?: IPanelSpec[]
}

/**
 * A section matching the widget's rendered markup: the styling classes and the
 * `js-` hooks both, since the engine selects only the latter and the contract
 * promises they travel together.
 */
export const section = (spec: ISectionSpec = {}) => {
  const {
    viewport = 1000,
    runwayHeight = 3000,
    trackWidth = 3000,
    trackHeight = 800,
    docTop = 0,
    sticky = true,
    stickyTop = 0,
    dir = 1,
    panels: panelSpecs = []
  } = spec

  const wrapper = document.createElement('div')
  wrapper.className = 'arts-hs js-arts-hs'
  if (dir === -1) {
    wrapper.style.setProperty('--arts-hs-dir', '-1')
  }

  const track = document.createElement('div')
  track.className = 'arts-hs__track js-arts-hs__track'
  track.style.position = sticky ? 'sticky' : 'static'
  track.style.top = `${stickyTop}px`

  const panels = panelSpecs.map((panelSpec) => {
    const panel = document.createElement('div')
    panel.className = 'e-con'
    if (panelSpec.id) {
      panel.id = panelSpec.id
    }
    setGeometry(panel, { offsetLeft: panelSpec.left, offsetWidth: panelSpec.width })
    track.appendChild(panel)
    return panel
  })

  wrapper.appendChild(track)
  document.body.appendChild(wrapper)

  setGeometry(wrapper, { clientWidth: viewport, offsetHeight: runwayHeight, offsetTop: docTop })
  // Terminate the offsetParent chain here so layoutDocTop(wrapper) is exactly
  // docTop. The chain walk itself is covered in geometry.dom.test.ts.
  Object.defineProperty(wrapper, 'offsetParent', { value: null, configurable: true })
  setGeometry(track, { scrollWidth: trackWidth, offsetHeight: trackHeight })

  return { wrapper, track, panels }
}

/** A DOMRect with only the fields the engine reads. */
export const rect = (over: Partial<DOMRect> = {}): DOMRect =>
  ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, ...over }) as DOMRect

export const setRect = (el: Element, over: Partial<DOMRect>): void => {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(over))
}

/**
 * Captures an observer's callback so records can be delivered synchronously —
 * happy-dom constructs all three observers but never fires them, having no
 * layout or paint to observe.
 */
export const observerSpy = () => {
  const spy = {
    deliver: (_records: unknown[]): void => {
      throw new Error('observer was never constructed')
    },
    observed: [] as Element[],
    /** Constructor options — where IntersectionObserver takes its rootMargin. */
    options: undefined as unknown,
    /** observe() options — where MutationObserver takes its filter. */
    observeOptions: undefined as unknown,
    constructed: 0,
    disconnected: 0
  }
  class Fake {
    constructor(callback: (records: unknown[]) => void, options?: unknown) {
      spy.deliver = callback
      spy.options = options
      spy.constructed++
    }
    observe(el: Element, options?: unknown) {
      spy.observed.push(el)
      if (options !== undefined) {
        spy.observeOptions = options
      }
    }
    unobserve() {}
    disconnect() {
      spy.disconnected++
    }
    takeRecords() {
      return []
    }
  }
  return { spy, Fake }
}

/** Indexed access that throws instead of yielding undefined. Fixtures the test
    itself built are known to be there, and under noUncheckedIndexedAccess the
    alternative is optional-chaining every assertion into uselessness — a
    missing fixture should fail the test naming it, loudly. */
export const nth = <T>(items: readonly T[], index: number): T => {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`fixture has no item at index ${index}`)
  }
  return item
}

// ── Editor-side fixtures ──────────────────────────────────────────────────
// Everything below is plain data or a one-method stand-in. The guards under
// test override every method they inherit and never call `super`, so an empty
// Dependency base is a faithful stand-in rather than an invention.

/** A container whose model reports our widget type, as isOurWidget reads it. */
export const OUR_WIDGET = {
  model: { get: (key: string) => (key === 'widgetType' ? 'arts-horizontal-scroll' : undefined) }
}

export const OTHER_WIDGET = {
  model: { get: (key: string) => (key === 'widgetType' ? 'nested-tabs' : undefined) }
}

/** A panel container: what the command layer hands the guards, parent and all. */
export const panelOf = (parent: unknown, id = 'p1') => ({ id, parent })

export interface IFakeDollarE {
  /** Dependencies handed to registerDataDependency, in registration order. */
  registered: any[]
  /** One registered dependency by its getId(), throwing when absent. */
  byId: (id: string) => any
  /** Calls made to isCurrentFirstTrace. */
  firstTraceQueries: string[]
}

/**
 * Install a minimal `$e` on the global scope. `firstTrace` decides what
 * isCurrentFirstTrace answers — the discriminator that separates core's own
 * repeater-driven sync from a foreign navigator drag.
 */
export const fakeDollarE = (firstTrace = false): IFakeDollarE => {
  const registered: any[] = []
  const firstTraceQueries: string[] = []

  class Dependency {}

  vi.stubGlobal('$e', {
    modules: { hookData: { Dependency } },
    hooks: {
      registerDataDependency: (dependency: unknown) => registered.push(dependency)
    },
    commands: {
      isCurrentFirstTrace: (command: string) => {
        firstTraceQueries.push(command)
        return firstTrace
      }
    }
  })

  return {
    registered,
    firstTraceQueries,
    byId: (id: string) => {
      const dependency = registered.find((d) => d.getId() === id)
      if (!dependency) {
        throw new Error(`no dependency registered with id ${id}`)
      }
      return dependency
    }
  }
}
