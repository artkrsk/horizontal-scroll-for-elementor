<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class RenderContractTest extends TestCase {

	/**
	 * @param array<int, array<string, string>> $panels
	 */
	private function render_widget( string $id, array $panels ): string {
		$widget = \Elementor\Plugin::$instance->elements_manager->create_element_instance(
			array(
				'id'         => $id,
				'elType'     => 'widget',
				'widgetType' => 'arts-horizontal-scroll',
				'settings'   => array( 'panels' => $panels ),
				'elements'   => array(),
			)
		);

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		ob_start();
		$widget->print_element();

		return (string) ob_get_clean();
	}

	/** @return array<int, array<string, string>> */
	private function panels( int $count ): array {
		$panels = array();
		for ( $i = 1; $i <= $count; $i++ ) {
			$panels[] = array(
				'_id'         => 'p' . $i,
				'panel_title' => 'Panel ' . $i,
			);
		}

		return $panels;
	}

	public function test_render_emits_wrapper_class_track_and_fallback_var(): void {
		$html = $this->render_widget( 'ahs1', $this->panels( 3 ) );

		$this->assertStringContainsString( 'arts-hs', $html );
		$this->assertStringContainsString( 'arts-hs__track', $html );
		// Styling classes are never JS hooks — scripts (ours and third-party
		// integrations) select the js- prefixed family only.
		$this->assertStringContainsString( 'js-arts-hs', $html );
		$this->assertStringContainsString( 'js-arts-hs__track', $html );
		// Server-side no-JS scroll-budget estimate: (count - 1) * 80cqw.
		$this->assertStringContainsString( '--arts-hs-distance: calc(2 * 80cqw)', $html );
	}

	public function test_two_instances_carry_independent_config(): void {
		$a = $this->render_widget( 'ahsA', $this->panels( 2 ) );
		$b = $this->render_widget( 'ahsB', $this->panels( 5 ) );

		$this->assertStringContainsString( '--arts-hs-distance: calc(1 * 80cqw)', $a );
		$this->assertStringContainsString( '--arts-hs-distance: calc(4 * 80cqw)', $b );
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
