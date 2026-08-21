// @vitest-environment happy-dom

import {
  distanceOf,
  isEditMode,
  isInverted,
  isScrubbing,
  pinWindowOf,
  resolveHashTarget,
  resolvePanel,
  resolveTrack,
  resolveWrapper
} from '@ts/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from './support'

/**
 * The committed surface. These probes are how the code reads the names README's
 * Integration contract table commits to, so these tests double as the executable
 * statement of it — renaming a hook class or flipping a probe's meaning fails
 * here first. The helper names themselves are internal; contractParity.test.ts
 * is what holds the table to the code.
 *
 * The probes need no stubbing: happy-dom resolves computed `position` and
 * computed custom properties for real. Only the layout metrics behind
 * distanceOf/pinWindowOf are stated by the fixture.
 */
beforeEach(() => {
  document.body.innerHTML = ''
})

describe('resolveWrapper and resolveTrack', () => {
  it('finds the section from anything inside it', () => {
    const { wrapper, panels } = section({ panels: [{ left: 0, width: 1000 }] })
    const deep = document.createElement('span')
    nth(panels, 0).appendChild(deep)

    expect(resolveWrapper(deep)).toBe(wrapper)
  })

  it('treats the wrapper itself as inside the section', () => {
    const { wrapper } = section()

    expect(resolveWrapper(wrapper)).toBe(wrapper)
  })

  it('returns null outside any section', () => {
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)

    expect(resolveWrapper(orphan)).toBeNull()
  })

  it('finds the track by its js- hook, never the styling class', () => {
    const { wrapper, track } = section()
    // The styling family is decorative only; stripping it must not hide the
    // track from JS.
    track.className = 'js-arts-hs__track'

    expect(resolveTrack(wrapper)).toBe(track)
  })
})

describe('resolveHashTarget', () => {
  it('resolves an ordinary id', () => {
    const { panels } = section({ panels: [{ left: 0, width: 1000, id: 'features' }] })

    expect(resolveHashTarget('#features')).toBe(nth(panels, 0))
  })

  it('resolves a numeric id that is not a valid selector', () => {
    // The reason this uses getElementById: "#123" throws in querySelector, and
    // Elementor hands out numeric element ids routinely.
    const { panels } = section({ panels: [{ left: 0, width: 1000, id: '123' }] })

    expect(resolveHashTarget('#123')).toBe(nth(panels, 0))
  })

  it('decodes a percent-encoded id', () => {
    const { panels } = section({ panels: [{ left: 0, width: 1000, id: 'über' }] })

    expect(resolveHashTarget('#%C3%BCber')).toBe(nth(panels, 0))
  })

  it('returns null for a bare hash', () => {
    expect(resolveHashTarget('#')).toBeNull()
    expect(resolveHashTarget('')).toBeNull()
  })

  it('returns null for malformed encoding rather than throwing', () => {
    expect(resolveHashTarget('#%E0%A4%A')).toBeNull()
  })

  it('returns null for an id nothing carries', () => {
    expect(resolveHashTarget('#nowhere')).toBeNull()
  })
})

describe('resolvePanel', () => {
  it('walks up to the track child containing the target', () => {
    const { track, panels } = section({ panels: [{ left: 0, width: 1000 }] })
    const deep = document.createElement('span')
    nth(panels, 0).appendChild(deep)

    expect(resolvePanel(deep, track)).toBe(nth(panels, 0))
  })

  it('returns the panel itself when the target is the panel', () => {
    const { track, panels } = section({ panels: [{ left: 0, width: 1000 }] })

    expect(resolvePanel(nth(panels, 0), track)).toBe(nth(panels, 0))
  })

  it('returns null for the track itself, so section anchors stay native', () => {
    const { track } = section({ panels: [{ left: 0, width: 1000 }] })

    expect(resolvePanel(track, track)).toBeNull()
  })

  it('returns null for a target outside the track', () => {
    const { wrapper, track } = section()

    expect(resolvePanel(wrapper, track)).toBeNull()
  })
})

describe('isScrubbing', () => {
  it('is true while the track is pinned', () => {
    expect(isScrubbing(section({ sticky: true }).track)).toBe(true)
  })

  it('is false in a vertical state', () => {
    // Touch, a vertical Layout breakpoint, or a browser without support all
    // land here — the documented state probe integrators are pointed at.
    expect(isScrubbing(section({ sticky: false }).track)).toBe(false)
  })
})

describe('isInverted', () => {
  it('is false by default', () => {
    expect(isInverted(section().wrapper)).toBe(false)
  })

  it('is true when the direction var is mirrored', () => {
    expect(isInverted(section({ dir: -1 }).wrapper)).toBe(true)
  })
})

describe('distanceOf', () => {
  it('is the track overhang past the scrollport', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 3000 })

    expect(distanceOf(wrapper, track)).toBe(2000)
  })

  it('never goes negative when the track fits', () => {
    const { wrapper, track } = section({ viewport: 1000, trackWidth: 600 })

    expect(distanceOf(wrapper, track)).toBe(0)
  })
})

describe('pinWindowOf', () => {
  it('is the runway minus the pinned track', () => {
    const { wrapper, track } = section({ runwayHeight: 3000, trackHeight: 800 })

    expect(pinWindowOf(wrapper, track)).toBe(2200)
  })
})

describe('isEditMode', () => {
  it('is false when Elementor frontend is absent', () => {
    expect(isEditMode()).toBe(false)
  })

  it('is false on a published page', () => {
    vi.stubGlobal('elementorFrontend', { isEditMode: () => false })

    expect(isEditMode()).toBe(false)
  })

  it('is true inside the editor preview', () => {
    vi.stubGlobal('elementorFrontend', { isEditMode: () => true })

    expect(isEditMode()).toBe(true)
  })
})
