import { readFileSync } from 'node:fs'
import {
  POLYFILLED_CLASS,
  TRACK_CLASS,
  TRACK_SELECTOR,
  VAR_DIR,
  VAR_DISTANCE,
  WIDGET_TYPE,
  WRAPPER_CLASS
} from '@ts/contract'
import { applyDefaultPanelWidth } from '@ts/editor/patches/guard-panel-width'
import { describe, expect, it } from 'vitest'

/**
 * The cross-language invariants nothing else can catch. Three languages state
 * the same handful of names with no build step between them: PHP renders the
 * markup and seeds the initial panels, SCSS styles what PHP rendered, and TS
 * selects and mutates both. PHPStan is type analysis and cannot see a value
 * drift; the rest of this suite never opens a .php or .scss file at all.
 *
 * A rename on one side only would ship as "the engine silently stops finding
 * its own markup" — which is exactly the class of bug this file exists to make
 * impossible. It is also the enforcement the previous refactor had to write off
 * as impossible, when it left the element_ready hook name spelled out with a
 * comment saying no TS constant could keep it in sync with PHP. This can.
 *
 * Parsed by regex rather than executed: booting WordPress for six strings would
 * cost the suite a PHP runtime.
 */
const WIDGET_PHP = readFileSync('src/php/Widgets/HorizontalScroll.php', 'utf8')
const ENTRY_TS = readFileSync('src/ts/index.ts', 'utf8')
const STYLESHEET = readFileSync('src/styles/index.scss', 'utf8')

/** The literal returned by a `function <name>(): string { return '...' }`. */
const phpStringReturn = (fn: string): string => {
  const match = WIDGET_PHP.match(
    new RegExp(`function ${fn}\\(\\)\\s*:\\s*string\\s*\\{\\s*return\\s*'([^']+)'`)
  )
  if (!match?.[1]) {
    throw new Error(`no string return found for ${fn}() in HorizontalScroll.php`)
  }
  return match[1]
}

/** panel_container()'s seeded settings for the INITIAL children. */
const phpPanelDefaults = () => {
  const width = WIDGET_PHP.match(
    /'width'\s*=>\s*array\(\s*'unit'\s*=>\s*'([^']+)',\s*'size'\s*=>\s*([\d.]+),?\s*\)/
  )
  const contentWidth = WIDGET_PHP.match(/'content_width'\s*=>\s*'([^']+)'/)
  if (!width?.[1] || !contentWidth?.[1]) {
    throw new Error('panel_container() defaults not found in HorizontalScroll.php')
  }
  return {
    content_width: contentWidth[1],
    width: { unit: width[1], size: Number(width[2]) }
  }
}

describe('the widget type is one name in three places', () => {
  it('matches PHP get_name()', () => {
    expect(phpStringReturn('get_name')).toBe(WIDGET_TYPE)
  })

  it('matches the element_ready hook the frontend bundle registers', () => {
    // Deliberately a literal in index.ts so AssetsTest can grep the built
    // bundle for it — which is precisely why it needs pinning from here.
    const hook = ENTRY_TS.match(/'frontend\/element_ready\/([^']+)\.default'/)

    expect(hook?.[1]).toBe(WIDGET_TYPE)
  })
})

describe('the DOM hooks are one set of names in PHP and TS', () => {
  it('renders the wrapper hook the engine selects', () => {
    expect(WIDGET_PHP).toContain(`'class', 'arts-hs ${WRAPPER_CLASS}'`)
  })

  it('renders the track hook the engine selects', () => {
    expect(WIDGET_PHP).toContain(`class="arts-hs__track ${TRACK_CLASS}"`)
  })

  it('mounts nested children into that same track', () => {
    // The editor mounts child containers into this selector; PHP render() and
    // the JS content template have to expose it identically.
    expect(phpStringReturn('get_default_children_placeholder_selector')).toBe(TRACK_SELECTOR)
  })

  it('gives the editor template the same hooks as the rendered page', () => {
    const template = WIDGET_PHP.slice(WIDGET_PHP.indexOf('function content_template'))

    expect(template).toContain(WRAPPER_CLASS)
    expect(template).toContain(TRACK_CLASS)
  })
})

describe('a panel added in the editor matches a panel seeded by PHP', () => {
  it('agrees on width and content_width', () => {
    // "+ Add Panel" never consults panel_container(), so the editor bundle
    // restates its defaults. The two drifting apart means added panels size
    // differently from the initial three.
    const model: { settings?: Record<string, unknown> } = {}
    applyDefaultPanelWidth({ model })

    expect(model.settings).toEqual(phpPanelDefaults())
  })
})

describe('the stylesheet and TS agree on the names they share', () => {
  it('flips layout on the class the engine toggles', () => {
    expect(STYLESHEET).toContain(`&.${POLYFILLED_CLASS}`)
  })

  it('consumes the custom properties the engine writes', () => {
    expect(STYLESHEET).toContain(VAR_DISTANCE)
    expect(STYLESHEET).toContain(VAR_DIR)
  })

  it('styles the wrapper through the styling class, never the js- hook', () => {
    // The js- family is for scripts only; styling it would couple the two
    // families the contract deliberately keeps apart.
    expect(STYLESHEET).not.toContain(`.${WRAPPER_CLASS}`)
    expect(STYLESHEET).not.toContain(`.${TRACK_CLASS}`)
  })
})
