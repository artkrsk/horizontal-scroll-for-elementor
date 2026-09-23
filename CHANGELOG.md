# Changelog

## 1.3.2

* fixed: adding or removing a panel in the Elementor editor no longer triggers error messages in the browser console – panels were always added and removed correctly.

## 1.3.1

* fixed: resizing the browser window no longer triggers a harmless "ResizeObserver loop" error message – the page itself always displayed correctly.

## 1.3.0

* added: the Elementor editor now tells you when a pinned section can't pin, and names the element responsible – usually overflow-x: hidden set on both html and body. The notice shows only in the editor and clears itself once the rule is gone.
* fixed: one-page menu highlighting keeps working after an AJAX page transition – the menu now follows panels in sections loaded after the first page.
* fixed: sites with AJAX page transitions no longer accumulate leftover scroll watchers from previous pages.

## 1.2.1

* fixed: panels carry their own on-stage range in the Elementor editor again – effects built on that range now preview exactly as they behave on the published page.
* fixed: the Pin Top Offset is respected in the editor preview – the section engages where it does on the live page instead of a little early.

## 1.2.0

* improved: the pinned section now lives inside Elementor's standard widget wrapper instead of replacing it – themes and add-ons that expect regular widget markup see it.
* fixed: the Advanced tab works again – margin, padding, background, border, shadow, and transform apply to the section on sites where Elementor's Optimized Markup experiment is off.
* fixed: pages saved with earlier versions refresh on their own – the plugin clears Elementor's CSS and element cache once after updating, no "Regenerate CSS & Data" needed.

## 1.1.0

* added: an Auto option for the Direction control, now the default – the section follows the page's language direction, so right-to-left sites mirror automatically.
* improved: the plugin page now covers right-to-left and multilingual support – WPML, Polylang, TranslatePress, and Weglot work without setup.
* fixed: right-to-left pages no longer pin a blank section – panels lay out and travel the correct way.

## 1.0.3

* improved: documentation only – the plugin page now covers what works without Elementor Pro, how the widget differs from Pro's Horizontal Scroll motion effect, and which control sets the scroll pacing.

## 1.0.2

* improved: the widget now sits in Elementor's Layout category, next to Container and Grid.
* improved: a clearer widget icon in the Elementor panel.

## 1.0.1

* improved: confirmed compatibility with WordPress 7.1.

## 1.0.0

Initial release.
