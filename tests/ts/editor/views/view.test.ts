import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDollarE } from '../../support'

/**
 * The View extends core's NestedView at module evaluation time, so the base has
 * to be in place before the import. What the fake base does NOT decide is the
 * behaviour under test: stamping every admitted child as locked, and whether
 * the delegation to super survives a base that has no filter to delegate to.
 */

interface IChild {
  attributes: { isLocked?: boolean }
}

const child = (attributes: IChild['attributes'] = {}): IChild => ({ attributes })

const loadView = async (nestedView: unknown) => {
  fakeDollarE(false, { nestedView })
  return (await import('@ts/editor/views/view')).default
}

beforeEach(() => {
  vi.resetModules()
})

describe('editor View.filter', () => {
  it('locks every child it admits', async () => {
    const View = await loadView(class {})
    const panel = child()

    new View().filter(panel, 0)

    // data-locked="true" in the Navigator is what cancels the drag gesture;
    // reordering desyncs repeater rows from children.
    expect(panel.attributes.isLocked).toBe(true)
  })

  it('locks panels from saves that predate the locked PHP defaults', async () => {
    const View = await loadView(class {})
    const legacy = child({ isLocked: false })

    new View().filter(legacy, 3)

    expect(legacy.attributes.isLocked).toBe(true)
  })

  it("passes the child and index through to the base's own filter", async () => {
    const seen: Array<[unknown, number]> = []
    class Base {
      filter(candidate: unknown, index: number): boolean {
        seen.push([candidate, index])
        return false
      }
    }
    const View = await loadView(Base)
    const panel = child()

    const admitted = new View().filter(panel, 2)

    expect(seen).toEqual([[panel, 2]])
    // The base still owns admission — locking is stamped either way.
    expect(admitted).toBe(false)
    expect(panel.attributes.isLocked).toBe(true)
  })

  it('admits the child when the base has no filter to delegate to', async () => {
    const View = await loadView(class {})

    expect(new View().filter(child(), 0)).toBe(true)
  })
})
