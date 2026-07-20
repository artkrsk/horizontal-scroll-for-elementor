# Arts Horizontal Scroll for Elementor

Free wp.org plugin: one nested-elements widget — a pinned section whose child Containers scrub horizontally via CSS scroll-driven animations. The non-obvious engineering is documented in why-comments at the relevant code sites; read them before "simplifying" — most guard against bugs that cost real debugging to find.

## Identity (deliberate, don't "fix")

- Display name "Arts Horizontal Scroll for Elementor", wp.org slug + text domain `horizontal-scroll-for-elementor`, GitHub `artkrsk/horizontal-scroll-for-elementor`. The slug in `project.config.js` drives builds; the directory and display names differ from it on purpose.
- `composer.json` is the single version/meta source — `build/meta.js` stamps the plugin header, readme.txt, and package.json from it. `Requires Plugins:` is hand-maintained.

## Commands

- `pnpm dev` — watch + mirror to a local WP site (`DEV_TARGET` in gitignored `.env`). `pnpm build` — full release build into `dist/` with `assertRelease` checks.
- `pnpm test` — build, `wp-env start` (ports **8892/8893**), then both PHPUnit suites. Re-run just the suites: `pnpm test:php`, `pnpm test:php:no-elementor`. Tests ALWAYS run against the built `dist/` artifact, never repo source.
- `pnpm lint` (Biome), `pnpm typecheck` (tsc), `composer phpstan` (level max). Don't pipe these through `tail`/`grep` in `&&` chains — pipes mask exit codes and failures have slipped through that way.
- After changing `render()` markup, a mirrored dev site keeps serving Elementor's cached output until the page's Element Caching is cleared (`wp post meta delete <id> _elementor_element_cache`). When updating `_elementor_data` directly, delete the page's revisions too — the editor prefers newer autosaves.

## Engine invariants (violating any of these re-opens a closed saga)

- Wrapper (`{{WRAPPER}}` = `.arts-hs`) is the pin runway: `view-timeline: --arts-hs`, `overflow-x: clip` (NEVER `hidden` — creates a scroll container, kills the sticky pin), `container-type: inline-size` (hence the explicit `width: 100%` — containment strips intrinsic sizing; flex-row parents collapse without it).
- Feature-detect the NAMED timeline syntax trio, never `view()` — partial implementations misclassify and double-drive. `SUPPORTS_NATIVE` must stay evaluated at module scope: the polyfill monkeypatches `CSS.supports` once it installs, so probing later reports native in Firefox and picks the wrong path.
- Polyfilled browsers: layout flips via `.arts-hs_polyfilled`, the track animation is built through the polyfill's WAAPI surface — its CSS-parsing layer mis-maps `contain` on tall subjects and is never relied on (our stylesheet opts out entirely via `arts/scroll_timeline_polyfill/skipped_styles`).
- The polyfill comes from `arts/scroll-timeline-polyfill` (shared, patched — stock upstream aborts its whole init when one stylesheet trips its parser, and Elementor's own inline CSS does exactly that). Never bundle a second copy: the shared handle means the first registration wins, and `window.ViewTimeline` is installed non-configurably (a duplicate script no-ops on its self-detection; a foreign shim's install throws). The engine waits on `window.__artsScrollTimelinePolyfillReady` (`native`/`polyfilled`/`unavailable`). `.arts-hs_polyfilled` goes on BEFORE the animation is built and comes straight back off in the same task if the build fails — a pinned track with no scrub strands panels behind `overflow-x: clip`.
- `view-timeline-inset` is pinned to the sticky offset and JS-measured — default `auto` inherits `scroll-padding` (WP admin bar!) and near-top placements pre-translate without the clamp. Document offsets are computed from the layout tree (`layoutDocTop`), never from rects — transforms on/around the widget are supported and rects include them.
- Admin bar: consume `--arts-hs-admin-bar` only — keyed to `body.admin-bar` (the raw WP var is exposed in the editor preview where no bar renders) and zeroed under 600px (the bar becomes `position: absolute` there; WP's own query is `max-width: 600px`).
- Responsive state is CSS-vars-only (layout-state vars with horizontal fallbacks; vertical states set them; `--arts-hs-move: 0` also neutralizes the WAAPI animation). JS never reads breakpoints and never runs per scroll frame.
- Scroll-snap is neutralized on the widget, its `:has()` host, and `.arts-hs .e-con` — Pro's page Scroll Snap targets the host section, and its `.e-con:not(.e-child)` can catch the panels (nested children are created without `isInner`).
- Native-effects compatibility model: boolean visibility triggers work inside the track (IntersectionObserver is 2D); continuous vertical-progress math does not — Pro Motion FX is corrected at the `getElementViewportPercentage` seam (`motion-fx-compat.ts`), anchors deep-link via the engine's own pin math (`anchor-scroll.ts`), one-page menu highlighting is re-arbitrated (`scrollspy.ts`). Pro Sticky and Position: Fixed stay unsupported inside panels; controls can't be hidden per-subtree (type-level stacks — verified ceiling).

## Editor invariants

- Canvas scrolling: ONLY `behavior: 'instant'` — themes set `scroll-behavior: smooth` and everything else becomes a seconds-long ease that fights Elementor's own scroll actors. Scroll-to-panel was built, fought, and DESCOPED — don't reintroduce canvas auto-scrolling.
- `elementor.helpers.scrollToView` is suppressed for elements inside `.js-arts-hs` (element-top scrolling is meaningless in a pinned section).
- Panel reordering is locked on every surface: `item_actions` sort/duplicate false (all four keys — shallow merge), `$e` data-dependency vetoes on `document/repeater/move`/`duplicate` and foreign `document/elements/move`, `isLocked: true` on panels → navigator refuses the drag. Root cause: core corrupts nested children on move/duplicate (reproducible against Nested Tabs). Insert/remove are healthy and stay enabled.
- The editor bundle boots from the `elementor/nested-element-type-loaded` window event. `$e.hooks` ids are once-per-page-load — duplicate registration throws.
- Controls carrying `selectors` are filed into the separate `style_controls` stack under Optimized Control Loading; tests read them via `Performance::set_use_style_controls(true)`. Presentation-only args (`size_units`, `range`, `label`) are stripped server-side — verify those in `elementor.widgetsCache`, not PHP.

## TypeScript

Editor/frontend globals are typed via `@artemsemkin/elementor-types`; `any` only at the documented package gaps listed in `src/ts/editor/globals.d.ts`. Untyped Elementor surfaces stay behind those seams.

DOM hooks use the `js-` prefix (`.js-arts-hs`, `.js-arts-hs__track`) — `.arts-hs*` classes are styling-only and never selected from JS; markup renders both families. JS may still *toggle* styling modifiers (`arts-hs_polyfilled`).

## Release

Approved on wp.org — `deploy_to_wordpress` is `true` in release.yml, so any `vX.Y.Z` tag push builds, creates a GitHub release with the changelog extracted from readme.txt (`dev/extract-changelog.js`), and deploys to wp.org SVN trunk. CI runs on a repo-scoped self-hosted runner. `.wordpress-org/blueprints/blueprint.json` (synced to SVN `assets/` by the same workflow) drives the wp.org "Preview" button. It's generated by `pnpm blueprint:build` (`dev/blueprint/build-blueprint.js`), which inlines `dev/seed/demo-page.php` as a literal `writeFile` step — deliberately not fetched from GitHub at Playground runtime, since wp.org's SVN serves no CORS headers and a raw-URL dependency would put the live preview at the mercy of repo availability. `dev/seed/demo-page.php` must stay `WP_CLI`-guarded and safely `require`-able outside wp-cli, and its `AHS_DEMO_PAGE_ID` constant (used for `import_id` + the blueprint's `landingPage`) must stay on one line — the generator regexes it out. Re-run `pnpm blueprint:build` and commit the regenerated JSON after editing the seed script.
