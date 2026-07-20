# Arts Horizontal Scroll for Elementor

[![Tests](https://github.com/artkrsk/horizontal-scroll-for-elementor/actions/workflows/test.yml/badge.svg)](https://github.com/artkrsk/horizontal-scroll-for-elementor/actions/workflows/test.yml)

Pinned horizontal-scroll sections for Elementor. The section holds still while its panels travel sideways as the page scrolls — and every panel is a real nested Container you design inline, not a template picked from a dropdown.

- **Pure CSS engine.** The browser's own scroll-driven animations move the track — no per-frame JavaScript, no GSAP, no jQuery. A few kilobytes of assets, loaded only on pages that use the widget.
- **Free-form panels.** Real Elementor Containers (Flexbox or Grid) on the same nested-elements foundation as Elementor's own widgets. The pin runs live in the editor canvas.
- **Responsive by design.** Vertical stacking on touch by default, a responsive Layout control keyed to your site's own breakpoints, and the same designed vertical layout in browsers without support — content is never trapped.
- **Plays well with Elementor Pro.** Scrolling Effects (element and background) are corrected to follow the horizontal ride instead of freezing; anchor links and shared URLs land on the exact panel; one-page menu highlighting tracks the panel on stage.
- **No Pro version of this plugin.** What you install is the whole product.

## Install

Requires WordPress 6.5+, PHP 8.0+, and the free [Elementor](https://wordpress.org/plugins/elementor/) plugin (Pro not required).

Until the wp.org listing is live, grab the zip from the [latest GitHub release](https://github.com/artkrsk/horizontal-scroll-for-elementor/releases/latest) and install it via Plugins → Add New → Upload. Then drop the **Horizontal Scroll** widget on a page and design its panels like any other Containers.

## Development

```bash
pnpm install && composer install
pnpm dev        # watch + mirror to a local WP site (DEV_TARGET in .env)
pnpm build      # release build into dist/
pnpm test       # builds, boots wp-env, runs both PHPUnit suites
pnpm lint && pnpm typecheck && composer phpstan
```

Tests always run against the built `dist/` artifact, never repo source. The non-obvious engineering decisions are documented as why-comments at the relevant code sites — read them before refactoring.

## Integration contract

Arts Horizontal Scroll drives its pinned sections with CSS scroll-driven animations. The same timeline that moves the track is available to your own widgets and animations — this section is the complete public contract. Everything listed here is stable; everything not listed is internal and may change without notice. `window.ARTS_HS.contract` (currently `1`) bumps only on breaking changes.

### Detection

- **CSS:** scope styles with the `.arts-hs` class — it is a styling marker only.
- **JS:** `el.closest('.js-arts-hs')`. The DOM hooks are `.js-arts-hs` (section wrapper) and `.js-arts-hs__track` (the moving track). `js-` classes are never styled; `.arts-hs*` classes are never selected from JS.
- **State probe (JS):** computed `position` of `.js-arts-hs__track` — `sticky` means the horizontal engine is active, `static` means a vertical state (touch devices, a vertical Layout breakpoint, browsers without support). Re-check on resize; breakpoints belong to the site owner, don't hardcode any.

### Rule #1 — never bind naked

The named timeline exists in every state, including vertical stacks, where its progress means something entirely different (the section is then a normal tall block crossing the viewport). Always gate:

```css
/* whole-animation gate: `none` in vertical states, your animation otherwise */
.my-effect {
  animation: var(--arts-hs-animation, my-fx linear both);
  animation-timeline: --arts-hs;
  animation-range: contain 20% contain 60%;
}
```

For translation math composed with `calc()`, multiply by the state var instead — it computes to `0` in vertical states and falls back to `1` in horizontal ones:

```css
transform: translateX(calc(120px * var(--arts-hs-move, 1)));
```

### The committed surface

| Name | Meaning |
|---|---|
| `--arts-hs` | named view-timeline; resolves for every descendant of *its own* section — multiple sections never cross-talk |
| `contain 0%` → `contain 100%` | pin engage → pin release (the pinned traversal) |
| `--arts-hs-animation` | gate: `none` when vertical; invalid (your fallback wins) when horizontal |
| `--arts-hs-move` | `0` vertical / `1` horizontal multiplier |
| `--arts-hs-distance` | measured px the track travels |
| `--arts-hs-dir` | `1` default / `-1` when Direction is Right to Left |
| `--arts-hs-panel-start` / `--arts-hs-panel-end` | per panel: the % window during which that panel intersects the viewport; set on each panel element, inherits into its subtree |
| `.arts-hs` / `.js-arts-hs` / `.js-arts-hs__track` | styling marker / DOM hooks |
| `arts-hs:ready` | bubbling `CustomEvent` on the wrapper once the engine boots; `detail: { wrapper }` |
| `window.ARTS_HS.getTimeline(el)` | the section timeline as a WAAPI object — see the JS path below |
| `window.ARTS_HS.contract` | integer API level, currently `1` |

### Recipe: animate while your panel is on stage

```css
.my-widget {
  animation: var(--arts-hs-animation, my-reveal linear both);
  animation-timeline: --arts-hs;
  animation-range: contain var(--arts-hs-panel-start) contain var(--arts-hs-panel-end);
}

@keyframes my-reveal {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

Refine within the window with `calc()`: `contain calc(var(--arts-hs-panel-start) + 5%)`.

### Recipe: speed-relative layer

Keyframe values may consume the inherited vars — a quarter-speed background drift:

```css
@keyframes my-drift {
  to {
    transform: translateX(calc(var(--arts-hs-distance, 0px) * -0.25 * var(--arts-hs-dir, 1) * var(--arts-hs-move, 1)));
  }
}
```

### Recipe: JS path (works on every tier; required under the polyfill)

In Firefox the plugin runs a shared polyfill, and descendant **CSS** bindings to `--arts-hs` are not supported there — use the timeline object instead. The same code also works in native browsers:

```js
const bind = (el) => {
  const timeline = window.ARTS_HS?.getTimeline?.(el)
  if (!timeline) {
    return
  }
  el.animate(
    { opacity: [0, 1] },
    { timeline, rangeStart: 'contain 20%', rangeEnd: 'contain 60%', easing: 'linear', fill: 'both' }
  )
}

const el = document.querySelector('.my-widget')
const section = el?.closest('.js-arts-hs')
if (section) {
  bind(el) // null before the engine boots…
  section.addEventListener('arts-hs:ready', () => bind(el), { once: true }) // …so also listen once
}
```

Per-panel windows on this path: read the stamped vars — `getComputedStyle(panel).getPropertyValue('--arts-hs-panel-start')`.

**Caveat:** WAAPI animations bypass the CSS gate. Handle vertical states yourself — embed `var(--arts-hs-move, 1)` inside transform value strings, or cancel the animation when the state probe reports `static`.

### What works / what doesn't inside panels

**Works:** anything triggered by *becoming visible* — IntersectionObserver geometry is 2D, so it fires on horizontal entry. Entrance animations, lazyload, autoplay-on-visible, counters all behave. Elementor Pro's Scrolling Effects (element and background) are corrected by the plugin to follow the horizontal traversal, and Pro Nav Menu one-page highlighting is re-arbitrated to track the panel on stage.

**Doesn't:** your own vertical-progress math (`getBoundingClientRect().top`, scroll-event handlers) — the section is pinned, its vertical position doesn't change; bind the timeline instead. `position: fixed` / `sticky` inside panels — the moving track is their containing block.

### Don'ts

- Don't redeclare `view-timeline: --arts-hs` inside a section — it shadows the section's timeline for your subtree.
- Don't select by `.arts-hs*` classes from JS, and don't style the `js-` classes.
- Don't wrap the section in transformed or overflow-scrolling ancestors.
- Don't read `--arts-hs-*` vars not listed above — they're internal.

## License

GPL-3.0-or-later. Bundles [arts/scroll-timeline-polyfill](https://github.com/artkrsk/arts-scroll-timeline-polyfill), which carries a patched copy of [scroll-timeline-polyfill](https://github.com/flackr/scroll-timeline) © Flackr contributors, Apache-2.0.
