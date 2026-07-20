import { execSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { ZipArchive } from 'archiver'
import { buildJs } from './js.js'
import { log } from './log.js'
import { buildCss } from './sass.js'

const COMPOSER_AUTOLOAD_FILES = [
  'ClassLoader.php',
  'InstalledVersions.php',
  'LICENSE',
  'autoload_classmap.php',
  'autoload_files.php',
  'autoload_namespaces.php',
  'autoload_psr4.php',
  'autoload_real.php',
  'autoload_static.php',
  'installed.php',
  'platform_check.php'
]

const notHidden = (src) => !path.basename(src).startsWith('.')

export async function buildRelease(ctx) {
  const { staging, zip } = ctx.paths
  const slug = ctx.config.slug

  // Empty staging IN PLACE — never delete the dir itself: wp-env bind-mounts it
  // into the test containers, and removing the mounted inode severs the mount
  // (on Linux and macOS Docker Desktop alike) until the environment restarts.
  mkdirSync(staging, { recursive: true })
  for (const entry of readdirSync(staging)) {
    rmSync(path.join(staging, entry), { recursive: true, force: true })
  }
  rmSync(zip, { force: true })

  cpSync(ctx.paths.plugin, staging, { recursive: true, filter: notHidden })
  cpSync(ctx.paths.php, path.join(staging, 'src/php'), {
    recursive: true,
    filter: (src) =>
      notHidden(src) &&
      src !== ctx.paths.libraryDir &&
      !src.startsWith(ctx.paths.libraryDir + path.sep)
  })
  cpSync(ctx.paths.vendorPrefixed, path.join(staging, 'vendor-prefixed'), {
    recursive: true,
    filter: notHidden
  })
  copyFileSync(ctx.paths.composerJson, path.join(staging, 'composer.json'))
  // composer.lock deliberately not shipped (dev-dependency metadata, no runtime role)

  // Pin the autoloader class suffix: dump-autoload reuses the suffix found in the
  // copied autoload_real.php (the repo vendor's), and identically-named
  // ComposerAutoloaderInit* classes fatal when the repo and the shipped plugin load
  // in one PHP process — which the PHPUnit harness does on every run.
  // Derived from the slug so sibling plugins never collide.
  const autoloaderSuffix = `${slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')}Plugin`
  const stagedComposerJson = path.join(staging, 'composer.json')
  const stagedComposer = JSON.parse(readFileSync(stagedComposerJson, 'utf8'))
  stagedComposer.config = {
    ...stagedComposer.config,
    'autoloader-suffix': autoloaderSuffix
  }
  writeFileSync(stagedComposerJson, `${JSON.stringify(stagedComposer, null, 2)}\n`)

  if (ctx.config.vendor.autoloaderOnly) {
    // Packages live prefixed in vendor-prefixed/ — vendor/ ships the autoloader only
    mkdirSync(path.join(staging, 'vendor/composer'), { recursive: true })
    copyFileSync(
      path.join(ctx.paths.vendor, 'autoload.php'),
      path.join(staging, 'vendor/autoload.php')
    )
    for (const file of COMPOSER_AUTOLOAD_FILES) {
      const src = path.join(ctx.paths.vendor, 'composer', file)
      if (existsSync(src)) copyFileSync(src, path.join(staging, 'vendor/composer', file))
    }
  } else {
    cpSync(ctx.paths.vendor, path.join(staging, 'vendor'), { recursive: true, filter: notHidden })
  }

  const libraryOut = path.join(staging, 'src/php/libraries', slug)
  await buildJs(ctx, { dev: false, outfile: path.join(libraryOut, `${slug}.js`) })
  if (ctx.paths.editorEntry) {
    await buildJs(ctx, {
      dev: false,
      outfile: path.join(libraryOut, `${slug}-editor.js`),
      entry: ctx.paths.editorEntry
    })
  }
  if (ctx.paths.polyfillEntry) {
    await buildJs(ctx, {
      dev: false,
      outfile: path.join(libraryOut, path.basename(ctx.paths.polyfillOut)),
      entry: ctx.paths.polyfillEntry,
      banner: ctx.polyfillBanner
    })
  }
  buildCss(ctx, { dev: false, outfile: path.join(libraryOut, `${slug}.css`) })

  log.info('Generating optimized autoloader in staging…')
  execSync('composer dump-autoload --optimize --no-dev', { cwd: staging, stdio: 'inherit' })

  await zipDirectory(staging, zip, slug)
  assertRelease(ctx)
  const size = (statSync(zip).size / 1024).toFixed(0)
  log.success(`Release ready: ${zip} (${size} KB)`)
}

// Staging lives across builds (emptied in place, see buildRelease), so macOS can
// drop .DS_Store into it at any moment — filter hidden entries at the zip boundary
function zipDirectory(dir, zipPath, rootName) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive()
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(dir, rootName, (entry) =>
      path.basename(entry.name).startsWith('.') ? false : entry
    )
    archive.finalize().catch(reject)
  })
}

function assertRelease(ctx) {
  const slug = ctx.config.slug
  // .DS_Store is not scanned here: staging persists across builds and macOS may
  // recreate it at any time — the zip-entry filter keeps it out of the release.
  const entries = readdirSync(ctx.paths.staging, { recursive: true }).map(String)
  const offenders = entries.filter(
    (e) => e.endsWith('.map') || path.basename(e) === 'composer.lock'
  )
  if (offenders.length > 0) {
    throw new Error(`Dev artifacts leaked into release: ${offenders.join(', ')}`)
  }
  const required = [
    `${slug}.php`,
    'readme.txt',
    'composer.json',
    'vendor/autoload.php',
    `src/php/libraries/${slug}/${slug}.js`
  ]
  if (ctx.paths.sassEntry) {
    required.push(`src/php/libraries/${slug}/${slug}.css`)
  }
  if (ctx.paths.editorEntry) {
    required.push(`src/php/libraries/${slug}/${slug}-editor.js`)
  }
  if (ctx.paths.polyfillEntry) {
    required.push(`src/php/libraries/${slug}/${path.basename(ctx.paths.polyfillOut)}`)
  }
  for (const rel of required) {
    if (!existsSync(path.join(ctx.paths.staging, rel))) {
      throw new Error(`Missing from release: ${rel}`)
    }
  }
  const bundleHead = readFileSync(
    path.join(ctx.paths.staging, `src/php/libraries/${slug}/${slug}.js`),
    'utf8'
  ).slice(0, 200)
  if (!bundleHead.includes(`v${ctx.version}`)) {
    throw new Error(`Bundle banner does not carry v${ctx.version}`)
  }
  const mainFile = readFileSync(path.join(ctx.paths.staging, `${slug}.php`), 'utf8')
  if (!mainFile.includes(`Version: ${ctx.version}`)) {
    throw new Error('Staged main file header Version mismatch')
  }
  if (statSync(ctx.paths.zip).size === 0) throw new Error('Empty zip')
}
