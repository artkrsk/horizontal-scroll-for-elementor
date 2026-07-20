<?php

namespace Arts\HorizontalScroll\Widgets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Managers\Assets;
use Elementor\Controls_Manager;
use Elementor\Modules\NestedElements\Base\Widget_Nested_Base;
use Elementor\Modules\NestedElements\Controls\Control_Nested_Repeater;
use Elementor\Repeater;

class HorizontalScroll extends Widget_Nested_Base {

	public function get_name(): string {
		return 'arts-horizontal-scroll';
	}

	public function get_title(): string {
		return esc_html__( 'Horizontal Scroll', 'horizontal-scroll-for-elementor' );
	}

	public function get_icon(): string {
		return 'eicon-navigation-horizontal';
	}

	/** @return array<int, string> */
	public function get_categories(): array {
		return array( 'general' );
	}

	/** @return array<int, string> */
	public function get_keywords(): array {
		return array( 'horizontal', 'scroll', 'panels', 'sections', 'pin' );
	}

	/** @return array<int, string> */
	public function get_style_depends(): array {
		return array( Assets::HANDLE );
	}

	/** @return array<int, string> */
	public function get_script_depends(): array {
		return array( Assets::HANDLE );
	}

	public function show_in_panel(): bool {
		return \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements', true );
	}

	/**
	 * Never wrap the output in .elementor-widget-container: the widget root is the
	 * pin (scroll runway) and the track is position: sticky — an intermediate
	 * wrapper would become the sticky containing block and break the pin.
	 */
	public function has_widget_inner_wrapper(): bool {
		return false;
	}

	/** @return array<string, mixed> */
	protected function panel_container( int $index ): array {
		return array(
			'elType'   => 'container',
			// Locked children can't be dragged in the Navigator (its sortable
			// cancels on data-locked rows) — core's own repeater-insert hook
			// stamps the same flag on nested children it creates.
			'isLocked' => true,
			'settings' => array(
				'_title'        => sprintf(
					/* translators: %d: Panel index. */
					__( 'Panel #%d', 'horizontal-scroll-for-elementor' ),
					$index
				),
				'content_width' => 'full',
				// Default new panels to one full screen. Elementor's own default is
				// `--width: 100%`, which resolves circularly against the max-content flex
				// track: the panel blows out AND the scrub geometry breaks (the track's
				// scroll width and layout width diverge). A definite width sidesteps both.
				// Authors override per panel via the Width control.
				'width'         => array(
					'unit' => 'vw',
					'size' => 100,
				),
			),
		);
	}

	/** @return array<int, array<string, mixed>> */
	protected function get_default_children_elements(): array {
		return array(
			$this->panel_container( 1 ),
			$this->panel_container( 2 ),
			$this->panel_container( 3 ),
		);
	}

	protected function get_default_repeater_title_setting_key(): string {
		return 'panel_title';
	}

	protected function get_default_children_title(): string {
		/* translators: %d: Panel index. */
		return esc_html__( 'Panel #%d', 'horizontal-scroll-for-elementor' );
	}

	protected function get_default_children_placeholder_selector(): string {
		return '.js-arts-hs__track';
	}

	/**
	 * Editor correctness for repeater mutations: core's repeater-move hook
	 * re-sorts the Marionette child-view registry (sortViewsByModels) only
	 * under this flag — without it the registry drifts after a drag reorder
	 * and the next repeater operation resolves the wrong child or drops one.
	 * Nested Tabs and Nested Accordion both set it.
	 *
	 * @return array<string, mixed>
	 */
	protected function get_initial_config(): array {
		/** @var array<string, mixed> $config Untyped in elementor-stubs. */
		$config = parent::get_initial_config();

		$config['support_improved_repeaters'] = true;

		return $config;
	}

	protected function register_controls(): void {
		$this->start_controls_section(
			'section_panels',
			array( 'label' => esc_html__( 'Panels', 'horizontal-scroll-for-elementor' ) )
		);

		$repeater = new Repeater();

		// Row label only — it renders nothing on the page. HIDDEN because as a
		// TEXT control it read as a content field (Elementor stamps its AI
		// generator onto those), inviting copy that would never appear. Core
		// seeds this and the child container's `_title` from the same
		// extractNestedItemTitle() at creation and never links them again, so
		// an editable field here would just drift from the Navigator. The
		// Navigator stays the one place to rename a panel.
		$repeater->add_control(
			'panel_title',
			array( 'type' => Controls_Manager::HIDDEN )
		);

		$this->add_control(
			'panels',
			array(
				'type'         => Control_Nested_Repeater::CONTROL_TYPE,
				'fields'       => $repeater->get_controls(),
				'title_field'  => '{{{ panel_title }}}',
				'button_text'  => esc_html__( 'Add Panel', 'horizontal-scroll-for-elementor' ),
				// Row drag-sort AND row duplicate corrupt nested children in
				// current Elementor (core bugs — its own Nested Tabs drops a
				// child on the same move command; duplicate clones the row but
				// not the child container; correlation is index-only, so the
				// desync then deletes wrong children). Add/remove are verified
				// healthy and stay enabled. All four keys spelled out: the
				// controls manager merges args shallowly, a partial array
				// would silently disable the rest. The editor bundle
				// additionally vetoes the two commands for this widget.
				'item_actions' => array(
					'add'       => true,
					'duplicate' => false,
					'remove'    => true,
					'sort'      => false,
				),
				// Must stay in sync with get_default_children_elements().
				'default'      => array(
					array( 'panel_title' => esc_html__( 'Panel #1', 'horizontal-scroll-for-elementor' ) ),
					array( 'panel_title' => esc_html__( 'Panel #2', 'horizontal-scroll-for-elementor' ) ),
					array( 'panel_title' => esc_html__( 'Panel #3', 'horizontal-scroll-for-elementor' ) ),
				),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'section_layout',
			array( 'label' => esc_html__( 'Layout', 'horizontal-scroll-for-elementor' ) )
		);

		$this->add_responsive_control(
			'layout',
			array(
				'label'                => esc_html__( 'Layout', 'horizontal-scroll-for-elementor' ),
				'type'                 => Controls_Manager::SELECT,
				'options'              => array(
					'horizontal' => esc_html__( 'Horizontal', 'horizontal-scroll-for-elementor' ),
					'vertical'   => esc_html__( 'Vertical', 'horizontal-scroll-for-elementor' ),
				),
				'default'              => 'horizontal',
				// `horizontal` must never write real values: kit CSS outranks the
				// stylesheet's @supports gate, so plain resets would force a
				// horizontal track in browsers that can't scrub it (JS off
				// included). It chains through the gate-granted `h-` twins
				// instead — the stylesheet flips those to guaranteed-invalid
				// inside its capability gates (every consumption then falls back
				// to its horizontal value) and keeps them at the vertical values
				// otherwise, touch included. That lets a narrower breakpoint
				// return to horizontal under a wider vertical, while Stack on
				// Touch still beats an explicit horizontal.
				'selectors_dictionary' => array(
					'horizontal' => '--arts-hs-animation: var(--arts-hs-h-animation); --arts-hs-move: var(--arts-hs-h-move); --arts-hs-track-position: var(--arts-hs-h-track-position); --arts-hs-track-direction: var(--arts-hs-h-track-direction); --arts-hs-track-width: var(--arts-hs-h-track-width); --arts-hs-track-height: var(--arts-hs-h-track-height); --arts-hs-pin-height: var(--arts-hs-h-pin-height);',
					'vertical'   => '--arts-hs-animation: none; --arts-hs-move: 0; --arts-hs-track-position: static; --arts-hs-track-direction: column; --arts-hs-track-width: auto; --arts-hs-track-height: auto; --arts-hs-pin-height: auto;',
				),
				'selectors'            => array( '{{WRAPPER}}' => '{{VALUE}}' ),
			)
		);

		$this->add_control(
			'touch_vertical',
			array(
				'label'        => esc_html__( 'Stack on Touch Devices', 'horizontal-scroll-for-elementor' ),
				'description'  => esc_html__( 'Touch devices scroll vertically by finger, which makes a horizontal section disorienting. Overrides Layout on touch, whatever the screen width.', 'horizontal-scroll-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => 'yes',
				'return_value' => 'yes',
			)
		);

		$this->add_responsive_control(
			'panels_gap',
			array(
				'label'      => esc_html__( 'Gap Between Panels', 'horizontal-scroll-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'custom' ),
				'range'      => array(
					'px'  => array(
						'min' => 0,
						'max' => 400,
					),
					'%'   => array(
						'min' => 0,
						'max' => 25,
					),
					'em'  => array(
						'min' => 0,
						'max' => 25,
					),
					'rem' => array(
						'min' => 0,
						'max' => 25,
					),
					'vw'  => array(
						'min' => 0,
						'max' => 25,
					),
				),
				'selectors'  => array( '{{WRAPPER}}' => '--arts-hs-gap: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'section_scroll',
			array(
				// No `layout` condition: it would read the desktop value only,
				// hiding these exactly when a narrower breakpoint switches to
				// horizontal and needs them. In fully-vertical setups they're
				// simply inert.
				'label' => esc_html__( 'Scroll', 'horizontal-scroll-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'viewport_height',
			array(
				'label'       => esc_html__( 'Height', 'horizontal-scroll-for-elementor' ),
				// Names the real relationship: this is NOT the section's height.
				'description' => esc_html__( 'The pinned viewport that panels fill. The section itself takes longer to scroll past — see Scroll Length.', 'horizontal-scroll-for-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => array( 'vh', 'svh', 'dvh', 'px', 'em', 'rem', 'custom' ),
				'range'       => array(
					'vh'  => array(
						'min' => 30,
						'max' => 100,
					),
					'svh' => array(
						'min' => 30,
						'max' => 100,
					),
					'dvh' => array(
						'min' => 30,
						'max' => 100,
					),
					'px'  => array(
						'min' => 200,
						'max' => 1600,
					),
					'em'  => array(
						'min' => 10,
						'max' => 100,
					),
					'rem' => array(
						'min' => 10,
						'max' => 100,
					),
				),
				'default'     => array(
					'size' => 100,
					'unit' => 'vh',
				),
				'selectors'   => array( '{{WRAPPER}}' => '--arts-hs-height: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_control(
			'scroll_direction',
			array(
				'label'                => esc_html__( 'Direction', 'horizontal-scroll-for-elementor' ),
				'type'                 => Controls_Manager::SELECT,
				'options'              => array(
					'ltr' => esc_html__( 'Left to Right', 'horizontal-scroll-for-elementor' ),
					'rtl' => esc_html__( 'Right to Left', 'horizontal-scroll-for-elementor' ),
				),
				'default'              => 'ltr',
				'selectors_dictionary' => array(
					// Empty `ltr` is safe here (unlike `layout`): this control
					// isn't responsive, and both vars carry base defaults.
					'ltr' => '',
					// Flip the scrub AND start the track right-aligned so the
					// reveal runs right-to-left; panels keep natural direction.
					'rtl' => '--arts-hs-dir: -1; --arts-hs-track-shift: calc(100cqw - 100%);',
				),
				'selectors'            => array( '{{WRAPPER}}' => '{{VALUE}}' ),
			)
		);

		$this->add_responsive_control(
			'scroll_factor',
			array(
				'label'       => esc_html__( 'Scroll Length', 'horizontal-scroll-for-elementor' ),
				'description' => esc_html__( 'How much page scroll the section consumes. Higher means a longer, slower scroll.', 'horizontal-scroll-for-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				// No `size_units`: the single-entry default keeps the unit
				// switcher hidden, which is how core renders a unitless
				// multiplier (Pro Motion FX "Speed").
				'range'       => array(
					'px' => array(
						'min'  => 0.5,
						'max'  => 3,
						'step' => 0.1,
					),
				),
				'default'     => array( 'size' => 1 ),
				'selectors'   => array( '{{WRAPPER}}' => '--arts-hs-factor: {{SIZE}};' ),
			)
		);

		$this->add_responsive_control(
			'pin_offset',
			array(
				'label'       => esc_html__( 'Pin Top Offset', 'horizontal-scroll-for-elementor' ),
				'description' => esc_html__( 'Room for sticky headers: the section pins this far from the top.', 'horizontal-scroll-for-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => array( 'px', 'em', 'rem', 'vh', 'svh', 'custom' ),
				'range'       => array(
					'px'  => array(
						'min' => 0,
						'max' => 300,
					),
					'em'  => array(
						'min' => 0,
						'max' => 20,
					),
					'rem' => array(
						'min' => 0,
						'max' => 20,
					),
					'vh'  => array(
						'min' => 0,
						'max' => 30,
					),
					'svh' => array(
						'min' => 0,
						'max' => 30,
					),
				),
				'selectors'   => array( '{{WRAPPER}}' => '--arts-hs-offset: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}
		$panels = is_array( $settings['panels'] ?? null ) ? $settings['panels'] : array();
		$count  = max( 1, count( $panels ) );

		// `arts-hs` is styling-only; `js-arts-hs` is the DOM hook scripts select by.
		$this->add_render_attribute( '_wrapper', 'class', 'arts-hs js-arts-hs' );
		if ( 'yes' === ( $settings['touch_vertical'] ?? 'yes' ) ) {
			$this->add_render_attribute( '_wrapper', 'class', 'arts-hs_touch-vertical' );
		}
		// Server-side scroll-budget estimate so the pin works before (or without)
		// JS measurement; the frontend script refines it to exact pixels.
		$this->add_render_attribute(
			'_wrapper',
			'style',
			sprintf( '--arts-hs-distance: calc(%d * 80cqw);', $count - 1 )
		);
		?>
		<div class="arts-hs__track js-arts-hs__track">
			<?php
			foreach ( array_keys( $panels ) as $index ) {
				$this->print_child( $index );
			}
			?>
		</div>
		<?php
	}

	/**
	 * Editor markup. Child containers are mounted INTO the placeholder selector
	 * by the nested-elements editor machinery — the template stays empty.
	 */
	protected function content_template(): void {
		?>
		<div class="arts-hs__track js-arts-hs__track"></div>
		<?php
	}
}
