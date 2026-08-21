import {
  applyDefaultPanelWidth,
  coercePanelWidths,
  PANEL_WIDTH,
  registerPanelWidthGuard
} from '@ts/editor/patches/guard-panel-width'
import { describe, expect, it, vi } from 'vitest'
import { fakeDollarE, OTHER_WIDGET, OUR_WIDGET, panelOf } from '../../support'

/**
 * Both panel-width guards, as plain object transforms. A panel with no definite
 * width inherits Elementor's `--width: 100%`, which resolves circularly against
 * the max-content track: the panel blows out AND the scrub geometry breaks. The
 * two ways a panel reaches that state are the two functions below.
 */
describe('applyDefaultPanelWidth', () => {
  it('stamps one full screen onto a bare create model', () => {
    // "+ Add Panel" builds {elType, isLocked, _title} and never consults the
    // PHP default, which only seeds the INITIAL children.
    const args = { model: { elType: 'container' } as any }

    expect(applyDefaultPanelWidth(args)).toBe(true)
    expect(args.model.settings).toEqual({ content_width: 'full', width: { unit: 'vw', size: 100 } })
  })

  it('pairs the width with content_width full, which the control needs', () => {
    const args = { model: {} as any }

    applyDefaultPanelWidth(args)

    // The Width control's `--width` selector is gated on content_width: full.
    expect(args.model.settings.content_width).toBe('full')
  })

  it('respects a width the author already set', () => {
    const authored = { unit: 'px', size: 640 }
    const args = { model: { settings: { width: authored } } as any }

    applyDefaultPanelWidth(args)

    expect(args.model.settings.width).toBe(authored)
    expect(args.model.settings.content_width).toBeUndefined()
  })

  it('keeps other settings on the model', () => {
    const args = { model: { settings: { _title: 'Panel #4' } } as any }

    applyDefaultPanelWidth(args)

    expect(args.model.settings._title).toBe('Panel #4')
    expect(args.model.settings.width).toEqual(PANEL_WIDTH)
  })

  it('hands back a fresh width object per panel', () => {
    const first = { model: {} as any }
    const second = { model: {} as any }

    applyDefaultPanelWidth(first)
    applyDefaultPanelWidth(second)

    expect(first.model.settings.width).not.toBe(second.model.settings.width)
    expect(first.model.settings.width).not.toBe(PANEL_WIDTH)
  })
})

describe('coercePanelWidths', () => {
  it('rewrites a percentage width to vw, keeping the number', () => {
    // A `%` panel width means "% of the track", never "one screen" — so the
    // number is the author's intent and only the unit is wrong.
    const settings = { width: { unit: '%', size: 50 } }
    const args = { container: panelOf(OUR_WIDGET), settings }

    expect(coercePanelWidths(args)).toBe(true)
    expect(settings.width).toEqual({ unit: 'vw', size: 50 })
  })

  it('covers every responsive variant', () => {
    const settings = {
      width: { unit: '%', size: 100 },
      width_tablet: { unit: '%', size: 80 },
      width_mobile: { unit: '%', size: 60 }
    }

    coercePanelWidths({ container: panelOf(OUR_WIDGET), settings })

    expect(settings.width.unit).toBe('vw')
    expect(settings.width_tablet).toEqual({ unit: 'vw', size: 80 })
    expect(settings.width_mobile).toEqual({ unit: 'vw', size: 60 })
  })

  it('leaves units that already work alone', () => {
    const settings = {
      width: { unit: 'px', size: 640 },
      width_tablet: { unit: 'vw', size: 100 }
    }
    const before = structuredClone(settings)

    coercePanelWidths({ container: panelOf(OUR_WIDGET), settings })

    expect(settings).toEqual(before)
  })

  it('touches no setting that is not a width', () => {
    const settings = {
      width: { unit: '%', size: 50 },
      min_width: { unit: '%', size: 25 },
      widthless: { unit: '%', size: 10 }
    }

    coercePanelWidths({ container: panelOf(OUR_WIDGET), settings })

    expect(settings.min_width.unit).toBe('%')
    expect(settings.widthless.unit).toBe('%')
  })

  it('leaves containers belonging to other widgets alone', () => {
    const settings = { width: { unit: '%', size: 50 } }

    coercePanelWidths({ container: panelOf(OTHER_WIDGET), settings })

    expect(settings.width.unit).toBe('%')
  })

  it('picks the right settings object per container when editing several', () => {
    const settings = {
      p1: { width: { unit: '%', size: 50 } },
      p2: { width: { unit: '%', size: 25 } }
    }
    const args = {
      containers: [panelOf(OUR_WIDGET, 'p1'), panelOf(OTHER_WIDGET, 'p2')],
      isMultiSettings: true,
      settings
    }

    coercePanelWidths(args)

    expect(settings.p1.width.unit).toBe('vw')
    // p2 belongs to another widget, so its percentage is none of our business.
    expect(settings.p2.width.unit).toBe('%')
  })

  it('survives a command that carries no settings', () => {
    expect(() => coercePanelWidths({ container: panelOf(OUR_WIDGET) })).not.toThrow()
    expect(() => coercePanelWidths({})).not.toThrow()
  })
})

describe('registerPanelWidthGuard', () => {
  const DEFAULT_WIDTH = 'arts-hs-default-panel-width'
  const COERCE_WIDTH = 'arts-hs-coerce-panel-width'

  const register = () => {
    const dollarE = fakeDollarE()
    registerPanelWidthGuard()
    return dollarE
  }

  it('claims the create and the settings commands', () => {
    const { registered, byId } = register()

    expect(registered).toHaveLength(2)
    expect(byId(DEFAULT_WIDTH).getCommand()).toBe('document/elements/create')
    expect(byId(COERCE_WIDTH).getCommand()).toBe('document/elements/settings')
  })

  it('guards creates only inside our widget', () => {
    const { byId } = register()
    const create = byId(DEFAULT_WIDTH)

    expect(create.getConditions({ container: OUR_WIDGET, model: { elType: 'container' } })).toBe(
      true
    )
    expect(create.getConditions({ container: OTHER_WIDGET, model: { elType: 'container' } })).toBe(
      false
    )
  })

  it('guards only containers, never a widget dropped into a panel', () => {
    // "+ Add Panel" creates a container; anything else landing in the tree is
    // ordinary content and must keep Elementor's own defaults.
    const { byId } = register()

    expect(
      byId(DEFAULT_WIDTH).getConditions({ container: OUR_WIDGET, model: { elType: 'widget' } })
    ).toBe(false)
    expect(byId(DEFAULT_WIDTH).getConditions({ container: OUR_WIDGET })).toBe(false)
  })

  it('coerces widths only for panels of our widget', () => {
    const { byId } = register()
    const settings = byId(COERCE_WIDTH)

    expect(settings.getConditions({ containers: [panelOf(OUR_WIDGET)] })).toBe(true)
    expect(settings.getConditions({ container: panelOf(OUR_WIDGET) })).toBe(true)
    expect(settings.getConditions({ containers: [panelOf(OTHER_WIDGET)] })).toBe(false)
    expect(settings.getConditions({})).toBe(false)
  })

  it('fires when any one of several edited containers is ours', () => {
    const { byId } = register()

    expect(
      byId(COERCE_WIDTH).getConditions({
        containers: [panelOf(OTHER_WIDGET, 'a'), panelOf(OUR_WIDGET, 'b')]
      })
    ).toBe(true)
  })

  it('registers nothing when the editor exposes no dependency API', () => {
    vi.stubGlobal('$e', undefined)

    expect(() => registerPanelWidthGuard()).not.toThrow()
  })
})
