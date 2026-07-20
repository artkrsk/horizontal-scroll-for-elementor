<?php

namespace Arts\HorizontalScroll\Managers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Base\Manager as BaseManager;
use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class Elementor extends BaseManager {

	/**
	 * Core auto-registers only its own nested widgets (hardcoded in
	 * includes/managers/widgets.php) — third parties self-register here.
	 */
	public function register_widgets( \Elementor\Widgets_Manager $widgets_manager ): void {
		// The widget needs the Nested Elements module ACTIVE, not merely
		// autoloadable. (Core's own Nested Tabs gates on 'container' — the
		// same boolean on current Elementor, where nested-elements re-derives
		// from it on every load.) The experiment is stable and default-on,
		// but sites can still switch it (or its Container dependency) off —
		// and versions predating it would fatal on the widget's parent class.
		// Degrade to no-widget.
		if ( ! \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}
		$widgets_manager->register( new HorizontalScroll() );
	}
}
