import './env.js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const KNOWN = {
  top: ['slug', 'entry', 'paths', 'devTarget', 'esbuildTarget', 'versionConstant', 'vendor'],
  entry: ['ts', 'sass', 'editor', 'polyfill'],
  paths: ['php', 'plugin', 'dist'],
  vendor: ['autoloaderOnly']
}

function assertKeys(obj, known, scope) {
  for (const key of Object.keys(obj)) {
    if (!known.includes(key)) {
      throw new Error(
        `Unknown config key "${scope}${key}" — remove it (every key must be read by the build)`
      )
    }
  }
}

export async function loadCtx() {
  const root = process.cwd()
  // Note: this module import is cached by Node — project.config.js edits need a dev restart.
  // composer.json below is read fresh on every call (the composer watcher relies on that).
  const config = (await import(pathToFileURL(path.join(root, 'project.config.js')).href)).default

  assertKeys(config, KNOWN.top, '')
  assertKeys(config.entry ?? {}, KNOWN.entry, 'entry.')
  assertKeys(config.paths ?? {}, KNOWN.paths, 'paths.')
  assertKeys(config.vendor ?? {}, KNOWN.vendor, 'vendor.')

  for (const key of ['slug', 'esbuildTarget', 'versionConstant']) {
    if (typeof config[key] !== 'string' || config[key] === '') {
      throw new Error(`Missing required config key "${key}"`)
    }
  }
  if (typeof config.entry?.ts !== 'string') {
    throw new Error('Missing required config key "entry.ts"')
  }
  if (config.entry.sass !== null && typeof config.entry.sass !== 'string') {
    throw new Error('"entry.sass" must be a path string or null')
  }
  for (const key of ['editor', 'polyfill']) {
    if ((config.entry[key] ?? null) !== null && typeof config.entry[key] !== 'string') {
      throw new Error(`"entry.${key}" must be a path string or null`)
    }
  }
  for (const key of ['php', 'plugin', 'dist']) {
    if (typeof config.paths?.[key] !== 'string') {
      throw new Error(`Missing required config key "paths.${key}"`)
    }
  }
  if (config.devTarget !== null && typeof config.devTarget !== 'string') {
    throw new Error('"devTarget" must be a path string or null')
  }
  if (typeof config.vendor?.autoloaderOnly !== 'boolean') {
    throw new Error('Missing required config key "vendor.autoloaderOnly"')
  }

  const composer = JSON.parse(readFileSync(path.join(root, 'composer.json'), 'utf8'))
  if (!composer.version) {
    throw new Error('composer.json needs a "version" field — it is the single version source')
  }

  const author = composer.authors?.[0] ?? {}
  const header = {
    'Plugin Name': '',
    Description: composer.description ?? '',
    Version: composer.version,
    Author: author.name ?? '',
    'Author URI': author.homepage ?? '',
    'Plugin URI': composer.homepage ?? '',
    License: composer.license ?? '',
    ...composer.wordpress,
    ...composer.plugin
  }
  if (!header['Plugin Name']) {
    throw new Error('composer.json plugin["Plugin Name"] is required (display name source)')
  }

  const banner = [
    '/*!',
    ` * ${header['Plugin Name']} v${composer.version}`,
    ` * © ${new Date().getFullYear()} ${header.Author}`.trimEnd(),
    ` * License: ${header.License}`,
    ` * ${header['Plugin URI']}`.trimEnd(),
    ' */'
  ].join('\n')

  const abs = (p) => path.resolve(root, p)
  const php = abs(config.paths.php)
  const plugin = abs(config.paths.plugin)
  const dist = abs(config.paths.dist)
  const libraryDir = path.join(php, 'libraries', config.slug)

  // Third-party bundles (the polyfill) carry their upstream identity in the
  // banner, not the plugin's — resolved from the nearest package.json above
  // the entry file so the pinned version is never restated by hand.
  let polyfillBanner = null
  if (config.entry.polyfill) {
    let dir = path.dirname(abs(config.entry.polyfill))
    while (dir !== path.dirname(dir) && !existsSync(path.join(dir, 'package.json'))) {
      dir = path.dirname(dir)
    }
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
    const homepage = pkg.homepage ?? (pkg.repository?.url ?? '').replace(/^git\+|\.git$/g, '')
    polyfillBanner = `/*! ${pkg.name} v${pkg.version} | License: ${pkg.license} | ${homepage} */`
  }

  return Object.freeze({
    root,
    config,
    composer,
    version: composer.version,
    header,
    banner,
    polyfillBanner,
    paths: Object.freeze({
      php,
      plugin,
      dist,
      libraryDir,
      tsEntry: abs(config.entry.ts),
      sassEntry: config.entry.sass ? abs(config.entry.sass) : null,
      editorEntry: config.entry.editor ? abs(config.entry.editor) : null,
      polyfillEntry: config.entry.polyfill ? abs(config.entry.polyfill) : null,
      jsOut: path.join(libraryDir, `${config.slug}.js`),
      cssOut: path.join(libraryDir, `${config.slug}.css`),
      editorOut: path.join(libraryDir, `${config.slug}-editor.js`),
      // Not "-polyfill.js": plugin-check's library_core_files pattern
      // `polyfill(\.min)?\.js` flags any filename ending that way.
      polyfillOut: path.join(libraryDir, `${config.slug}-scroll-timeline.js`),
      mainFile: path.join(plugin, `${config.slug}.php`),
      readme: path.join(plugin, 'readme.txt'),
      composerJson: path.join(root, 'composer.json'),
      composerLock: path.join(root, 'composer.lock'),
      packageJson: path.join(root, 'package.json'),
      vendor: path.join(root, 'vendor'),
      vendorPrefixed: path.join(root, 'vendor-prefixed'),
      staging: path.join(dist, config.slug),
      zip: path.join(dist, `${config.slug}.zip`),
      devTarget: config.devTarget ? abs(config.devTarget) : null
    })
  })
}
