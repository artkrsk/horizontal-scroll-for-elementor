<?php
/**
 * Plugin Name: Arts Horizontal Scroll for Elementor
 * Description: Pinned horizontal-scroll sections — every panel is a real nested Container you design inline. Vertical re-layout on touch. No GSAP, no jQuery.
 * Version: 1.0.0
 * Author: Artem Semkin
 * License: GPLv3
 * License URI: https://www.gnu.org/licenses/gpl-3.0
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Requires Plugins: elementor
 * Text Domain: horizontal-scroll-for-elementor
 * Plugin URI: https://artemsemkin.com/plugins/horizontal-scroll-for-elementor/
 * Author URI: https://artemsemkin.com
 * Tested up to: 7.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION', '1.0.0' );

require_once __DIR__ . '/vendor/autoload.php';

// No dependency guard needed: "Requires Plugins: elementor" is enforced by WP 6.5+
// and every Elementor-facing entry point is an elementor/* hook (inert without it).
// Plugin extends Base\Plugin (arts/base BasePlugin), which schedules run() on the
// hook/priority from Plugin::get_default_run_action()/get_run_action_priority().
\Arts\HorizontalScroll\Plugin::instance();

// Registers the shared `scroll-timeline-polyfill` handle our frontend script
// depends on. Self-gating: browsers with native scroll-driven animations fetch
// the small loader and nothing more. The handle is deliberately shared — if
// another Arts plugin already registered it, the first registration wins and
// only one copy of the polyfill ever installs itself on the page.
\ArtsHorizontalScroll\Arts\ScrollTimelinePolyfill\Plugin::instance();
