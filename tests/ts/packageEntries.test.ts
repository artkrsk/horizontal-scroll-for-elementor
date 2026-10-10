import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { Window } from 'happy-dom'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * The package as a consumer outside this repo sees it: its own node_modules,
 * no producer tsconfig, no producer globals, no Elementor types. Everything the
 * root and `/contract` entries reach must compile and evaluate there — a module
 * that leans on global.d.ts, or touches the DOM at import, fails here first.
 */
const root = fileURLToPath(new URL('../..', import.meta.url))
const fixture = mkdtempSync(join(tmpdir(), 'arts-hs-package-consumer-'))
const packageName = '@arts/horizontal-scroll'
const require = createRequire(import.meta.url)
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc')
mkdirSync(join(fixture, 'node_modules/@arts'), { recursive: true })
symlinkSync(root, join(fixture, 'node_modules', packageName), 'dir')
writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }))
writeFileSync(
  join(fixture, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      customConditions: ['arts-source'],
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
      verbatimModuleSyntax: true
    },
    files: ['consumer.ts']
  })
)
afterAll(() => rmSync(fixture, { recursive: true, force: true }))

const compileTypes = (source: string) => {
  writeFileSync(join(fixture, 'consumer.ts'), source)
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', join(fixture, 'tsconfig.json'), '--listFiles'],
    {
      encoding: 'utf8',
      cwd: fixture
    }
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  return result.stdout.replaceAll('\\', '/')
}

/** Producer-only modules: the Elementor host, its adapters, the editor, the globals. */
const PRODUCER_ONLY =
  /\/src\/ts\/(?:boot|global\.d|scrollspy|motion-fx-compat|diagnostics|editor\/|utils\/onElementorFrontendInit)|elementor-types/

const bundle = (specifier: string) =>
  build({
    stdin: { contents: `export * from '${specifier}'`, resolveDir: fixture, loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Provider',
    platform: 'browser',
    conditions: ['arts-source'],
    metafile: true,
    logLevel: 'silent'
  })

describe('the package entries, from an isolated consumer', () => {
  it('typechecks the contract alone, with no engine or producer declarations', () => {
    const files = compileTypes(`
import { LAYOUT_EVENT, WRAPPER_SELECTOR } from '@arts/horizontal-scroll/contract'
import type {
  IArtsHorizontalScrollGlobal,
  IHorizontalScrollLayoutDetail
} from '@arts/horizontal-scroll/contract'
declare global {
  interface Window {
    artsHorizontalScroll?: IArtsHorizontalScrollGlobal
  }
}
document.addEventListener(LAYOUT_EVENT, (event) => {
  const { wrapper, horizontal } = (event as CustomEvent<IHorizontalScrollLayoutDetail>).detail
  const top: number | null | undefined = window.artsHorizontalScroll?.getScrollTop(wrapper)
  void horizontal; void top; void WRAPPER_SELECTOR
})
export {}
`)
    expect(files).toMatch(/\/src\/ts\/contract\.ts/)
    expect(files).not.toMatch(/\/src\/ts\/(?:engine|app|probes|anchor-scroll)\.ts/)
    expect(files).not.toMatch(PRODUCER_ONLY)
  })

  it('typechecks the root factory without the Elementor host', () => {
    const files = compileTypes(`
import { createHorizontalScrollApp } from '@arts/horizontal-scroll'
import type { IHorizontalScrollApp, IHorizontalScrollRange } from '@arts/horizontal-scroll'
const app: IHorizontalScrollApp = createHorizontalScrollApp({ signal: new AbortController().signal })
app.init()
app.mount(document)
const range: IHorizontalScrollRange | null = app.getScrollRange(document.body, { inset: 0.15 })
app.unmount()
app.destroy()
void range
`)
    expect(files).not.toMatch(PRODUCER_ONLY)
  })

  it('bundles the contract as constants alone: no engine, no DOM, no globals', async () => {
    const result = await bundle(`${packageName}/contract`)
    const inputs = Object.keys(result.metafile.inputs).filter((path) => path !== '<stdin>')
    expect(inputs).toEqual([expect.stringMatching(/(?:^|\/)src\/ts\/contract\.ts$/)])
    const code = result.outputFiles[0]?.text ?? ''
    expect(code).not.toMatch(/\b(?:window|document)\b|addEventListener/)
    const context: Record<string, unknown> = {}
    runInNewContext(code, context)
    expect(context.Provider).toMatchObject({
      WRAPPER_CLASS: 'js-arts-hs',
      TRACK_CLASS: 'js-arts-hs__track',
      READY_EVENT: 'arts-hs:ready',
      LAYOUT_EVENT: 'arts-hs:layout'
    })
  })

  it('imports the root without a browser, and constructs an app that touches nothing', async () => {
    const result = await bundle(packageName)
    const code = result.outputFiles[0]?.text ?? ''
    // isEditMode()'s guarded read of elementorFrontend is fine — it answers
    // false outside Elementor. The Pro and frontend-init adapters are not.
    expect(code).not.toMatch(/elementorModules|elementor-pro\/motion-fx|elementor\/frontend\/init/)

    // No window, no document, no CSS: evaluation alone must not reach for any.
    const bare: Record<string, unknown> = {}
    runInNewContext(code, bare)
    expect(Object.keys(bare.Provider as object)).toEqual(['createHorizontalScrollApp'])

    const window = new Window()
    try {
      const context: Record<string, unknown> = {
        window,
        document: window.document,
        AbortController
      }
      runInNewContext(
        `${code}
const app = Provider.createHorizontalScrollApp()
globalThis.published = window.artsHorizontalScroll
globalThis.children = document.body.children.length`,
        context
      )
      expect(context.published).toBeUndefined()
      expect(context.children).toBe(0)
    } finally {
      await window.happyDOM.close()
    }
  })

  it('keeps the manifest and the source/style paths resolvable', async () => {
    const result = await bundle(`${packageName}/src/ts/index.ts`)
    expect(result.outputFiles[0]?.text).toContain('createHorizontalScrollApp')
    const consumerRequire = createRequire(join(fixture, 'consumer.cjs'))
    const manifest = JSON.parse(
      readFileSync(consumerRequire.resolve(`${packageName}/package.json`), 'utf8')
    )
    expect(manifest.name).toBe(packageName)
    expect(resolve(consumerRequire.resolve(`${packageName}/styles.scss`))).toBe(
      join(root, 'src/styles/index.scss')
    )
  })
})
