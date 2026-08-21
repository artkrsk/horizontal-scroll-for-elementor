import { registerPanelMoveLock } from '@ts/editor/patches/lock-panel-moves'
import { describe, expect, it, vi } from 'vitest'
import { fakeDollarE, OTHER_WIDGET, OUR_WIDGET, panelOf } from '../../support'

/**
 * Reordering nested children is a core gap: a navigator or canvas drag runs a
 * plain document/elements/move that reorders elements[] with no reverse sync
 * into the repeater rows, so the two desync and the next repeater operation
 * resolves the wrong child. Foreign moves of our panels are therefore blocked.
 *
 * The subtle half is that core's OWN repeater-move hook syncs the child by
 * running the very same command — under a document/repeater/move first trace.
 * Getting that discriminator wrong breaks legitimate reordering in one
 * direction and lets corruption through in the other, which is what makes it
 * worth pinning.
 *
 * The registration machinery is faked, not Elementor's behaviour: the guards
 * override every method they inherit and never call `super`.
 */
const MOVE_LOCK = 'arts-hs-lock-panel-moves'
const SORT_VETO = 'arts-hs-lock-repeater-sort'
const DUPLICATE_VETO = 'arts-hs-lock-repeater-duplicate'

/** Register the guards against a fresh $e and hand back the lookup. */
const lock = (firstTrace = false) => {
  const dollarE = fakeDollarE(firstTrace)
  registerPanelMoveLock()
  return dollarE
}

describe('registerPanelMoveLock', () => {
  it('claims the three commands that can corrupt nested children', () => {
    const { registered, byId } = lock()

    expect(registered).toHaveLength(3)
    expect(byId(MOVE_LOCK).getCommand()).toBe('document/elements/move')
    expect(byId(SORT_VETO).getCommand()).toBe('document/repeater/move')
    expect(byId(DUPLICATE_VETO).getCommand()).toBe('document/repeater/duplicate')
  })

  it('registers nothing when the editor exposes no dependency API', () => {
    // Older Elementor, or a load order where $e is not up yet: degrade to no
    // guards rather than throwing out of Module's constructor.
    vi.stubGlobal('$e', undefined)

    expect(() => registerPanelMoveLock()).not.toThrow()
  })
})

describe('the element-move lock', () => {
  it('blocks a navigator drag of one of our panels', () => {
    const { byId } = lock()
    const move = byId(MOVE_LOCK)

    expect(move.getConditions({ containers: [panelOf(OUR_WIDGET)] })).toBe(true)
    expect(move.apply()).toBe(false)
  })

  it('blocks a single-container drag just the same', () => {
    const { byId } = lock()

    expect(byId(MOVE_LOCK).getConditions({ container: panelOf(OUR_WIDGET) })).toBe(true)
  })

  it('blocks a drop INTO our track from elsewhere', () => {
    const { byId } = lock()

    expect(byId(MOVE_LOCK).getConditions({ target: OUR_WIDGET })).toBe(true)
  })

  it('lets core repeater-driven sync through', () => {
    // Core's own nested-repeater move hook reorders the child by running
    // document/elements/move UNDER a document/repeater/move first trace. That
    // is the one sanctioned path, and blocking it would break the repeater.
    const { byId, firstTraceQueries } = lock(true)

    expect(byId(MOVE_LOCK).getConditions({ containers: [panelOf(OUR_WIDGET)] })).toBe(false)
    expect(firstTraceQueries).toContain('document/repeater/move')
  })

  it('ignores moves that have nothing to do with our widget', () => {
    const { byId } = lock()
    const move = byId(MOVE_LOCK)

    expect(move.getConditions({ containers: [panelOf(OTHER_WIDGET)] })).toBe(false)
    expect(move.getConditions({ target: OTHER_WIDGET })).toBe(false)
    expect(move.getConditions({})).toBe(false)
  })
})

describe('the repeater vetoes', () => {
  it.each([
    ['row sort', SORT_VETO],
    ['row duplicate', DUPLICATE_VETO]
  ])('blocks %s on our widget', (_label, id) => {
    // Both corrupt nested children in current Elementor: its own Nested Tabs
    // drops a child on move, and duplicate clones the row but not the child
    // container, after which the index-only correlation deletes wrong children.
    const { byId } = lock()
    const veto = byId(id)

    expect(veto.getConditions({ container: OUR_WIDGET })).toBe(true)
    expect(veto.apply()).toBe(false)
  })

  it.each([
    ['row sort', SORT_VETO],
    ['row duplicate', DUPLICATE_VETO]
  ])('leaves %s alone on every other widget', (_label, id) => {
    const { byId } = lock()

    expect(byId(id).getConditions({ container: OTHER_WIDGET })).toBe(false)
  })

  it('never touches add or remove', () => {
    // Those two are verified healthy and stay open — the repeater is the one
    // reorder surface core designed for.
    const { registered } = lock()
    const commands = registered.map((d) => d.getCommand())

    expect(commands).not.toContain('document/repeater/insert')
    expect(commands).not.toContain('document/repeater/remove')
  })
})
