<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;
use Elementor\Controls_Manager;

class ControlsTest extends TestCase {

	/** @return array<string, array<string, mixed>> */
	private function controls(): array {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );
		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		// Optimized Control Loading files controls carrying `selectors` into
		// a separate style_controls stack; get_controls() merges it back only
		// under this flag — the editor's own read path.
		\Elementor\Core\Frontend\Performance::set_use_style_controls( true );
		$controls = $widget->get_controls();
		\Elementor\Core\Frontend\Performance::set_use_style_controls( false );

		$this->assertIsArray( $controls );

		/** @var array<string, array<string, mixed>> $controls */
		return $controls;
	}

	/**
	 * @param mixed $value
	 * @return array<mixed, mixed>
	 */
	private function array_value( $value ): array {
		$this->assertIsArray( $value );

		return $value;
	}

	/** @param mixed $value */
	private function string_value( $value ): string {
		$this->assertIsString( $value );

		return $value;
	}

	public function test_sliders_write_scoped_css_vars(): void {
		$controls = $this->controls();

		$expected = array(
			'viewport_height' => '--arts-hs-height: {{SIZE}}{{UNIT}};',
			'panels_gap'      => '--arts-hs-gap: {{SIZE}}{{UNIT}};',
			'pin_offset'      => '--arts-hs-offset: {{SIZE}}{{UNIT}};',
			'scroll_factor'   => '--arts-hs-factor: {{SIZE}};',
		);

		foreach ( $expected as $id => $selector ) {
			$this->assertArrayHasKey( $id, $controls );
			$selectors = $this->array_value( $controls[ $id ]['selectors'] ?? null );
			$this->assertSame( $selector, $selectors['{{WRAPPER}}'], $id );
		}
	}

	// NB: size_units/range/label are NOT asserted here — frontend-context
	// registration strips presentation-only args from the PHP stack (they
	// reach the editor via its own config payload). Verified live in
	// elementor.widgetsCache instead: custom present on all length sliders.

	public function test_layout_control_is_responsive_with_vertical_var_bundle(): void {
		$controls = $this->controls();

		$this->assertArrayHasKey( 'layout', $controls );
		// Modern Elementor stores responsive controls once, flagged — device
		// variants materialize editor-side per the site's real breakpoints.
		$this->assertTrue( $controls['layout']['is_responsive'] ?? false );

		$dictionary = $this->array_value( $controls['layout']['selectors_dictionary'] ?? null );
		$vertical   = $this->string_value( $dictionary['vertical'] ?? null );
		// Every layout-state var the stylesheet consumes must flip, including
		// the WAAPI kill-switch (--arts-hs-move) and the track height.
		foreach (
			array(
				'--arts-hs-animation: none',
				'--arts-hs-move: 0',
				'--arts-hs-track-position: static',
				'--arts-hs-track-direction: column',
				'--arts-hs-track-width: auto',
				'--arts-hs-track-height: auto',
				'--arts-hs-pin-height: auto',
			) as $needle
		) {
			$this->assertStringContainsString( $needle, $vertical );
		}
	}

	public function test_layout_horizontal_defers_to_the_gate_granted_twins(): void {
		$controls = $this->controls();

		$dictionary = $this->array_value( $controls['layout']['selectors_dictionary'] ?? null );
		$horizontal = $this->string_value( $dictionary['horizontal'] ?? null );

		// Horizontal must never write real values (kit CSS outranks the
		// stylesheet's @supports gate — it would force the track in browsers
		// that can't scrub it). It chains every state var through its `h-`
		// twin, which only the capability gates flip to horizontal.
		foreach (
			array(
				'--arts-hs-animation: var(--arts-hs-h-animation)',
				'--arts-hs-move: var(--arts-hs-h-move)',
				'--arts-hs-track-position: var(--arts-hs-h-track-position)',
				'--arts-hs-track-direction: var(--arts-hs-h-track-direction)',
				'--arts-hs-track-width: var(--arts-hs-h-track-width)',
				'--arts-hs-track-height: var(--arts-hs-h-track-height)',
				'--arts-hs-pin-height: var(--arts-hs-h-pin-height)',
			) as $needle
		) {
			$this->assertStringContainsString( $needle, $horizontal );
		}
	}

	public function test_scroll_direction_rtl_flips_scrub_and_track_alignment(): void {
		$controls = $this->controls();

		$this->assertArrayHasKey( 'scroll_direction', $controls );
		$dictionary = $this->array_value( $controls['scroll_direction']['selectors_dictionary'] ?? null );
		$rtl        = $this->string_value( $dictionary['rtl'] ?? null );

		$this->assertStringContainsString( '--arts-hs-dir: -1', $rtl );
		$this->assertStringContainsString( '--arts-hs-track-shift: calc(100cqw - 100%)', $rtl );
	}

	public function test_scroll_controls_carry_no_layout_condition(): void {
		$controls = $this->controls();

		// A `layout` condition would read the desktop value only — hiding
		// Height/Direction/Length/Offset exactly when a narrower breakpoint
		// switches to horizontal and needs them. Responsive vertical→horizontal
		// became expressible once `horizontal` started chaining through the
		// gate twins, so these must stay visible in every layout mix.
		foreach ( array( 'viewport_height', 'scroll_direction', 'scroll_factor', 'pin_offset' ) as $id ) {
			$this->assertArrayHasKey( $id, $controls );
			$condition = $controls[ $id ]['condition'] ?? array();
			$this->assertIsArray( $condition );
			$this->assertArrayNotHasKey( 'layout', $condition, $id );
		}
	}

	public function test_panel_title_is_not_an_editable_field(): void {
		$controls = $this->controls();

		$fields = $this->array_value( $controls['panels']['fields'] ?? null );
		$title  = $this->array_value( $fields['panel_title'] ?? null );

		// It renders nothing — as a TEXT control it read as a content field and
		// picked up Elementor's AI generator, promising copy that never ships.
		$this->assertSame( Controls_Manager::HIDDEN, $title['type'] ?? null );
	}

	public function test_panels_repeater_forbids_row_sorting(): void {
		$controls = $this->controls();

		$actions = $this->array_value( $controls['panels']['item_actions'] ?? null );

		// Row drag-sort and duplicate corrupt nested children in current
		// Elementor (core bugs). ALL four keys must be present: the controls
		// manager merges shallowly and a partial array silently disables
		// the rest.
		$this->assertFalse( $actions['sort'] );
		$this->assertFalse( $actions['duplicate'] );
		$this->assertTrue( $actions['add'] );
		$this->assertTrue( $actions['remove'] );
	}

	public function test_touch_vertical_defaults_on_and_toggles_wrapper_class(): void {
		$controls = $this->controls();

		$this->assertArrayHasKey( 'touch_vertical', $controls );
		$this->assertSame( 'yes', $controls['touch_vertical']['default'] );

		$render = function ( array $settings ): string {
			$widget = \Elementor\Plugin::$instance->elements_manager->create_element_instance(
				array(
					'id'         => 'ahs' . md5( (string) wp_json_encode( $settings ) ),
					'elType'     => 'widget',
					'widgetType' => 'arts-horizontal-scroll',
					'settings'   => $settings,
					'elements'   => array(),
				)
			);
			$this->assertInstanceOf( HorizontalScroll::class, $widget );

			ob_start();
			$widget->print_element();

			return (string) ob_get_clean();
		};

		$on  = $render( array( 'panels' => array( array( '_id' => 'p1', 'panel_title' => 'P' ) ) ) );
		$off = $render(
			array(
				'panels'         => array( array( '_id' => 'p1', 'panel_title' => 'P' ) ),
				'touch_vertical' => '',
			)
		);

		$this->assertStringContainsString( 'arts-hs_touch-vertical', $on );
		$this->assertStringNotContainsString( 'arts-hs_touch-vertical', $off );
	}
}
