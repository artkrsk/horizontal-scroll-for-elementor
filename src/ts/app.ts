// The host-facing lifecycle: one object that publishes the integration
// service, owns the document-level listeners and mounts sections on demand.
// Construction is passive; nothing happens until init()/mount(). The
// Elementor boot (./boot) is one host, a standalone page is another — both
// drive the same engine through this.

import {
  getScrollRange,
  getScrollTop,
  initLoadCorrection,
  installAnchorScroll
} from './anchor-scroll'
import { type IArtsHorizontalScrollGlobal, WRAPPER_CLASS, WRAPPER_SELECTOR } from './contract'
import { boot, getTimeline, teardown } from './engine'
import { isHTMLElement } from './utils/isHTMLElement'

export interface IHorizontalScrollAppOptions {
  /** Aborting it destroys the app. */
  signal?: AbortSignal
  /**
   * Correct a page-load deep link into a panel once init() runs (default
   * true). The Elementor boot turns it off and re-runs the correction on
   * every Elementor frontend init instead.
   */
  deepLink?: boolean
}

export interface IHorizontalScrollApp extends IArtsHorizontalScrollGlobal {
  /** Aborted by destroy(); scope host listeners to it. */
  readonly signal: AbortSignal
  /** Publishes `window.artsHorizontalScroll` and installs anchor handling. Idempotent. */
  init(): void
  /** Boots every `.js-arts-hs` section in `root` (default: the document; the root itself included). Idempotent per section. */
  mount(root?: Document | Element): void
  /** Tears down the sections this app mounted within `root` — all of them when omitted, detached ones included. */
  unmount(root?: Document | Element): void
  /** Terminal: unmounts everything, removes listeners and the global this app published. */
  destroy(): void
}

// Read at call time: importing the package root touches no global.
const host = () => window as { artsHorizontalScroll?: IArtsHorizontalScrollGlobal }

/** The sections in `root`, the root itself when it is one. */
const sectionsIn = (root: Document | Element): HTMLElement[] => {
  const found = Array.from(root.querySelectorAll<HTMLElement>(WRAPPER_SELECTOR))
  return isHTMLElement(root) && root.classList.contains(WRAPPER_CLASS) ? [root, ...found] : found
}

/** Runs once the document is parsed — authored markup above the script included. */
const whenParsed = (callback: () => void, signal: AbortSignal): void => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true, signal })
  } else {
    callback()
  }
}

export const createHorizontalScrollApp = (
  options: IHorizontalScrollAppOptions = {}
): IHorizontalScrollApp => {
  const lifetime = new AbortController()
  const mounted = new Set<HTMLElement>()
  let initialized = false

  const app: IHorizontalScrollApp = {
    contract: 1,
    getTimeline,
    getScrollTop,
    getScrollRange,
    signal: lifetime.signal,
    init() {
      if (initialized || lifetime.signal.aborted) {
        return
      }
      initialized = true
      host().artsHorizontalScroll = app
      installAnchorScroll(lifetime.signal)
      if (options.deepLink !== false) {
        whenParsed(() => initLoadCorrection(lifetime.signal), lifetime.signal)
      }
    },
    mount(root = document) {
      if (lifetime.signal.aborted) {
        return
      }
      // Sections replaced without an unmount (every Elementor editor re-render
      // builds a new wrapper) would otherwise stay reachable from here forever.
      for (const wrapper of mounted) {
        if (!wrapper.isConnected) {
          mounted.delete(wrapper)
          teardown(wrapper)
        }
      }
      for (const wrapper of sectionsIn(root)) {
        boot(wrapper)
        mounted.add(wrapper)
      }
    },
    unmount(root) {
      for (const wrapper of mounted) {
        if (!root || root.contains(wrapper)) {
          mounted.delete(wrapper)
          teardown(wrapper)
        }
      }
    },
    destroy() {
      if (lifetime.signal.aborted) {
        return
      }
      options.signal?.removeEventListener('abort', app.destroy)
      for (const wrapper of mounted) {
        teardown(wrapper)
      }
      mounted.clear()
      if (host().artsHorizontalScroll === app) {
        delete host().artsHorizontalScroll
      }
      lifetime.abort()
    }
  }

  if (options.signal?.aborted) {
    app.destroy()
  } else {
    options.signal?.addEventListener('abort', app.destroy, { once: true })
  }
  return app
}
