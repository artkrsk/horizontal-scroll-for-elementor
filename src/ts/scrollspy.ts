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
import { resolveHashTarget, resolvePanel } from './anchor-scroll'

const ACTIVE = 'elementor-item-active'

interface ISpyGroup {
  track: HTMLElement
  links: Map<HTMLAnchorElement, HTMLElement>
  current: HTMLElement | null
}

const groups: ISpyGroup[] = []

const apply = (group: ISpyGroup): void => {
  // Vertical states are Pro's home turf — its own spy handles stacked panels.
  const scrubbing = getComputedStyle(group.track).position === 'sticky'
  for (const [link, panel] of group.links) {
    const shouldBeActive = scrubbing && panel === group.current
    if (link.classList.contains(ACTIVE) !== shouldBeActive) {
      link.classList.toggle(ACTIVE, shouldBeActive)
      link.setAttribute('aria-current', shouldBeActive ? 'location' : '')
    }
  }
}

const setup = (): void => {
  if (window.elementorFrontend?.isEditMode?.() === true) {
    return
  }
  const menuRoots = new Set<HTMLElement>()
  const byTrack = new Map<HTMLElement, ISpyGroup>()

  // Pro's own spy scope: main-menu anchor items with same-page hashes.
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '.elementor-nav-menu--main a.elementor-item-anchor'
  )) {
    if (link.pathname !== location.pathname || link.hash === '') {
      continue
    }
    const target = resolveHashTarget(link.hash)
    const track = target
      ?.closest<HTMLElement>('.js-arts-hs')
      ?.querySelector<HTMLElement>('.js-arts-hs__track')
    const panel = target && track ? resolvePanel(target, track) : null
    if (!track || !panel) {
      continue
    }
    let group = byTrack.get(track)
    if (!group) {
      group = { track, links: new Map(), current: null }
      byTrack.set(track, group)
      groups.push(group)
    }
    group.links.set(link, panel)
    const root = link.closest<HTMLElement>('.elementor-nav-menu--main')
    if (root) {
      menuRoots.add(root)
    }
  }
  if (!groups.length) {
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
  for (const group of groups) {
    for (const panel of new Set(group.links.values())) {
      pointObserver.observe(panel)
    }
  }

  const reassert = new MutationObserver(() => {
    for (const group of groups) {
      apply(group)
    }
  })
  for (const root of menuRoots) {
    reassert.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true })
  }
}

window.addEventListener('elementor/frontend/init', setup)
