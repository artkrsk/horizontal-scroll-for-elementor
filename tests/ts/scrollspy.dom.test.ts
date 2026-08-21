// @vitest-environment happy-dom

import { apply, collectGroups, installScrollspy, resolveLinkPanel } from '@ts/scrollspy'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, observerSpy, section } from './support'

/**
 * One-page menu arbitration. Pro's own scrollspy has no exclusivity and a
 * viewport-midpoint band, which inside a scrubbing section double-highlights
 * at every flush landing. We own the active state for links whose targets live
 * in a section — and the two rules that make that safe are exclusivity (one
 * panel per group) and compare-before-write (never fight Pro's MutationObserver
 * with writes of our own).
 *
 * The observers themselves are not driven here: happy-dom constructs them but
 * never intersects, so what is worth asserting is the state machine they feed.
 */
const ACTIVE = 'elementor-item-active'

const menu = (hrefs: string[]): HTMLAnchorElement[] => {
  const nav = document.createElement('nav')
  nav.className = 'elementor-nav-menu--main'
  const links = hrefs.map((href) => {
    const link = document.createElement('a')
    link.className = 'elementor-item elementor-item-anchor'
    link.href = href
    nav.appendChild(link)
    return link
  })
  document.body.appendChild(nav)
  return links
}

const panelSection = () =>
  section({
    panels: [
      { left: 0, width: 1000, id: 'one' },
      { left: 1000, width: 1000, id: 'two' }
    ]
  })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('resolveLinkPanel', () => {
  it('resolves a same-page link to its panel and track', () => {
    const { track, panels } = panelSection()
    const link = nth(menu(['#two']), 0)

    expect(resolveLinkPanel(link)).toEqual({ track, panel: nth(panels, 1) })
  })

  it('resolves a link pointing deep inside a panel', () => {
    const { track, panels } = panelSection()
    const heading = document.createElement('h2')
    heading.id = 'deep'
    nth(panels, 0).appendChild(heading)
    const link = nth(menu(['#deep']), 0)

    expect(resolveLinkPanel(link)).toEqual({ track, panel: nth(panels, 0) })
  })

  it('ignores links to another page', () => {
    panelSection()
    const link = nth(menu(['/elsewhere#two']), 0)

    expect(resolveLinkPanel(link)).toBeNull()
  })

  it('ignores links with no hash', () => {
    panelSection()
    const link = nth(menu(['/']), 0)

    expect(resolveLinkPanel(link)).toBeNull()
  })

  it('ignores links whose target is outside any section', () => {
    panelSection()
    const footer = document.createElement('div')
    footer.id = 'footer'
    document.body.appendChild(footer)
    const link = nth(menu(['#footer']), 0)

    expect(resolveLinkPanel(link)).toBeNull()
  })

  it('ignores section-level links that resolve to no panel', () => {
    const { wrapper } = panelSection()
    wrapper.id = 'whole-section'
    const link = nth(menu(['#whole-section']), 0)

    expect(resolveLinkPanel(link)).toBeNull()
  })
})

describe('collectGroups', () => {
  it('gathers every panel link of one section into a single group', () => {
    const { track, panels } = panelSection()
    const menuLinks = menu(['#one', '#two'])
    const first = nth(menuLinks, 0)
    const second = nth(menuLinks, 1)

    const { byTrack, menuRoots } = collectGroups()

    expect(byTrack.size).toBe(1)
    const group = byTrack.get(track)
    expect(group?.links.get(first)).toBe(nth(panels, 0))
    expect(group?.links.get(second)).toBe(nth(panels, 1))
    expect(group?.current).toBeNull()
    expect(menuRoots.size).toBe(1)
  })

  it('keys separate sections separately', () => {
    const first = section({ panels: [{ left: 0, width: 1000, id: 'a' }] })
    const secondSection = section({ panels: [{ left: 0, width: 1000, id: 'b' }] })
    menu(['#a', '#b'])

    const { byTrack } = collectGroups()

    expect(byTrack.size).toBe(2)
    expect(byTrack.has(first.track)).toBe(true)
    expect(byTrack.has(secondSection.track)).toBe(true)
  })

  it('leaves links Pro should keep owning out of every group', () => {
    panelSection()
    const outside = document.createElement('div')
    outside.id = 'footer'
    document.body.appendChild(outside)
    menu(['#one', '#footer', '/elsewhere#two'])

    const { byTrack } = collectGroups()

    expect(nth([...byTrack.values()], 0).links.size).toBe(1)
  })

  it('finds nothing when no menu link points into a section', () => {
    panelSection()
    menu(['/elsewhere#two'])

    const { byTrack, menuRoots } = collectGroups()

    expect(byTrack.size).toBe(0)
    expect(menuRoots.size).toBe(0)
  })

  it('ignores anchors outside a main nav menu', () => {
    // Pro's own spy scope — matching it keeps the two from disagreeing.
    panelSection()
    const stray = document.createElement('a')
    stray.className = 'elementor-item-anchor'
    stray.href = '#one'
    document.body.appendChild(stray)

    expect(collectGroups().byTrack.size).toBe(0)
  })
})

describe('apply', () => {
  const group = () => {
    const { track, panels } = panelSection()
    const menuLinks = menu(['#one', '#two'])
    const first = nth(menuLinks, 0)
    const second = nth(menuLinks, 1)
    return {
      track,
      panels,
      links: [first, second],
      spy: {
        track,
        links: new Map([
          [first, nth(panels, 0)],
          [second, nth(panels, 1)]
        ]),
        current: nth(panels, 0) as HTMLElement | null
      }
    }
  }

  it('lights exactly the link whose panel is on stage', () => {
    const { links, spy } = group()

    apply(spy)

    expect(nth(links, 0).classList.contains(ACTIVE)).toBe(true)
    expect(nth(links, 0).getAttribute('aria-current')).toBe('location')
    expect(nth(links, 1).classList.contains(ACTIVE)).toBe(false)
  })

  it('moves the highlight as the panel on stage changes', () => {
    const { links, panels, spy } = group()
    apply(spy)

    spy.current = nth(panels, 1)
    apply(spy)

    expect(nth(links, 0).classList.contains(ACTIVE)).toBe(false)
    expect(nth(links, 1).classList.contains(ACTIVE)).toBe(true)
  })

  it('empties the group once no panel is on stage', () => {
    const { links, spy } = group()
    apply(spy)

    spy.current = null
    apply(spy)

    expect(links.some((link) => link.classList.contains(ACTIVE))).toBe(false)
  })

  it('hands the menu back to Pro in a vertical state', () => {
    // Stacked panels are Pro's home turf; its own spy handles them correctly.
    const { links, spy, track } = group()
    apply(spy)
    track.style.position = 'static'

    apply(spy)

    expect(links.some((link) => link.classList.contains(ACTIVE))).toBe(false)
  })

  it('writes nothing when the state is already correct', () => {
    // Load-bearing: Pro keeps toggling these same classes, and the
    // MutationObserver re-asserting on its writes would loop forever if our
    // own writes were not silent.
    const { links, spy } = group()
    apply(spy)
    const toggle = vi.spyOn(nth(links, 0).classList, 'toggle')
    const attribute = vi.spyOn(nth(links, 0), 'setAttribute')

    apply(spy)

    expect(toggle).not.toHaveBeenCalled()
    expect(attribute).not.toHaveBeenCalled()
  })
})

describe('the installed spy', () => {
  let point: ReturnType<typeof observerSpy>['spy']
  let menuWrites: ReturnType<typeof observerSpy>['spy']

  beforeAll(() => {
    installScrollspy()
  })

  /** Boot the spy against fresh observer fakes for this test. */
  const start = () => {
    const intersection = observerSpy()
    const mutation = observerSpy()
    point = intersection.spy
    menuWrites = mutation.spy
    vi.stubGlobal('IntersectionObserver', intersection.Fake)
    vi.stubGlobal('MutationObserver', mutation.Fake)
    window.dispatchEvent(new Event('elementor/frontend/init'))
  }

  /** One IntersectionObserver record, as the centre point enters or leaves. */
  const crossing = (panel: Element, isIntersecting: boolean) =>
    point.deliver([{ target: panel, isIntersecting }])

  it('watches the viewport centre point, not a band', () => {
    // A point lies in exactly one panel, so exclusivity needs no arbitration
    // maths — which is the whole reason Pro double-highlights and we do not.
    const { panels } = panelSection()
    menu(['#one', '#two'])

    start()

    expect(point.observed).toEqual(panels)
    expect(point.options).toEqual({ rootMargin: '-50% -50% -50% -50%' })
  })

  it('lights the link whose panel holds the centre point', () => {
    const { panels } = panelSection()
    const menuLinks = menu(['#one', '#two'])
    const first = nth(menuLinks, 0)
    const second = nth(menuLinks, 1)
    start()

    crossing(nth(panels, 1), true)

    expect(second.classList.contains(ACTIVE)).toBe(true)
    expect(first.classList.contains(ACTIVE)).toBe(false)
  })

  it('moves the highlight as the centre point crosses into the next panel', () => {
    const { panels } = panelSection()
    const menuLinks = menu(['#one', '#two'])
    const first = nth(menuLinks, 0)
    const second = nth(menuLinks, 1)
    start()

    crossing(nth(panels, 0), true)
    crossing(nth(panels, 0), false)
    crossing(nth(panels, 1), true)

    expect(first.classList.contains(ACTIVE)).toBe(false)
    expect(second.classList.contains(ACTIVE)).toBe(true)
  })

  it('empties the menu on the way out of the section', () => {
    const { panels } = panelSection()
    const links = menu(['#one', '#two'])
    start()
    crossing(nth(panels, 0), true)

    crossing(nth(panels, 0), false)

    expect(links.some((link) => link.classList.contains(ACTIVE))).toBe(false)
  })

  it('re-asserts the corrected state after Pro writes over it', () => {
    // Write order between two observers is not guaranteed, so re-asserting on
    // Pro's own writes is what makes the corrected state the fixed point.
    const { panels } = panelSection()
    const first = nth(menu(['#one', '#two']), 0)
    start()
    crossing(nth(panels, 0), true)

    first.classList.remove(ACTIVE)
    menuWrites.deliver([])

    expect(first.classList.contains(ACTIVE)).toBe(true)
  })

  it('watches the menus for those writes', () => {
    panelSection()
    menu(['#one'])

    start()

    expect(menuWrites.constructed).toBe(1)
    expect(menuWrites.observeOptions).toEqual({
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    })
  })

  it('ignores records for targets that are not panels', () => {
    const { panels } = panelSection()
    const first = nth(menu(['#one', '#two']), 0)
    start()
    crossing(nth(panels, 0), true)

    const detached = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

    expect(() => point.deliver([{ target: detached, isIntersecting: true }])).not.toThrow()
    expect(() => point.deliver([{ target: svg, isIntersecting: true }])).not.toThrow()
    expect(first.classList.contains(ACTIVE)).toBe(true)
  })

  it('ignores records from a track it does not own', () => {
    const { panels } = panelSection()
    const first = nth(menu(['#one', '#two']), 0)
    start()
    crossing(nth(panels, 0), true)

    // A panel of a section no menu link points at — no group to update.
    const stranger = section({ panels: [{ left: 0, width: 1000, id: 'x' }] })

    expect(() => crossing(nth(stranger.panels, 0), true)).not.toThrow()
    expect(first.classList.contains(ACTIVE)).toBe(true)
  })

  it('stays out of the way when no menu link points into a section', () => {
    panelSection()
    menu(['/elsewhere#two'])

    start()

    expect(point.constructed).toBe(0)
    expect(menuWrites.constructed).toBe(0)
  })

  it('stands down inside the editor preview', () => {
    vi.stubGlobal('elementorFrontend', { isEditMode: () => true })
    panelSection()
    menu(['#one'])

    start()

    expect(point.constructed).toBe(0)
  })
})
