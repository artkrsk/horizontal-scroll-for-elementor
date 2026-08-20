=== Arts Horizontal Scroll for Elementor ===
Contributors: artemsemkin
Donate link: https://buymeacoffee.com/artemsemkin
Tags: elementor, horizontal scroll, scroll effects, sticky section, scroll animation
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 1.0.3
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0
GitHub Plugin URI: https://github.com/artkrsk/horizontal-scroll-for-elementor/

Pinned horizontal scroll sections for Elementor. Panels are real Containers you design inline – no templates or shortcodes. CSS-driven, responsive.

== Description ==

One widget that adds a pinned horizontal scroll section to Elementor: the section holds still while its panels travel sideways as the page scrolls. Panels are free-form content – real Elementor Containers, on the same nested-elements foundation as Elementor's own Mega Menu – so you design them right in the canvas, like any other layout. And there's no Pro version: this is the whole thing.

= Free-form panels =

Most ways to get horizontal scrolling in Elementor make you author the content somewhere else: a saved template picked from a dropdown, a section elsewhere on the page wired up by CSS ID, or a repeater with fixed image-and-text fields. Here a panel is a real Container. Drop widgets into it, nest layouts inside it, style it directly in the editor, next to the rest of your page. The pin runs live in the canvas too: scroll the editor and the section scrubs exactly like the frontend.

= How it behaves on phones and tablets =

On phones and tablets the section becomes a vertical stack by default: panels flow as normal full-width blocks, nothing to swipe against. You can keep horizontal scrolling on touch if you want it, and the responsive Layout control switches any breakpoint to the vertical stack – using your site's own Elementor breakpoints, not a hardcoded list. If a visitor's browser can't run the effect at all, it shows the same designed vertical layout – content is never trapped.

= Part of the page, not the whole page =

The widget is a normal section in your page's vertical flow, not a whole-page takeover. Open the page with one, drop another between regular sections, use several on the same page – each pins and scrubs independently, and the page scrolls vertically as usual before, between, and after. You choose how much page scroll each section consumes, and the reveal can run right-to-left. Mixed vertical and horizontal scrolling, wherever it fits your layout.

= Works with Elementor Pro's effects and one-page menus =

Elementor Pro's Scrolling Effects keep working inside the section – element and background effects follow each panel's ride across the stage instead of freezing while the section is pinned. One-page navigation works too: anchor links and shared URLs scroll to the exact panel, and with Elementor Pro's menu widget the highlighted menu item follows the panel on stage. Entrance animations, lazy-loaded media, and visibility-triggered widgets fire as their panel comes into view, and Pro's page Scroll Snap keeps working around the section.

= RTL and multilingual sites =

On a right-to-left page the section mirrors itself – panels lay out right-to-left and the ride runs the other way, with the first panel still shown first. Nothing to configure, and either direction can be forced per section. WPML, Polylang, TranslatePress, and Weglot need no setup either: panels translate like the rest of the page, and every language keeps its own scroll direction.

== Installation ==

1. Install and activate the plugin. The free Elementor plugin is the only requirement.
2. IMPORTANT: Activate "Nested Elements" under Elementor → Settings → Features.
3. Edit a page with Elementor.
4. Find the "Horizontal Scroll" widget under Layout in the widget panel and drop it on the page.

== Frequently Asked Questions ==

= Is it really free? =

Yes. There is no Pro version and nothing in the widget is locked – what you install is the whole product. If it earns its keep, there's a donate link.

= Does it require Elementor Pro? =

No. The free Elementor plugin is the only requirement, and the horizontal scroll behaves identically with or without Pro – nothing about the effect is gated behind it.

Pro is supported alongside it rather than required by it. Its Scrolling Effects and one-page menu highlighting keep working inside the section; page Scroll Snap keeps working around it, since the section takes itself out of the snap sequence instead of fighting the pin. The questions further down cover exactly how.

= How is this different from Elementor Pro's Horizontal Scroll effect? =

Pro's Horizontal Scroll is a motion effect, not a section. It slides one element sideways as the page scrolls past it, and the total distance it can travel is the Speed value times 100 pixels – so even at the maximum Speed of 10, the element moves 1000px in all. A four-panel full-width track needs several times that. The effect also never pins anything: the page keeps scrolling normally while the element slides, and the motion eases toward its target on a one-second transition rather than tracking the scroll position exactly.

Which is why the tutorials for building a real horizontal section don't use it. They give each panel 100vw, make the container holding them sticky inside an over-tall wrapper, and paste in a JavaScript snippet that measures the track and maps scroll onto it – and you re-tune that whenever the content changes. This widget is the same arrangement as a real element: panels are Containers you add and remove, the travel is measured from the actual track width so it stays correct as the content changes, and Pro's own effects keep working on elements inside the panels.

= Will it slow down my site? =

No. The browser itself moves the panels – the plugin doesn't run animation code on every scroll step and doesn't load a heavy animation library. Its whole frontend footprint is a few kilobytes of CSS and JavaScript. Browsers that don't support the underlying CSS feature yet – Firefox today, older Safari – load a small polyfill on demand; everywhere else the motion is pure CSS.

= What happens on phones and tablets? =

By default the section switches to a vertical stack on touch devices – panels become normal full-width blocks in the page flow. You can turn that off to keep the horizontal scroll, or force the vertical layout below any breakpoint with the responsive Layout control.

= Can I put any widget inside a panel? =

Yes – panels are real Elementor Containers, Flexbox or Grid alike. Anything you can build in a Container works, including nested layouts.

= The scroll feels too fast – what do I change? =

Scroll Length. It sets how much page scroll the section consumes, so raising it stretches the same journey over more scrolling. Height is a different thing: it's the pinned viewport the panels fill, not the distance they travel. Adding panels doesn't speed anything up either – the section simply gets taller, and each panel still takes the same amount of scroll to cross.

= I have a sticky header – will it get in the way? =

No. The pin offset control sets where the section sticks, so it pins below your header instead of sliding behind it. The WordPress admin bar is accounted for automatically.

= Can I mix horizontal and vertical scrolling on the same page? =

Yes – that's the default way to use it. The widget is a regular section in the page flow: place it anywhere between normal vertical content, and the page scrolls as usual before and after it. Several sections on one page work too; each runs independently.

= Is this scroll hijacking? =

No. The plugin never intercepts wheel, touch, or keyboard input. The page scrolls exactly as it always did; the section maps a stretch of that scroll to horizontal movement.

= Will it conflict with my theme or other plugins? =

It's built to stay out of the way. It doesn't bundle an animation library that could collide with your theme's scripts. Scroll snap is neutralized on the section itself, so Elementor Pro's Scroll Snap keeps working on the rest of the page. Smooth-scrolling libraries like Lenis are picked up automatically – the engine reads the native scroll position, which is exactly what they animate.

= Does it work on right-to-left and multilingual sites? =

Yes. On an RTL page the section mirrors on its own – panels lay out right-to-left and the first panel is still the one on stage – and the Direction control forces either direction when you don't want that. WPML, Polylang, TranslatePress, and Weglot all work without setup: panels are real Elementor Containers with no widget text to register, so they translate like the rest of the page. If translated RTL text doesn't mirror the section, the language's pack is missing – install it or set Direction to Right to Left.

= Which Elementor effects work on widgets inside the panels? =

Effects that fire on becoming visible work as-is: entrance animations, lazy-loaded images and backgrounds, video autoplay-on-visible, counters and progress bars all trigger as their panel scrolls into view. Elementor Pro's Scrolling Effects – on elements and on backgrounds – are corrected automatically: instead of freezing while the section is pinned, they follow the element's ride across the stage, from entering on one side to leaving on the other. Effects set to "Entire Page" read the page's own scroll, as always. Pro Sticky and Position: Fixed still don't apply inside the panels – a moving track can't hold a fixed element.

= Can I put Motion Effects or an entrance animation on the widget itself? =

An entrance animation works fine – the section fades or slides in, then pins and scrubs as usual. Elementor Pro's Scrolling and Mouse Effects on the widget itself also run, but they move the whole pinned scene as one block – usually you want them on elements inside the panels instead, where they follow the horizontal ride. Two settings do break the pin: Pro's Sticky, and Position set to absolute or fixed. The section visibly stops working the moment either is applied, and switching it back off restores everything.

= Do anchor links work with the section? =

Yes. Link to any element inside a panel – the panel's own container or anything nested in it – with a normal CSS ID, and the page scrolls to the position where that panel is on stage: on click, and when the page loads with the link already in the URL. Where the pinned scroll isn't running (touch stacking, a vertical Layout breakpoint, a browser without support), anchors scroll normally instead – nothing to configure.

= Do one-page menus highlight the current panel? =

With Elementor Pro's menu widget, yes. Point menu items at panels – or anything inside them – with normal `#` links: clicking scrolls to that panel on stage, and while the section scrubs, exactly one menu item stays highlighted: the one whose panel is in view. Elementor Pro on its own toggles items independently and often lights two at once; inside the section the plugin arbitrates that down to a single, correct highlight. Your vertical anchors before and after the section behave as usual.

= Can my own animations follow the horizontal scroll? =

Yes. The section publishes a small stable surface: a named CSS scroll timeline, state variables to gate on, per-panel range variables, and a JavaScript timeline API that works the same whether the browser is native or polyfilled. Your own scroll-driven animations can ride the same scroll as the track – the README in the GitHub repository documents the full contract.

== Screenshots ==

1. The Horizontal Scroll widget in Elementor's Layout category, next to Container and Grid.
2. Panels are real Elementor Containers – add or remove them in the widget, design them in the canvas.
3. Layout: stack panels vertically on touch devices or at any breakpoint, and set the gap between them.
4. Scroll: pinned section height, direction, how much page scroll the section consumes, and a pin offset for sticky headers.

== Changelog ==

= 1.1.0 =
* added: an Auto option for the Direction control, now the default – the section follows the page's language direction, so right-to-left sites mirror automatically.
* improved: the plugin page now covers right-to-left and multilingual support – WPML, Polylang, TranslatePress, and Weglot work without setup.
* fixed: right-to-left pages no longer pin a blank section – panels lay out and travel the correct way.

= 1.0.3 =
* improved: documentation only – the plugin page now covers what works without Elementor Pro, how the widget differs from Pro's Horizontal Scroll motion effect, and which control sets the scroll pacing.

= 1.0.2 =
* improved: the widget now sits in Elementor's Layout category, next to Container and Grid.
* improved: a clearer widget icon in the Elementor panel.

= 1.0.1 =
* improved: confirmed compatibility with WordPress 7.1.

= 1.0.0 =
Initial release.
