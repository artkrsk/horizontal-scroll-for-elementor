// One-page menu arbitration. Pro's Nav Menu scrollspy is one
// IntersectionObserver per anchor link — threshold 0, no exclusivity, a
// viewport-midpoint band. Inside a scrubbing section that yields double
// highlights at every flush landing (a neighbor panel's edge touches the
// viewport and still "intersects") and never lights short targets sitting
// below the midpoint. There is no seam to intercept (the handler even leaks
// its observer references), so we don't patch — we own the active state for
// links whose targets live inside a section, from two event sources:
//
// - An IntersectionObserver whose root is the viewport CENTER POINT
//   (rootMargin -50% on all sides). A point lies in exactly one panel, so
//   exclusivity needs no arbitration math; its mandatory initial callback
//   covers deep-link cold starts; leaving the section empties it.
// - A MutationObserver on the menus: Pro keeps toggling the same classes on
//   its own schedule, and write order between two observers is not
//   guaranteed — re-asserting on its writes makes the corrected state the
//   fixed point. Compare-before-write keeps our own writes silent.
//
// No scroll listeners, nothing per frame.
import {
  isEditMode,
  isScrubbing,
  resolveHashTarget,
  resolvePanel,
  resolveTrack,
  resolveWrapper
} from './contract'

const ACTIVE = 'elementor-item-active'
const MENU_SELECTOR = '.elementor-nav-menu--main'

interface ISpyGroup {
  track: HTMLElement
  links: Map<HTMLAnchorElement, HTMLElement>
  current: HTMLElement | null
}

export const apply = (group: ISpyGroup): void => {
  // Vertical states are Pro's home turf — its own spy handles stacked panels.
  const scrubbing = isScrubbing(group.track)
  for (const [link, panel] of group.links) {
    const shouldBeActive = scrubbing && panel === group.current
    if (link.classList.contains(ACTIVE) !== shouldBeActive) {
      link.classList.toggle(ACTIVE, shouldBeActive)
      link.setAttribute('aria-current', shouldBeActive ? 'location' : '')
    }
  }
}

// The panel a main-menu link points at, or null when it points elsewhere —
// off-page, no hash, or a target outside any section.
export const resolveLinkPanel = (
  link: HTMLAnchorElement
): { track: HTMLElement; panel: HTMLElement } | null => {
  if (link.pathname !== location.pathname || link.hash === '') {
    return null
  }
  const target = resolveHashTarget(link.hash)
  const wrapper = target ? resolveWrapper(target) : null
  const track = wrapper ? resolveTrack(wrapper) : null
  const panel = target && track ? resolvePanel(target, track) : null
  return track && panel ? { track, panel } : null
}

// Pro's own spy scope: main-menu anchor items with same-page hashes. Keyed by
// track because that is how the point observer resolves a panel back to its
// group — a panel's parentElement IS its track.
export const collectGroups = (): {
  byTrack: Map<HTMLElement, ISpyGroup>
  menuRoots: Set<HTMLElement>
} => {
  const byTrack = new Map<HTMLElement, ISpyGroup>()
  const menuRoots = new Set<HTMLElement>()

  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    `${MENU_SELECTOR} a.elementor-item-anchor`
  )) {
    const resolved = resolveLinkPanel(link)
    if (!resolved) {
      continue
    }
    const { track, panel } = resolved
    let group = byTrack.get(track)
    if (!group) {
      group = { track, links: new Map(), current: null }
      byTrack.set(track, group)
    }
    group.links.set(link, panel)
    const root = link.closest<HTMLElement>(MENU_SELECTOR)
    if (root) {
      menuRoots.add(root)
    }
  }

  return { byTrack, menuRoots }
}

const setup = (): void => {
  if (isEditMode()) {
    return
  }
  const { byTrack, menuRoots } = collectGroups()
  if (!byTrack.size) {
    return
  }

  const pointObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const panel = entry.target
        if (!(panel instanceof HTMLElement) || !panel.parentElement) {
          continue
        }
        const group = byTrack.get(panel.parentElement)
        if (!group) {
          continue
        }
        if (entry.isIntersecting) {
          group.current = panel
        } else if (group.current === panel) {
          group.current = null
        }
        apply(group)
      }
    },
    { rootMargin: '-50% -50% -50% -50%' }
  )
  for (const group of byTrack.values()) {
    for (const panel of new Set(group.links.values())) {
      pointObserver.observe(panel)
    }
  }

  const reassert = new MutationObserver(() => {
    for (const group of byTrack.values()) {
      apply(group)
    }
  })
  for (const root of menuRoots) {
    reassert.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true })
  }
}

export const installScrollspy = (): void => {
  window.addEventListener('elementor/frontend/init', setup)
}
