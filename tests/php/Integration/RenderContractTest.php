<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class RenderContractTest extends TestCase {

	public function test_render_emits_wrapper_class_track_and_fallback_var(): void {
		$html = $this->render_widget( 'ahs1', $this->panels( 3 ) );

		$this->assertStringContainsString( 'arts-hs', $html );
		$this->assertStringContainsString( 'arts-hs__track', $html );
		// Styling classes are never JS hooks — scripts (ours and third-party
		// integrations) select the js- prefixed family only.
		$this->assertStringContainsString( 'js-arts-hs', $html );
		$this->assertStringContainsString( 'js-arts-hs__track', $html );
		// The runway is the widget's own inner div, never {{WRAPPER}} — core owns
		// the root and its Advanced-tab selector pairing (see AdvancedTabTest).
		$this->assertGreaterThan(
			strpos( $html, 'elementor-widget-arts-horizontal-scroll' ),
			strpos( $html, 'js-arts-hs' )
		);
		// Server-side no-JS scroll-budget estimate: (count - 1) * 80cqw.
		$this->assertStringContainsString( '--arts-hs-distance: calc(2 * 80cqw)', $html );
	}

	public function test_two_instances_carry_independent_config(): void {
		$a = $this->render_widget( 'ahsA', $this->panels( 2 ) );
		$b = $this->render_widget( 'ahsB', $this->panels( 5 ) );

		$this->assertStringContainsString( '--arts-hs-distance: calc(1 * 80cqw)', $a );
		$this->assertStringContainsString( '--arts-hs-distance: calc(4 * 80cqw)', $b );
	}

	public function test_an_empty_repeater_renders_a_section_with_no_travel(): void {
		// The floor under count(): an author who deletes every panel, or an
		// import that lands the widget with none, must get a normal block —
		// not a runway sized by calc(-1 * 80cqw).
		$html = $this->render_widget( 'ahsEmpty', array() );

		$this->assertStringContainsString( '--arts-hs-distance: calc(0 * 80cqw)', $html );
		$this->assertStringContainsString( 'js-arts-hs__track', $html );
	}

	public function test_render_and_content_template_share_placeholder_selector(): void {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );
		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		ob_start();
		$widget->print_template();
		$template = (string) ob_get_clean();

		// The editor mounts child containers into this selector — PHP render()
		// and the JS content template must expose it identically. The
		// placeholder selector targets the js- hook, so it must be present.
		$this->assertStringContainsString( 'js-arts-hs__track', $template );
	}

	public function test_panels_repeater_uses_nested_repeater_control_type(): void {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );
		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		$controls = $widget->get_controls();

		$this->assertIsArray( $controls );
		$this->assertArrayHasKey( 'panels', $controls );
		$this->assertIsArray( $controls['panels'] );
		$this->assertSame(
			\Elementor\Modules\NestedElements\Controls\Control_Nested_Repeater::CONTROL_TYPE,
			$controls['panels']['type']
		);
	}
}
