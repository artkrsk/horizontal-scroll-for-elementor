import { build, context } from 'esbuild'
import { log } from './log.js'

// Plain IIFE, no globalName: the bundles are pure side-effect scripts.
// Banner goes through esbuild's own option so sourcemaps stay line-accurate.
function options(ctx, { dev, outfile, entry, banner }) {
  return {
    entryPoints: [entry ?? ctx.paths.tsEntry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ctx.config.esbuildTarget,
    minify: !dev,
    sourcemap: dev ? 'linked' : false,
    banner: { js: banner ?? ctx.banner },
    logLevel: 'warning'
  }
}

export async function buildJs(ctx, { dev, outfile, entry, banner }) {
  await build(options(ctx, { dev, outfile, entry, banner }))
  log.success(`JS compiled: ${outfile}`)
}

export async function watchJs(ctx, outfile, entry) {
  let resolveFirst
  const firstBuild = new Promise((resolve) => {
    resolveFirst = resolve
  })
  const c = await context({
    ...options(ctx, { dev: true, outfile, entry }),
    plugins: [
      {
        name: 'notify',
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length > 0) return
            log.success(`JS compiled: ${outfile}`)
            resolveFirst()
          })
        }
      }
    ]
  })
  await c.watch()
  return { dispose: () => c.dispose(), firstBuild }
}
