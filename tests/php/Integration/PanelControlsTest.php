<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;
use Elementor\Controls_Manager;
use Elementor\Core\Frontend\Performance;

/**
 * The Fit Content switch lives on core's Container, not on the widget: a
 * hidden marker seeded only on panels gates it there, and core's own Width
 * control hides while it is on. Control stacks are keyed by element type, so
 * these assertions read the CONTAINER stack — rebuilt fresh per read, because
 * a stack built under responsive duplication mode `on` is never evicted by a
 * return to `off` and would leak into every later test.
 */
class PanelControlsTest extends TestCase {

	public function set_up(): void {
		parent::set_up();
		// Container's register_controls() reads the ACTIVE kit (see AssetsTest):
		// without one the stack build dies mid-section and poisons every later
		// rebuild with "can't start a section before the end of the previous".
		\Elementor\Core\Kits\Manager::create_default_kit();
	}

	public function tear_down(): void {
		$plugin = \Elementor\Plugin::$instance;
		$plugin->breakpoints->set_responsive_control_duplication_mode( 'off' );
		$container = $plugin->elements_manager->get_element_types( 'container' );
		if ( $container instanceof \Elementor\Element_Base ) {
			$plugin->controls_manager->delete_stack( $container );
		}
		parent::tear_down();
	}

	/**
	 * Container controls as the CSS generator and the editor see them, from a
	 * FRESH stack built under $mode.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private function fresh_container_controls( string $mode = 'off' ): array {
		$plugin = \Elementor\Plugin::$instance;
		// A Container built NOW, not the registered singleton: Container's
		// constructor captures the active kit, and the singleton was built at
		// bootstrap when this environment had none — its kit is Elementor's
		// empty stand-in, whose own controls can't register (null main post),
		// so the singleton's stack build dies mid-section. The stack is keyed
		// by element name, so this instance builds the one shared stack.
		$container = $plugin->elements_manager->create_element_instance(
			array(
				'id'       => 'ahscontainer',
				'elType'   => 'container',
				'settings' => array(),
				'elements' => array(),
			)
		);
		$this->assertInstanceOf( \Elementor\Element_Base::class, $container );

		$initial = $this->string_value( $plugin->breakpoints->get_responsive_control_duplication_mode() );
		$plugin->breakpoints->set_responsive_control_duplication_mode( $mode );
		$plugin->controls_manager->delete_stack( $container );

		// Under the flag so `width`, its variants and the switch (all
		// selector-bearing) are part of the merged read — TestCase::controls()
		// does the same for the widget.
		Performance::set_use_style_controls( true );
		$controls = $container->get_controls();
		Performance::set_use_style_controls( false );

		$plugin->breakpoints->set_responsive_control_duplication_mode( $initial );
		// A stack built under `on` is never evicted by a return to `off`.
		$plugin->controls_manager->delete_stack( $container );

		/** @var array<string, array<string, mixed>> $controls */
		$controls = $this->array_value( $controls );

		return $controls;
	}

	public function test_initial_panels_carry_the_marker(): void {
		$config   = $this->array_value( $this->widget()->get_config() );
		$defaults = $this->array_value( $config['defaults'] ?? null );
		$elements = $this->array_value( $defaults['elements'] ?? null );

		$this->assertCount( 3, $elements );
		foreach ( $elements as $child ) {
			$child    = $this->array_value( $child );
			$settings = $this->array_value( $child['settings'] ?? null );
			$this->assertSame( 'yes', $settings[ HorizontalScroll::PANEL_FLAG ] ?? null );
		}
	}

	public function test_fit_content_switch_is_injected_for_panels_only(): void {
		$controls = $this->fresh_container_controls();

		$marker = $this->array_value( $controls[ HorizontalScroll::PANEL_FLAG ] ?? null );
		$this->assertSame( Controls_Manager::HIDDEN, $marker['type'] ?? null );

		$switch = $this->array_value( $controls[ HorizontalScroll::FIT_CONTENT ] ?? null );
		$this->assertSame( Controls_Manager::SWITCHER, $switch['type'] ?? null );
		$this->assertSame( 'yes', $switch['return_value'] ?? null );
		$this->assertSame(
			array(
				HorizontalScroll::PANEL_FLAG => 'yes',
				'content_width'              => 'full',
			),
			$switch['condition'] ?? null
		);
		$this->assertSame(
			array( '{{WRAPPER}}' => 'width: var(--arts-hs-panel-width, max-content);' ),
			$switch['selectors'] ?? null
		);
		// Position (right after Width) is NOT asserted here: in frontend
		// context core files selector-bearing controls into a separate
		// style_controls stack and computes the injection index against the
		// merged list, so PHP order is not the editor's. Verified in the editor.
	}

	public function test_width_hides_while_fit_content_is_on(): void {
		$controls = $this->fresh_container_controls();

		// Core's own rule is read back at runtime and ours merged in — neither
		// erased nor frozen to one Elementor version.
		$this->assertSame(
			array(
				'content_width'                     => 'full',
				HorizontalScroll::FIT_CONTENT . '!' => 'yes',
			),
			$controls['width']['condition'] ?? null
		);
		// Mode off: one control, flagged responsive, which the editor clones
		// per device — condition included.
		$this->assertTrue( $controls['width']['is_responsive'] ?? false );
	}

	public function test_width_breakpoint_variants_hide_too_and_keep_the_mobile_floor(): void {
		$controls    = $this->fresh_container_controls( 'on' );
		$breakpoints = \Elementor\Plugin::$instance->breakpoints->get_active_breakpoints();

		$this->assertIsArray( $breakpoints );
		$this->assertNotEmpty( $breakpoints );
		foreach ( array_keys( $breakpoints ) as $device ) {
			$this->assertArrayHasKey( "width_{$device}", $controls, (string) $device );
			$this->assertSame(
				array(
					'content_width'                     => 'full',
					HorizontalScroll::FIT_CONTENT . '!' => 'yes',
				),
				$controls[ "width_{$device}" ]['condition'] ?? null,
				(string) $device
			);
		}
		// The desktop value must still print only from 768px up (core's
		// min_affected_device) — update_responsive_control() would have
		// dropped this and leaked the desktop Width into mobile.
		$responsive = $this->array_value( $controls['width']['responsive'] ?? null );
		$this->assertSame( 'tablet', $responsive['min'] ?? null );
	}
}
