=== Arts Horizontal Scroll for Elementor ===
Contributors: artemsemkin
Donate link: https://buymeacoffee.com/artemsemkin
Tags: elementor, horizontal scroll, scrolling sections, pinned section, scroll animation
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 8.0
Stable tag: 1.0.0
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0
GitHub Plugin URI: https://github.com/artkrsk/horizontal-scroll-for-elementor/

Pinned horizontal scroll sections. Free-form panels – no templates or shortcodes, just Containers you design inline. CSS-driven, responsive.

== Description ==

One widget that adds a pinned horizontal scroll section to Elementor: the section holds still while its panels travel sideways as the page scrolls. Panels are free-form content – real Elementor Containers, on the same nested-elements foundation as Elementor's own Mega Menu – so you design them right in the canvas, like any other layout. And there's no Pro version: this is the whole thing.

= Free-form panels =

Most ways to get horizontal scrolling in Elementor make you author the content somewhere else: a saved template picked from a dropdown, a section elsewhere on the page wired up by CSS ID, or a repeater with fixed image-and-text fields. Here a panel is a real Container. Drop widgets into it, nest layouts inside it, style it directly in the editor, next to the rest of your page. The pin runs live in the canvas too: scroll the editor and the section scrubs exactly like the frontend.

= Built for small screens =

On phones and tablets the section becomes a vertical stack by default: panels flow as normal full-width blocks, nothing to swipe against. You can keep horizontal scrolling on touch if you want it, and the responsive Layout control switches any breakpoint to the vertical stack – using your site's own Elementor breakpoints, not a hardcoded list. If a visitor's browser can't run the effect at all, it shows the same designed vertical layout – content is never trapped.

= Part of the page, not the whole page =

The widget is a normal section in your page's vertical flow, not a whole-page takeover. Open the page with one, drop another between regular sections, use several on the same page – each pins and scrubs independently, and the page scrolls vertically as usual before, between, and after. You choose how much page scroll each section consumes, and the reveal can run right-to-left. Mixed vertical and horizontal scrolling, wherever it fits your layout.

= Plays well with the rest of Elementor =

Elementor Pro's Scrolling Effects keep working inside the section – element and background effects follow each panel's ride across the stage instead of freezing while the section is pinned. One-page navigation works too: anchor links and shared URLs scroll to the exact panel, and with Elementor Pro's menu widget the highlighted menu item follows the panel on stage. Entrance animations, lazy-loaded media, and visibility-triggered widgets fire as their panel comes into view, and Pro's page Scroll Snap keeps working around the section.

== Installation ==

1. Install and activate the plugin. The free Elementor plugin is the only requirement.
2. IMPORTANT: Activate "Nested Elements" under Elementor → Settings → Features.
3. Drop the Horizontal Scroll widget on a page and design its three starter panels – each is a real Container.
4. Tune the section in the Layout controls: Height, Scroll Length, Direction, and Pin Top Offset for sticky headers.

== Frequently Asked Questions ==

= Is it really free? =

Yes. There is no Pro version and nothing in the widget is locked – what you install is the whole product. If it earns its keep, there's a donate link.

= Does it require Elementor Pro? =

No. The free Elementor plugin is the only requirement.

= Will it slow down my site? =

No. The browser itself moves the panels – the plugin doesn't run animation code on every scroll step and doesn't load a heavy animation library. Its whole frontend footprint is a few kilobytes of CSS and JavaScript. Browsers that don't support the underlying CSS feature yet – Firefox today, older Safari – load a small polyfill on demand; everywhere else the motion is pure CSS.

= What happens on phones and tablets? =

By default the section switches to a vertical stack on touch devices – panels become normal full-width blocks in the page flow. You can turn that off to keep the horizontal scroll, or force the vertical layout below any breakpoint with the responsive Layout control.

= Can I put any widget inside a panel? =

Yes – panels are real Elementor Containers, Flexbox or Grid alike. Anything you can build in a Container works, including nested layouts.

= I have a sticky header – will it get in the way? =

No. The pin offset control sets where the section sticks, so it pins below your header instead of sliding behind it. The WordPress admin bar is accounted for automatically.

= Can I mix horizontal and vertical scrolling on the same page? =

Yes – that's the default way to use it. The widget is a regular section in the page flow: place it anywhere between normal vertical content, and the page scrolls as usual before and after it. Several sections on one page work too; each runs independently.

= Is this scroll hijacking? =

No. The plugin never intercepts wheel, touch, or keyboard input. The page scrolls exactly as it always did; the section maps a stretch of that scroll to horizontal movement.

= Will it conflict with my theme or other plugins? =

It's built to stay out of the way. It doesn't bundle an animation library that could collide with your theme's scripts. Scroll snap is neutralized on the section itself, so Elementor Pro's Scroll Snap keeps working on the rest of the page. Smooth-scrolling libraries like Lenis are picked up automatically – the engine reads the native scroll position, which is exactly what they animate.

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

== Changelog ==

= 1.0.0 =
Initial release
