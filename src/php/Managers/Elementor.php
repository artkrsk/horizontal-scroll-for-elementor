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
		// autoloadable. Same gate core puts on its own promoted nested widgets
		// (register_promoted_active_widgets), dependency check off for the same
		// reason: Container being off already forces this feature inactive on
		// every load. The experiment is stable and default-on, but sites can
		// still switch it (or its Container dependency) off — and versions
		// predating it would fatal on the widget's parent class. Degrade to
		// no-widget.
		if ( ! \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}
		$widgets_manager->register( new HorizontalScroll() );
	}
}
