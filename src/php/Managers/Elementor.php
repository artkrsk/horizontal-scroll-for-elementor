<?php

namespace Arts\HorizontalScroll\Managers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Base\Manager as BaseManager;
use Arts\HorizontalScroll\Widgets\HorizontalScroll;
use Elementor\Controls_Manager;
use Elementor\Controls_Stack;

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
		// through Elementor 4.2, on Container in 4.3), dependency check
		// off for the same reason: Container being off already forces this
		// feature inactive on every load. Through 4.2 the experiment is stable,
		// default-on and switchable by sites (4.3 makes it non-mutable
		// and hidden, so only Container can take it away) — and versions
		// predating it would fatal on the widget's parent class. Degrade to
		// no-widget.
		if ( ! \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}
		$widgets_manager->register( new HorizontalScroll() );
	}

	/**
	 * Panels are core Containers, so "as wide as its content" belongs on the
	 * Container's own Layout tab, next to Width. Registered on EVERY Container
	 * (stacks are keyed by element type) and shown on panels only, through the
	 * hidden marker HorizontalScroll::PANEL_FLAG that our panels alone carry.
	 * Gated on the nested-elements experiment like register_widgets(), and for
	 * the same reason: versions predating it have no Widget_Nested_Base, and
	 * merely reading HorizontalScroll::PANEL_FLAG autoloads the widget onto
	 * that missing parent — on every Container stack build. The guard runs
	 * before the first reference, so the degrade stays "no widget", never a
	 * fatal. (No widget means no panels, so nothing is lost by bailing.)
	 *
	 * The switch writes `width`, not `--width`: a second writer of core's
	 * custom property would tie it at equal specificity and media query, where
	 * print order decides. On the Container's own three-class selector `width`
	 * beats core's single-class `.e-con { width: var(--width) }` and our
	 * two-class track rule outright, and folding in the layout-state var keeps
	 * the panel at 100% in every stacked state (index.scss).
	 *
	 * Hooked at `elementor/element/container/section_layout_container/before_section_end`.
	 */
	public function register_panel_controls( Controls_Stack $element ): void {
		if ( ! \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}

		$element->add_control(
			HorizontalScroll::PANEL_FLAG,
			array( 'type' => Controls_Manager::HIDDEN )
		);

		$element->add_control(
			HorizontalScroll::FIT_CONTENT,
			array(
				'label'        => esc_html__( 'Fit Content', 'horizontal-scroll-for-elementor' ),
				// Says where it acts: stacked layouts fill the section by design,
				// so toggling it while previewing a stacked device changes nothing
				// and must not read as a dead switch.
				'description'  => esc_html__( 'Makes the panel as wide as its content while the section scrolls horizontally; stacked layouts always fill the section. Replaces Width while on.', 'horizontal-scroll-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'default'      => '',
				// Boxed is excluded for the same reason core hides Width there:
				// a `max-content` outer resolves circularly against its
				// 100%-wide inner wrapper.
				'condition'    => array(
					HorizontalScroll::PANEL_FLAG => 'yes',
					'content_width'              => 'full',
				),
				'selectors'    => array(
					'{{WRAPPER}}' => 'width: var(--arts-hs-panel-width, max-content);',
				),
			),
			array(
				'position' => array(
					'of'   => 'width',
					'type' => 'control',
					'at'   => 'after',
				),
			)
		);

		// Hide Width while Fit Content is on. update_control() is a shallow
		// array_merge that swaps the whole `condition` array, so core's own
		// rule (`content_width => full` today) is read back at runtime and our
		// term merged into it — never a frozen copy that a later Elementor
		// would silently lose. The singular `condition` map is used rather
		// than the `conditions` DSL because is_control_visible() guards a
		// missing key for the former while Conditions::check() does not.
		// Never update_responsive_control(): it rebuilds the `responsive` args
		// without the stored `min` device, and that `min` is the 768px floor
		// that keeps a desktop Width out of mobile. Breakpoint variants
		// (`width_tablet`, …) exist as their own controls only while
		// Elementor's responsive duplication mode is `on` — CSS generation —
		// so probe for each before touching it; the editor builds the stack
		// with the mode `off` and clones the single control's condition per
		// device itself.
		$ids = array( 'width' );
		/** @var mixed $breakpoints Typed Breakpoint[]|Breakpoint in the stubs. */
		$breakpoints = \Elementor\Plugin::$instance->breakpoints->get_active_breakpoints();
		if ( is_array( $breakpoints ) ) {
			foreach ( array_keys( $breakpoints ) as $device ) {
				$ids[] = 'width_' . $device;
			}
		}
		foreach ( $ids as $id ) {
			$control = $element->get_controls( $id );
			if ( ! is_array( $control ) ) {
				continue;
			}
			$core_condition = isset( $control['condition'] ) && is_array( $control['condition'] )
				? $control['condition']
				: array();
			$element->update_control(
				$id,
				array(
					'condition' => array_merge(
						$core_condition,
						array( HorizontalScroll::FIT_CONTENT . '!' => 'yes' )
					),
				)
			);
		}
	}
}
