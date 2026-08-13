<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class AssetsTest extends TestCase {

	/**
	 * Fire wp_enqueue_scripts, which is what registers both our handles and the
	 * shared loader's. Elementor's own callbacks ride the same action and read
	 * the ACTIVE kit, so one has to exist first — otherwise they warn on a null
	 * post and the failure reads as ours. This is the activation-hook path:
	 * create_default() alone inserts a kit without making it active.
	 */
	private function register_frontend_assets(): void {
		\Elementor\Core\Kits\Manager::create_default_kit();

		do_action( 'wp_enqueue_scripts' );
	}

	private function widget(): HorizontalScroll {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		return $widget;
	}

	public function test_widget_declares_conditional_assets(): void {
		$this->assertSame( array( 'arts-horizontal-scroll' ), $this->widget()->get_style_depends() );
		$this->assertSame( array( 'arts-horizontal-scroll' ), $this->widget()->get_script_depends() );
	}

	public function test_frontend_script_depends_on_the_shared_polyfill_loader(): void {
		$this->register_frontend_assets();

		$script = wp_scripts()->query( 'arts-horizontal-scroll', 'registered' );
		$this->assertNotFalse( $script );
		// Not an optimization: the loader publishes the readiness promise the
		// engine waits on, and WP would silently drop our script if the handle
		// were missing — so this dependency is load-bearing twice over.
		$this->assertContains( 'scroll-timeline-polyfill', $script->deps );
	}

	public function test_shared_polyfill_loader_is_registered_and_self_gating(): void {
		$this->register_frontend_assets();

		$loader = wp_scripts()->query( 'scroll-timeline-polyfill', 'registered' );
		$this->assertNotFalse( $loader );
		$this->assertIsString( $loader->src );
		// Served out of the Strauss-prefixed vendor tree, so the package's own
		// Plugin resolves its URL relative to itself.
		$this->assertStringContainsString(
			'vendor-prefixed/arts/scroll-timeline-polyfill/src/php/libraries/scroll-timeline/loader.js',
			$loader->src
		);
	}

	public function test_our_stylesheet_opts_out_of_polyfill_transpiling(): void {
		/** @var array<int, string> $skipped */
		$skipped = apply_filters( 'arts/scroll_timeline_polyfill/skipped_styles', array() );

		// The track's animation is WAAPI-built; the polyfill's CSS layer must
		// not refetch and rewrite our sheet (nor drive a second animation).
		$this->assertContains( 'arts-horizontal-scroll', $skipped );
	}

	public function test_built_stylesheet_defaults_vertical_and_gates_horizontal(): void {
		$css = file_get_contents(
			WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/src/php/libraries/horizontal-scroll-for-elementor/horizontal-scroll-for-elementor.css'
		);

		$this->assertIsString( $css );
		// The gate probes the NAMED syntax the engine uses — probing view()
		// misclassifies partial implementations.
		$this->assertMatchesRegularExpression( '/@supports\s*\(view-timeline: --probe block\)/', $css );
		// Polyfilled state flips layout only; the WAAPI animation is built by JS.
		$this->assertStringContainsString( '.arts-hs_polyfilled', $css );
		$this->assertStringContainsString( '@keyframes arts-hs-slide', $css );
		// Gate-granted twins: the Layout control's horizontal state chains
		// through --arts-hs-h-* so a narrower-breakpoint horizontal can undo a
		// wider vertical without kit CSS outranking feature detection. Both
		// states must compile: vertical values (base/touch) and initial (gates).
		$this->assertMatchesRegularExpression( '/--arts-hs-h-track-position:\s*static/', $css );
		$this->assertMatchesRegularExpression( '/--arts-hs-h-track-position:\s*initial/', $css );
		$this->assertMatchesRegularExpression( '/--arts-hs-h-animation:\s*none/', $css );
		$this->assertMatchesRegularExpression( '/--arts-hs-h-animation:\s*initial/', $css );
		$this->assertMatchesRegularExpression( '/overflow-x:\s*clip/', $css );
		// Inline-size containment strips intrinsic sizing — without an
		// explicit width the widget collapses inside flex-row parents.
		$this->assertMatchesRegularExpression( '/\.arts-hs\{[^}]*width:\s*100%/', $css );
		// Pro's page Scroll Snap would make the runway (or its host section)
		// a viewport-height snap stop and trap scrolling at the edge.
		$this->assertMatchesRegularExpression( '/:has\(\.arts-hs\)[^}]*\{[^}]*scroll-snap-align:\s*none\s*!important/s', $css );
		// Explicit inset — default `auto` inherits scroll-padding (WP sets it
		// to the admin-bar height), shifting the range off the sticky engage
		// point. The JS-measured inset-start clamps top-of-page placements.
		$this->assertMatchesRegularExpression(
			'/view-timeline-inset:\s*var\(\s*--arts-hs-inset-start,\s*calc\(var\(--arts-hs-offset,\s*0px\)\s*\+\s*var\(--arts-hs-admin-bar,\s*0px\)\)\s*\)/',
			$css
		);
		// Logged-in frontend: pinned panels must clear the fixed admin bar —
		// via our own metric, honored only under body.admin-bar (the editor
		// preview exposes WP's var without rendering the bar) and zeroed
		// below 600px where core makes the bar scroll away.
		$this->assertMatchesRegularExpression(
			'/body\.admin-bar\s+\.arts-hs\s*\{[^}]*--arts-hs-admin-bar:\s*var\(--wp-admin--admin-bar--height,\s*0px\)/',
			$css
		);
		$this->assertMatchesRegularExpression(
			'/@media\s*screen\s*and\s*\(max-width:\s*600px\)\s*\{[^}]*body\.admin-bar[^}]*\{[^}]*--arts-hs-admin-bar:\s*0px/',
			$css
		);
	}

	public function test_built_frontend_bundle_carries_engine(): void {
		$js = file_get_contents(
			WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/src/php/libraries/horizontal-scroll-for-elementor/horizontal-scroll-for-elementor.js'
		);

		$this->assertIsString( $js );
		$this->assertStringContainsString( 'arts-horizontal-scroll.default', $js );
		$this->assertStringContainsString( 'ResizeObserver', $js );
		// Per-panel range vars: the contract's "animate while your panel is on
		// stage" recipe (README: Integration contract).
		$this->assertStringContainsString( '--arts-hs-panel-start', $js );
		$this->assertStringContainsString( '--arts-hs-panel-end', $js );
		// JS timeline access — one path across native and polyfilled tiers
		// (README: the JS-path recipe): pull API + boot event.
		$this->assertStringContainsString( 'getTimeline', $js );
		$this->assertStringContainsString( 'arts-hs:ready', $js );
		// The shared loader owns installing the polyfill; we wait on its
		// promise rather than injecting a second copy of our own.
		$this->assertStringContainsString( '__artsScrollTimelinePolyfillReady', $js );
	}

	public function test_built_frontend_bundle_corrects_motion_fx(): void {
		$js = file_get_contents(
			WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/src/php/libraries/horizontal-scroll-for-elementor/horizontal-scroll-for-elementor.js'
		);

		$this->assertIsString( $js );
		// Pro's viewport-range effects all funnel through this one core utility;
		// the bundle wraps it with the horizontal mirror for in-track elements.
		$this->assertStringContainsString( 'getElementViewportPercentage', $js );
		// Pro's public re-measure event, fired after measure() so cached
		// background-layer dimensions follow panel resizes.
		$this->assertStringContainsString( 'elementor-pro/motion-fx/recalc', $js );
	}

	public function test_built_frontend_bundle_arbitrates_scrollspy(): void {
		$js = file_get_contents(
			WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/src/php/libraries/horizontal-scroll-for-elementor/horizontal-scroll-for-elementor.js'
		);

		$this->assertIsString( $js );
		// Pro's Nav Menu one-page spy has no exclusivity and misses in-track
		// targets; the bundle owns the active state via a viewport-center-point
		// IntersectionObserver.
		$this->assertStringContainsString( 'elementor-item-active', $js );
		$this->assertStringContainsString( 'elementor-item-anchor', $js );
		$this->assertStringContainsString( '-50% -50% -50% -50%', $js );
	}

	public function test_no_second_polyfill_copy_is_shipped(): void {
		// One copy per page, from arts/scroll-timeline-polyfill: ViewTimeline is
		// installed non-configurably, so a second copy can never cleanly override
		// it (a duplicate script no-ops on its self-detection; a foreign shim's
		// install throws).
		$library = WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/src/php/libraries/horizontal-scroll-for-elementor';

		$this->assertFileDoesNotExist( $library . '/horizontal-scroll-for-elementor-scroll-timeline.js' );
		$this->assertFileExists(
			WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/vendor-prefixed/arts/scroll-timeline-polyfill/src/php/libraries/scroll-timeline/scroll-timeline.js'
		);
	}
}
