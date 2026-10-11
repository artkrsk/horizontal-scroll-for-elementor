<?php

namespace Arts\HorizontalScroll\Managers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Base\Manager as BaseManager;
use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class Elementor extends BaseManager {

	private const VERSION_OPTION = 'arts_horizontal_scroll_version';

	/**
	 * Saved pages keep Elementor's generated post CSS and element cache until
	 * something clears them — a plugin update that changes markup or control
	 * selectors would otherwise keep serving the old pairing (moving the runway
	 * inside the widget after 1.1.0 did both). One clear per version, both stores.
	 */
	public function maybe_clear_cache_on_version_change(): void {
		$saved = get_option( self::VERSION_OPTION, '' );
		if ( is_string( $saved ) && ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION === $saved ) {
			return;
		}
		\Elementor\Plugin::$instance->files_manager->clear_cache();
		update_option( self::VERSION_OPTION, ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION );
	}

	/**
	 * Core's own nested widgets are hardcoded into its promoted-widgets list
	 * (includes/managers/widgets.php); third parties have only this hook.
	 */
	public function register_widgets( \Elementor\Widgets_Manager $widgets_manager ): void {
		// The widget needs the Nested Elements module ACTIVE, not merely
		// autoloadable. Core gates its own promoted nested widgets in
		// register_promoted_active_widgets the same way (on this very feature
		// through Elementor 4.2, on Container in the 4.3 betas), dependency check
		// off for the same reason: Container being off already forces this
		// feature inactive on every load. Through 4.2 the experiment is stable,
		// default-on and switchable by sites (the 4.3 betas make it non-mutable
		// and hidden, so only Container can take it away) — and versions
		// predating it would fatal on the widget's parent class. Degrade to
		// no-widget.
		if ( ! \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}
		$widgets_manager->register( new HorizontalScroll() );
	}
}
