import { readFileSync } from 'node:fs'
import {
  POLYFILLED_CLASS,
  TRACK_CLASS,
  TRACK_SELECTOR,
  VAR_DIR,
  WIDGET_TYPE,
  WRAPPER_CLASS
} from '@ts/contract'
import { DIAGNOSTIC_CLASS, DIAGNOSTIC_MESSAGE_CLASS } from '@ts/diagnostics'
import { applyDefaultPanelWidth, PANEL_FLAG } from '@ts/editor/patches/guard-panel-width'
import { describe, expect, it } from 'vitest'

/**
 * The cross-language invariants nothing else can catch. Three languages state
 * the same handful of names with no build step between them: PHP renders the
 * markup and seeds the initial panels, SCSS styles what PHP rendered, and TS
 * selects and mutates both. PHPStan is type analysis and cannot see a value
 * drift; the rest of this suite never opens a .php file, and its one other
 * .scss reader, contractParity.test.ts, checks README's table, not these names.
 *
 * A rename on one side only would ship as "the engine silently stops finding
 * its own markup" — which is exactly the class of bug this file exists to make
 * impossible. It is also what ties boot.ts's deliberately spelled-out
 * element_ready literal to PHP's get_name().
 *
 * Parsed by regex rather than executed: booting WordPress for a handful of
 * strings would cost the suite a PHP runtime.
 */
const WIDGET_PHP = readFileSync('src/php/Widgets/HorizontalScroll.php', 'utf8')
const ENTRY_TS = readFileSync('src/ts/boot.ts', 'utf8')
/** The WordPress bundle's stylesheet: the generic engine plus its Elementor adapter. */
const STYLESHEET = ['src/styles/index.scss', 'src/styles/elementor.scss']
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

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
  // The panel marker: declared once as a const and seeded through it.
  const flag = WIDGET_PHP.match(/const PANEL_FLAG = '([a-z_]+)'/)
  if (!width?.[1] || !contentWidth?.[1] || !flag?.[1]) {
    throw new Error('panel_container() defaults not found in HorizontalScroll.php')
  }
  if (!WIDGET_PHP.includes("self::PANEL_FLAG => 'yes'")) {
    throw new Error('panel_container() no longer seeds the panel marker through self::PANEL_FLAG')
  }
  return {
    content_width: contentWidth[1],
    width: { unit: width[1], size: Number(width[2]) },
    [flag[1]]: 'yes'
  }
}

describe('the widget type is one name in three places', () => {
  it('matches PHP get_name()', () => {
    expect(phpStringReturn('get_name')).toBe(WIDGET_TYPE)
  })

  it('matches the element_ready hook the frontend bundle registers', () => {
    // Deliberately a literal in boot.ts so AssetsTest can grep the built
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

  it('names the panel marker identically in PHP and TS', () => {
    // The Fit Content switch is conditioned on this setting in PHP; the editor
    // stamps it in TS. A drift means the switch never shows on added panels.
    expect(WIDGET_PHP.match(/const PANEL_FLAG = '([a-z_]+)'/)?.[1]).toBe(PANEL_FLAG)
  })
})

/** The nested form the stylesheet authors: `.arts-hs__x` is written `&__x`. */
const nested = (className: string): string => `&${className.replace('arts-hs', '')}`

describe('the stylesheet and TS agree on the names they share', () => {
  it('flips layout on the class the engine toggles', () => {
    expect(STYLESHEET).toContain(`&.${POLYFILLED_CLASS}`)
  })

  it('consumes the custom properties the engine reads back', () => {
    expect(STYLESHEET).toContain(VAR_DIR)
  })

  it('styles the diagnostic bar the engine injects', () => {
    // Renamed on one side only, the bar renders unstyled: a zero-height
    // positioner with nothing visible in it, which is precisely the silent
    // failure the bar exists to prevent.
    expect(STYLESHEET).toContain(`${nested(DIAGNOSTIC_CLASS)} {`)
    expect(STYLESHEET).toContain(`${nested(DIAGNOSTIC_MESSAGE_CLASS)} {`)
  })

  it('styles the wrapper through the styling class, never the js- hook', () => {
    // The js- family is for scripts only; styling it would couple the two
    // families the contract deliberately keeps apart.
    expect(STYLESHEET).not.toContain(`.${WRAPPER_CLASS}`)
    expect(STYLESHEET).not.toContain(`.${TRACK_CLASS}`)
  })
})

/** `--arts-hs-#{$ns}name: value;` pairs declared inside the named SCSS mixin. */
const mixinVars = (mixin: string): Array<[string, string]> => {
  const body = STYLESHEET.match(
    new RegExp(`@mixin ${mixin}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`)
  )?.[1]
  if (!body) {
    throw new Error(`mixin ${mixin} not found in the stylesheet`)
  }
  return [...body.matchAll(/--arts-hs-#\{\$ns\}([a-z-]+):\s*([^;]+);/g)].map((match) => [
    match[1] ?? '',
    (match[2] ?? '').trim()
  ])
}

/** The Layout control's selectors_dictionary entry for one state. */
const layoutDictionary = (state: 'vertical' | 'horizontal'): string => {
  const match = WIDGET_PHP.match(new RegExp(`'${state}'\\s*=>\\s*'([^']+)'`))
  if (!match?.[1]) {
    throw new Error(`the layout dictionary has no ${state} entry`)
  }
  return match[1]
}

describe('the Layout control flips every layout-state var the stylesheet declares', () => {
  // The stylesheet's vertical mixin is the designed stack; the Layout
  // control's vertical dictionary restates it at {{WRAPPER}} specificity. A
  // var added to one side only leaves a breakpoint half-stacked.
  it('writes every vertical mixin var, value for value, in the vertical state', () => {
    const vars = mixinVars('arts-hs-vertical-vars')

    expect(vars.map(([name]) => name)).toContain('panel-width')
    for (const [name, value] of vars) {
      expect(layoutDictionary('vertical')).toContain(`--arts-hs-${name}: ${value};`)
    }
  })

  it('chains every vertical mixin var through its h- twin in the horizontal state', () => {
    for (const [name] of mixinVars('arts-hs-vertical-vars')) {
      expect(layoutDictionary('horizontal')).toContain(
        `--arts-hs-${name}: var(--arts-hs-h-${name});`
      )
    }
  })

  it('resets every vertical mixin var in the horizontal layout mixin', () => {
    // `animation` is the one deliberate exception: the horizontal layout
    // mixin leaves h-animation at `none` so a polyfilled or explicitly
    // horizontal breakpoint never starts the CSS animation.
    const horizontal = mixinVars('arts-hs-horizontal-layout-vars').map(([name]) => name)

    for (const [name] of mixinVars('arts-hs-vertical-vars').filter(([n]) => n !== 'animation')) {
      expect(horizontal).toContain(name)
    }
  })

  it('sizes panels from the state var, with the horizontal width as the fallback', () => {
    // Elementor panels fall back to core's own `var(--width)`, so the
    // horizontal state is byte-identical to core; authored markup falls back
    // to one screen. In every stacked state the var says 100%.
    expect(STYLESHEET).toContain(
      '> .e-con {\n      width: var(--arts-hs-panel-width, var(--width));'
    )
    expect(STYLESHEET).toContain(
      '> .e-con-boxed {\n      width: var(--arts-hs-panel-width, 100cqw);'
    )
    expect(STYLESHEET).toContain(
      ':where(.arts-hs__track > .arts-hs__panel) {\n  box-sizing: border-box;\n  width: var(--arts-hs-panel-width, 100cqw);'
    )
  })
})
