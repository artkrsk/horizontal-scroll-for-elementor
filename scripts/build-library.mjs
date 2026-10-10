import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compile } from 'sass'

// The package's built entries (dist/esm + dist/types) for consumers that do
// not compile `arts-source`. The WordPress bundle is arts-wp's job, from
// src/ts/boot.ts; nothing here reaches it.
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const esm = join(root, 'dist/esm')
const types = join(root, 'dist/types')
await rm(esm, { recursive: true, force: true })
await rm(types, { recursive: true, force: true })
await mkdir(esm, { recursive: true })
await build({
  absWorkingDir: root,
  entryPoints: { index: 'src/ts/index.ts', contract: 'src/ts/contract.ts' },
  outdir: esm,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022'
})
const css = compile(join(root, 'src/styles/index.scss'), { style: 'compressed' })
await writeFile(join(esm, 'styles.css'), css.css)
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc')
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.library.json'], {
  cwd: root,
  stdio: 'inherit'
})
