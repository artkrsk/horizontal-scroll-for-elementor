import { registerInsertRenderSkip, skipCanvasRender } from '@ts/editor/patches/skip-insert-render'
import { describe, expect, it, vi } from 'vitest'
import { fakeDollarE, OTHER_WIDGET, OUR_WIDGET } from '../../support'

/**
 * Core's canvas step for a repeater insert, switched off for our widget. With
 * `support_improved_repeaters` on, that step renders a `-content-single`
 * template into a `target_container` this widget does not have and throws
 * mid-command; the child container is rendered by the nested-elements hook
 * either way.
 */
describe('skipCanvasRender', () => {
  it('turns off core canvas rendering for the insert and lets it through', () => {
    const args: Record<string, unknown> = { container: OUR_WIDGET, name: 'panels', model: {} }

    expect(skipCanvasRender(args)).toBe(true)
    expect(args.renderAfterInsert).toBe(false)
  })

  it('leaves the rest of the command untouched', () => {
    const model = { panel_title: 'Panel #4' }
    const args: Record<string, unknown> = { container: OUR_WIDGET, name: 'panels', model }

    skipCanvasRender(args)

    expect(args.name).toBe('panels')
    expect(args.model).toBe(model)
  })
})

describe('registerInsertRenderSkip', () => {
  const ID = 'arts-hs-skip-insert-render'

  it('claims the repeater insert command', () => {
    const { registered, byId } = fakeDollarE()

    registerInsertRenderSkip()

    expect(registered).toHaveLength(1)
    expect(byId(ID).getCommand()).toBe('document/repeater/insert')
  })

  it('applies only to our widget', () => {
    // Every other repeater keeps core's canvas rendering.
    const { byId } = fakeDollarE()
    registerInsertRenderSkip()
    const skip = byId(ID)

    expect(skip.getConditions({ container: OUR_WIDGET })).toBe(true)
    expect(skip.getConditions({ container: OTHER_WIDGET })).toBe(false)
    expect(skip.getConditions({})).toBe(false)
  })

  it('registers nothing when the editor exposes no dependency API', () => {
    vi.stubGlobal('$e', undefined)

    expect(() => registerInsertRenderSkip()).not.toThrow()
  })
})
