<?php
/**
 * Seeds the "Arts Horizontal Scroll — Demo" feature-tour page.
 *
 * Run against the Local dev site:
 *   wp eval-file dev/seed/demo-page.php --user=1
 *
 * Also inlined into .wordpress-org/blueprints/blueprint.json's runPHP step by
 * dev/blueprint/build-blueprint.js (no wp-cli context there — the WP_CLI::
 * calls below are guarded for that reason). Idempotent: finds the page by
 * slug and rewrites it wholesale. All styling is hard-coded (no kit globals,
 * no fluid presets) because the blueprint boots bare hello-elementor + free
 * Elementor. The two Motion FX garnishes are Elementor Pro settings that stay
 * inert without Pro.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pinned so the blueprint's landingPage can address the page without guessing.
 * dev/blueprint/build-blueprint.js reads this constant — keep the literal on
 * one line.
 */
define( 'AHS_DEMO_PAGE_ID', 9911 );

// Elementor otherwise hijacks the first admin request with its onboarding
// wizard, which would land the Playground visitor somewhere other than the
// editor. Harmless on an already-onboarded dev site.
update_option( 'elementor_onboarded', true );
delete_transient( 'elementor_activation_redirect' );

const AHS_HAIRLINE       = 'rgba(255,255,255,0.08)';
const AHS_TEXT           = '#F4F4F2';
const AHS_MUTED          = '#8A8A8E';
const AHS_BODY_MUTED     = '#9A9AA0';
const AHS_PADDING        = array(
	'unit'     => 'px',
	'top'      => '40',
	'right'    => '44',
	'bottom'   => '40',
	'left'     => '44',
	'isLinked' => false,
);
const AHS_PADDING_MOBILE = array(
	'unit'     => 'px',
	'top'      => '24',
	'right'    => '20',
	'bottom'   => '24',
	'left'     => '20',
	'isLinked' => false,
);
// Readability caps (act as max-width: narrow panels still win).
const AHS_TITLE_CAP    = array(
	'_element_width'        => 'initial',
	'_element_custom_width' => array(
		'unit' => 'custom',
		'size' => 'min(900px, 100%)',
	),
);
const AHS_SUBTITLE_CAP = array(
	'_element_width'        => 'initial',
	'_element_custom_width' => array(
		'unit' => 'custom',
		'size' => 'min(700px, 100%)',
	),
);

function ahs_seed_id(): string {
	return substr( bin2hex( random_bytes( 4 ) ), 0, 7 );
}

/** fadeIn entrance with a stagger slot (1-6 → 80..580ms). */
function ahs_anim( int $slot ): array {
	return array(
		'_animation'       => 'fadeIn',
		'_animation_delay' => 80 + ( $slot - 1 ) * 100,
	);
}

function ahs_zero_gap(): array {
	return array(
		'unit'     => 'px',
		'column'   => '0',
		'row'      => '0',
		'isLinked' => true,
	);
}

function ahs_gap( int $px ): array {
	return array(
		'unit'     => 'px',
		'column'   => (string) $px,
		'row'      => (string) $px,
		'isLinked' => true,
	);
}

/** Small uppercase meta label. */
function ahs_mono_label( string $title, array $extra = array() ): array {
	return array(
		'id'         => ahs_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array_merge(
			array(
				'title'                     => $title,
				'header_size'               => 'p',
				'title_color'               => AHS_MUTED,
				'typography_typography'     => 'custom',
				'typography_font_family'    => 'Space Grotesk',
				'typography_font_size'      => array(
					'unit'  => 'px',
					'size'  => 11,
					'sizes' => array(),
				),
				'typography_letter_spacing' => array(
					'unit'  => 'em',
					'size'  => 0.12,
					'sizes' => array(),
				),
				'typography_text_transform' => 'uppercase',
			),
			$extra
		),
		'elements'   => array(),
	);
}

/** Oversized display heading (Space Grotesk 500). */
function ahs_display_heading( string $title, string $tag, string $font_size, array $extra = array() ): array {
	return array(
		'id'         => ahs_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array_merge(
			array(
				'title'                     => $title,
				'header_size'               => $tag,
				'title_color'               => AHS_TEXT,
				'typography_typography'     => 'custom',
				'typography_font_family'    => 'Space Grotesk',
				'typography_font_weight'    => '500',
				'typography_font_size'      => array(
					'unit' => 'custom',
					'size' => $font_size,
				),
				'typography_line_height'    => array(
					'unit' => 'custom',
					'size' => '0.92',
				),
				'typography_letter_spacing' => array(
					'unit'  => 'em',
					'size'  => -0.02,
					'sizes' => array(),
				),
			),
			$extra
		),
		'elements'   => array(),
	);
}

/** Muted body paragraph (Space Grotesk regular). */
function ahs_body_text( string $title, array $extra = array() ): array {
	return array(
		'id'         => ahs_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array_merge(
			array(
				'title'                  => $title,
				'header_size'            => 'p',
				'title_color'            => AHS_BODY_MUTED,
				'typography_typography'  => 'custom',
				'typography_font_family' => 'Space Grotesk',
				'typography_font_size'   => array(
					'unit'  => 'px',
					'size'  => 16,
					'sizes' => array(),
				),
				'typography_line_height' => array(
					'unit' => 'custom',
					'size' => '1.5',
				),
			),
			$extra
		),
		'elements'   => array(),
	);
}

/** Pill button (transparent, hairline border, fully rounded). */
function ahs_pill_button( string $text, string $url, array $extra = array() ): array {
	return array(
		'id'         => ahs_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'button',
		'settings'   => array_merge(
			array(
				'text'                     => $text,
				'link'                     => array(
					'url'         => $url,
					'is_external' => '',
					'nofollow'    => '',
				),
				'button_text_color'        => AHS_TEXT,
				// Group_Control_Background defaults to the kit's global accent
				// color when unset — explicit here so the pill stays transparent
				// regardless of which kit/theme the demo boots against.
				'background_background'    => 'classic',
				'background_color'         => 'transparent',
				'border_border'            => 'solid',
				'border_width'             => array(
					'unit'     => 'px',
					'top'      => '1',
					'right'    => '1',
					'bottom'   => '1',
					'left'     => '1',
					'isLinked' => true,
				),
				'border_color'             => 'rgba(255,255,255,0.2)',
				'border_radius'            => array(
					'unit'     => 'px',
					'top'      => '999',
					'right'    => '999',
					'bottom'   => '999',
					'left'     => '999',
					'isLinked' => true,
				),
				'text_padding'             => array(
					'unit'     => 'px',
					'top'      => '12',
					'right'    => '22',
					'bottom'   => '12',
					'left'     => '22',
					'isLinked' => false,
				),
				'typography_typography'    => 'custom',
				'typography_font_family'   => 'Space Grotesk',
				'typography_font_size'     => array(
					'unit'  => 'px',
					'size'  => 15,
					'sizes' => array(),
				),
				'typography_font_weight'   => '500',
				'hover_color'              => AHS_TEXT,
				'button_background_hover_background' => 'classic',
				'button_background_hover_color'      => 'transparent',
				'button_hover_border_color' => AHS_TEXT,
			),
			$extra
		),
		'elements'   => array(),
	);
}

/**
 * Inner structural container. Explicit zero padding + gap: the kit's default
 * container padding and --widgets-spacing (20px) would leak in otherwise.
 */
function ahs_row( array $settings, array $children ): array {
	return array(
		'id'       => ahs_seed_id(),
		'elType'   => 'container',
		'settings' => array_merge(
			array(
				'content_width' => 'full',
				'padding'       => array(
					'unit'     => 'px',
					'top'      => '0',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => true,
				),
				'flex_gap'      => ahs_zero_gap(),
			),
			$settings
		),
		'elements' => $children,
	);
}

/** Ghost numeral: huge, faint, right side, vertically centered. */
function ahs_ghost( string $index ): array {
	return ahs_display_heading(
		$index,
		'p',
		'42vh',
		array(
			'title_color'                  => 'rgba(255,255,255,0.035)',
			'typography_font_weight'       => '700',
			'typography_font_size_mobile'  => array(
				'unit' => 'custom',
				'size' => '22vh',
			),
			'typography_line_height'       => array(
				'unit' => 'custom',
				'size' => '1',
			),
			'_position'                    => 'absolute',
			'_offset_orientation_h'        => 'end',
			'_offset_x_end'                => array(
				'unit'  => 'px',
				'size'  => 24,
				'sizes' => array(),
			),
			'_offset_orientation_v'        => 'start',
			'_offset_y'                    => array(
				'unit'  => '%',
				'size'  => 50,
				'sizes' => array(),
			),
			'_transform_translate_popover' => 'transform',
			'_transform_translateY_effect' => array(
				'unit'  => '%',
				'size'  => -50,
				'sizes' => array(),
			),
		)
	);
}

/** Meta row: mono index left, mono label right. */
function ahs_meta_row( string $index, string $label ): array {
	return ahs_row(
		array(
			'flex_direction'       => 'row',
			'flex_justify_content' => 'space-between',
			'flex_align_items'     => 'center',
		),
		array(
			ahs_mono_label( $index, array( '_element_width' => 'auto' ) ),
			ahs_mono_label( $label, array( '_element_width' => 'auto' ) ),
		)
	);
}

/** Body group: display name + blurb, pinned to the panel bottom. */
function ahs_body_group( string $name, string $blurb ): array {
	return ahs_row(
		array(
			'flex_direction' => 'column',
			'flex_gap'       => ahs_gap( 16 ),
		),
		array(
			ahs_display_heading( $name, 'h2', 'clamp(44px, 5.4vw, 104px)', array_merge( ahs_anim( 1 ), AHS_TITLE_CAP ) ),
			ahs_body_text( $blurb, array_merge( ahs_anim( 2 ), AHS_SUBTITLE_CAP ) ),
		)
	);
}

/** Common panel container settings. */
function ahs_panel_settings( string $title, int $width_vw, string $bg, array $extra = array() ): array {
	return array_merge(
		array(
			'_title'                => $title,
			'content_width'         => 'full',
			'width'                 => array(
				'unit'  => 'vw',
				'size'  => $width_vw,
				'sizes' => array(),
			),
			// Core's 100% width default is mobile-only; without this,
			// tablet-width touch stacking leaves ragged right edges. vw, not %:
			// percentages resolve against the max-content track in the
			// horizontal state and blow the panels up.
			'width_tablet'          => array(
				'unit'  => 'vw',
				'size'  => 100,
				'sizes' => array(),
			),
			'flex_direction'        => 'column',
			'flex_justify_content'  => 'space-between',
			'flex_gap'              => ahs_zero_gap(),
			'min_height_mobile'     => array(
				'unit'  => 'vh',
				'size'  => 72,
				'sizes' => array(),
			),
			'padding'               => AHS_PADDING,
			'padding_mobile'        => AHS_PADDING_MOBILE,
			'background_background' => 'classic',
			'background_color'      => $bg,
			'border_border'         => 'solid',
			'border_width'          => array(
				'unit'     => 'px',
				'top'      => '0',
				'right'    => '1',
				'bottom'   => '0',
				'left'     => '0',
				'isLinked' => false,
			),
			'border_color'          => AHS_HAIRLINE,
		),
		$extra
	);
}

function ahs_panel( array $settings, array $children ): array {
	return array(
		'id'       => ahs_seed_id(),
		'elType'   => 'container',
		'isLocked' => true,
		'settings' => $settings,
		'elements' => $children,
	);
}

// --- Fixed header -------------------------------------------------------------

$header = array(
	'id'       => ahs_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'                => 'Header',
		'content_width'         => 'full',
		'position'              => 'fixed',
		'_offset_orientation_v' => 'start',
		// Clears the WP admin bar when present; 0 otherwise. The plugin's own
		// --arts-hs-admin-bar is scoped to the widget wrapper and can't reach
		// this sibling, so the header reads WP's raw var (cosmetic side
		// effects: 32px editor-preview offset; 600-767px logged-in overlap).
		'_offset_y'             => array(
			'unit' => 'custom',
			'size' => 'var(--wp-admin--admin-bar--height, 0px)',
		),
		// WP's bar unpins below 600px — don't reserve room for it on phones.
		'_offset_y_mobile'      => array(
			'unit'  => 'px',
			'size'  => 0,
			'sizes' => array(),
		),
		'_offset_orientation_h' => 'start',
		'_offset_x'             => array(
			'unit'  => 'px',
			'size'  => 0,
			'sizes' => array(),
		),
		'z_index'               => 100,
		'flex_direction'        => 'row',
		'flex_justify_content'  => 'space-between',
		'flex_align_items'      => 'center',
		'flex_gap'              => ahs_zero_gap(),
		'min_height'            => array(
			'unit'  => 'px',
			'size'  => 56,
			'sizes' => array(),
		),
		'min_height_mobile'     => array(
			'unit'  => 'px',
			'size'  => 48,
			'sizes' => array(),
		),
		'padding'               => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '44',
			'bottom'   => '0',
			'left'     => '44',
			'isLinked' => false,
		),
		'padding_mobile'        => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '20',
			'bottom'   => '0',
			'left'     => '20',
			'isLinked' => false,
		),
		'background_background' => 'classic',
		'background_color'      => '#0A0A0B',
		'border_border'         => 'solid',
		'border_width'          => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '0',
			'bottom'   => '1',
			'left'     => '0',
			'isLinked' => false,
		),
		'border_color'          => AHS_HAIRLINE,
	),
	'elements' => array(
		ahs_mono_label(
			'Arts Horizontal Scroll',
			array(
				'title_color'    => AHS_TEXT,
				'_element_width' => 'auto',
			)
		),
		ahs_row(
			array(
				'width'            => array(
					'unit' => 'custom',
					'size' => 'auto',
				),
				'flex_direction'   => 'row',
				'flex_align_items' => 'center',
				'flex_gap'         => ahs_gap( 28 ),
				'flex_gap_mobile'  => ahs_gap( 16 ),
			),
			array(
				ahs_mono_label(
					'Start',
					array(
						'link'              => array( 'url' => '#start', 'is_external' => '', 'nofollow' => '' ),
						'title_hover_color' => AHS_TEXT,
						'_element_width'    => 'auto',
					)
				),
				ahs_mono_label(
					'Features',
					array(
						'link'              => array( 'url' => '#features', 'is_external' => '', 'nofollow' => '' ),
						'title_hover_color' => AHS_TEXT,
						'_element_width'    => 'auto',
					)
				),
				ahs_mono_label(
					'Install',
					array(
						'link'              => array( 'url' => '#install', 'is_external' => '', 'nofollow' => '' ),
						'title_hover_color' => AHS_TEXT,
						'_element_width'    => 'auto',
					)
				),
			)
		),
	),
);

// --- Lane panels --------------------------------------------------------------

$hero = ahs_panel(
	ahs_panel_settings(
		'Hero',
		100,
		'#0A0A0B',
		array( '_element_id' => 'start' )
	),
	array(
		ahs_row(
			array(
				'flex_direction'       => 'row',
				'flex_justify_content' => 'flex-end',
			),
			array(
				ahs_mono_label( 'Free plugin · wordpress.org', array( '_element_width' => 'auto' ) ),
			)
		),
		ahs_row(
			array(
				'flex_direction' => 'column',
				'flex_gap'       => ahs_gap( 40 ),
			),
			array(
				ahs_display_heading(
					'Arts Horizontal<br>Scroll <span style="color:#9A9AA0">for&nbsp;Elementor</span>',
					'h1',
					'clamp(52px, 8.6vw, 150px)',
					ahs_anim( 1 )
				),
				ahs_row(
					array(
						'flex_direction'       => 'row',
						'flex_justify_content' => 'space-between',
						'flex_align_items'     => 'flex-end',
					),
					array(
						ahs_body_text(
							"Pin a section and the page's own scroll moves it sideways. You're inside it right now.",
							array_merge(
								ahs_anim( 2 ),
								AHS_SUBTITLE_CAP,
								array(
									'typography_font_size' => array(
										'unit'  => 'px',
										'size'  => 17,
										'sizes' => array(),
									),
								)
							)
						),
						ahs_mono_label( 'Scroll →', array_merge( ahs_anim( 3 ), array( '_element_width' => 'auto' ) ) ),
					)
				),
			)
		),
	)
);

$panel_containers = ahs_panel(
	ahs_panel_settings(
		'01 — Containers',
		85,
		'#0E0E10',
		array( '_element_id' => 'features' )
	),
	array(
		ahs_meta_row( '01', 'Any content' ),
		ahs_ghost( '01' ),
		ahs_row(
			array(
				'flex_direction'   => 'column',
				'flex_align_items' => 'flex-start',
				'flex_gap'         => ahs_gap( 14 ),
			),
			array(
				ahs_pill_button( 'A real button', '#', ahs_anim( 1 ) ),
				ahs_body_text( '✓ Headings, buttons, forms, images', array_merge( ahs_anim( 2 ), array( 'typography_font_size' => array( 'unit' => 'px', 'size' => 15, 'sizes' => array() ) ) ) ),
				ahs_body_text( '✓ Nested layouts work', array_merge( ahs_anim( 3 ), array( 'typography_font_size' => array( 'unit' => 'px', 'size' => 15, 'sizes' => array() ) ) ) ),
				ahs_body_text( '✓ Styled with the usual controls', array_merge( ahs_anim( 4 ), array( 'typography_font_size' => array( 'unit' => 'px', 'size' => 15, 'sizes' => array() ) ) ) ),
			)
		),
		ahs_body_group(
			'Real Containers',
			'Every panel is a normal Elementor Container. Drop in whatever widgets you use, nest layouts if you want. Nothing new to learn.'
		),
	)
);

$grid_cells = array();
for ( $i = 1; $i <= 6; $i++ ) {
	$grid_cells[] = array(
		'id'       => ahs_seed_id(),
		'elType'   => 'container',
		'settings' => array(
			'content_width'         => 'full',
			'animation'             => 'fadeIn',
			'animation_delay'       => 80 + ( $i - 1 ) * 100,
			'min_height'            => array(
				'unit'  => 'px',
				'size'  => 96,
				'sizes' => array(),
			),
			'flex_direction'        => 'row',
			'flex_justify_content'  => 'center',
			'flex_align_items'      => 'center',
			'flex_gap'              => ahs_zero_gap(),
			'padding'               => array(
				'unit'     => 'px',
				'top'      => '0',
				'right'    => '0',
				'bottom'   => '0',
				'left'     => '0',
				'isLinked' => true,
			),
			'background_background' => 'classic',
			'background_color'      => 'rgba(255,255,255,0.02)',
			'border_border'         => 'solid',
			'border_width'          => array(
				'unit'     => 'px',
				'top'      => '1',
				'right'    => '1',
				'bottom'   => '1',
				'left'     => '1',
				'isLinked' => true,
			),
			'border_color'          => 'rgba(255,255,255,0.1)',
		),
		'elements' => array(
			ahs_mono_label( (string) $i, array( '_element_width' => 'auto' ) ),
		),
	);
}

$panel_grid = ahs_panel(
	ahs_panel_settings( '02 — Grid', 65, '#101013' ),
	array(
		ahs_meta_row( '02', 'Grid' ),
		ahs_ghost( '02' ),
		array(
			'id'       => ahs_seed_id(),
			'elType'   => 'container',
			'settings' => array(
				'container_type'    => 'grid',
				'content_width'     => 'full',
				'width'             => array(
					'unit'  => 'px',
					'size'  => 560,
					'sizes' => array(),
				),
				'width_mobile'      => array(
					'unit'  => '%',
					'size'  => 100,
					'sizes' => array(),
				),
				'grid_columns_grid' => array(
					'unit' => 'fr',
					'size' => 3,
				),
				'grid_columns_grid_mobile' => array(
					'unit' => 'fr',
					'size' => 2,
				),
				'grid_rows_grid'    => array(
					'unit' => 'fr',
					'size' => 2,
				),
				'grid_gaps'         => array(
					'unit'     => 'px',
					'column'   => '12',
					'row'      => '12',
					'isLinked' => true,
				),
				'padding'           => array(
					'unit'     => 'px',
					'top'      => '0',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => true,
				),
			),
			'elements' => $grid_cells,
		),
		ahs_body_group(
			'Grids work in here',
			"This is Elementor's Grid container, living inside a panel. Flex or Grid, containers behave the same in the track as anywhere else."
		),
	)
);

$panel_widths = ahs_panel(
	ahs_panel_settings( '03 — Widths', 50, '#0E0E10' ),
	array(
		ahs_meta_row( '03', 'Layout' ),
		ahs_ghost( '03' ),
		ahs_body_group(
			'This panel is 50vw',
			'The grid before was 65. A panel is whatever width you give it, and the track adds them up.'
		),
	)
);

function ahs_pro_layer( string $width, string $height, string $left, string $top, string $bg, int $speed, int $slot ): array {
	return array(
		'id'       => ahs_seed_id(),
		'elType'   => 'container',
		'settings' => array(
			'content_width'         => 'full',
			'position'              => 'absolute',
			'_offset_orientation_h' => 'start',
			'_offset_x'             => array(
				'unit' => 'custom',
				'size' => $left,
			),
			'_offset_orientation_v' => 'start',
			'_offset_y'             => array(
				'unit' => 'custom',
				'size' => $top,
			),
			'width'                 => array(
				'unit' => 'custom',
				'size' => $width,
			),
			'min_height'            => array(
				'unit' => 'custom',
				'size' => $height,
			),
			'animation'             => 'fadeIn',
			'animation_delay'       => 80 + ( $slot - 1 ) * 100,
			'background_background' => 'classic',
			'background_color'      => $bg,
			'border_border'         => 'solid',
			'border_width'          => array(
				'unit'     => 'px',
				'top'      => '1',
				'right'    => '1',
				'bottom'   => '1',
				'left'     => '1',
				'isLinked' => true,
			),
			'border_color'          => 'rgba(255,255,255,0.1)',
			// Elementor Pro Motion FX — inert without Pro.
			'motion_fx_motion_fx_scrolling'      => 'yes',
			'motion_fx_translateX_effect'        => 'yes',
			'motion_fx_translateX_speed'         => array(
				'unit'  => 'px',
				'size'  => $speed,
				'sizes' => array(),
			),
			'motion_fx_translateX_affectedRange' => array(
				'unit'  => '%',
				'size'  => '',
				'sizes' => array(
					'start' => 0,
					'end'   => 100,
				),
			),
		),
		'elements' => array(),
	);
}

$panel_pro = ahs_panel(
	ahs_panel_settings( '04 — With Elementor Pro', 75, '#101013' ),
	array(
		ahs_meta_row( '04', 'With Elementor Pro' ),
		ahs_ghost( '04' ),
		ahs_row(
			array(
				'min_height' => array(
					'unit'  => 'vh',
					'size'  => 30,
					'sizes' => array(),
				),
			),
			array(
				ahs_pro_layer( '44%', '72%', '0%', '14%', 'rgba(255,255,255,0.03)', 2, 1 ),
				ahs_pro_layer( '34%', '52%', '30%', '0%', 'rgba(255,255,255,0.05)', 4, 2 ),
				ahs_pro_layer( '28%', '44%', '58%', '36%', 'rgba(255,255,255,0.08)', 6, 3 ),
				ahs_mono_label(
					'Motion FX · parallax layers',
					array_merge(
						ahs_anim( 4 ),
						array(
							'_position'             => 'absolute',
							'_offset_orientation_h' => 'end',
							'_offset_x_end'         => array(
								'unit'  => 'px',
								'size'  => 0,
								'sizes' => array(),
							),
							'_offset_orientation_v' => 'end',
							'_offset_y_end'         => array(
								'unit'  => 'px',
								'size'  => 0,
								'sizes' => array(),
							),
						)
					)
				),
			)
		),
		ahs_body_group(
			'Motion FX keeps moving',
			'Have Elementor Pro? Scrolling Effects keep working in here. Element and background parallax follow the sideways motion instead of freezing.'
		),
	)
);

$phone_bars = array();
for ( $i = 0; $i < 3; $i++ ) {
	$phone_bars[] = array(
		'id'       => ahs_seed_id(),
		'elType'   => 'container',
		'settings' => array(
			'content_width'         => 'full',
			'min_height'            => array(
				'unit'  => 'px',
				'size'  => 80,
				'sizes' => array(),
			),
			'padding'               => array(
				'unit'     => 'px',
				'top'      => '0',
				'right'    => '0',
				'bottom'   => '0',
				'left'     => '0',
				'isLinked' => true,
			),
			'background_background' => 'classic',
			'background_color'      => 'rgba(255,255,255,0.03)',
			'border_border'         => 'solid',
			'border_width'          => array(
				'unit'     => 'px',
				'top'      => '1',
				'right'    => '1',
				'bottom'   => '1',
				'left'     => '1',
				'isLinked' => true,
			),
			'border_color'          => AHS_HAIRLINE,
		),
		'elements' => array(),
	);
}

$panel_touch = ahs_panel(
	ahs_panel_settings( '05 — Touch screens', 60, '#0E0E10' ),
	array(
		ahs_meta_row( '05', 'Touch screens' ),
		ahs_ghost( '05' ),
		ahs_row(
			array(
				'flex_direction'   => 'row',
				'flex_align_items' => 'flex-end',
				'flex_gap'         => ahs_gap( 20 ),
			),
			array(
				array(
					'id'       => ahs_seed_id(),
					'elType'   => 'container',
					'settings' => array(
						'content_width'  => 'full',
						'width'          => array(
							'unit'  => 'px',
							'size'  => 150,
							'sizes' => array(),
						),
						'animation'       => 'fadeIn',
						'animation_delay' => 80,
						'min_height'     => array(
							'unit'  => 'px',
							'size'  => 280,
							'sizes' => array(),
						),
						'flex_direction' => 'column',
						'flex_gap'       => ahs_gap( 8 ),
						'padding'        => array(
							'unit'     => 'px',
							'top'      => '10',
							'right'    => '10',
							'bottom'   => '10',
							'left'     => '10',
							'isLinked' => true,
						),
						'border_border'  => 'solid',
						'border_width'   => array(
							'unit'     => 'px',
							'top'      => '1',
							'right'    => '1',
							'bottom'   => '1',
							'left'     => '1',
							'isLinked' => true,
						),
						'border_color'   => 'rgba(255,255,255,0.15)',
						'border_radius'  => array(
							'unit'     => 'px',
							'top'      => '18',
							'right'    => '18',
							'bottom'   => '18',
							'left'     => '18',
							'isLinked' => true,
						),
					),
					'elements' => $phone_bars,
				),
				ahs_mono_label( 'Stack on touch · on by default', array_merge( ahs_anim( 2 ), array( '_element_width' => 'auto' ) ) ),
			)
		),
		ahs_body_group(
			'Phones get a column',
			"Open this page on a phone: the panels stack into a normal vertical page, because fingers scroll down. It's a default, not a rule. One switch keeps the section horizontal on touch screens too, if your design needs that."
		),
	)
);

$endcap = ahs_panel(
	array_merge(
		ahs_panel_settings(
			'06 — Install',
			40,
			'#15151A',
			array( '_element_id' => 'install' )
		),
		array(
			'flex_justify_content' => 'center',
			'flex_align_items'     => 'flex-start',
			'flex_gap'             => ahs_gap( 20 ),
		)
	),
	array(
		ahs_display_heading( 'Add it to your WordPress web site', 'h2', 'clamp(28px, 3vw, 48px)', array_merge( ahs_anim( 2 ), AHS_TITLE_CAP ) ),
		ahs_pill_button(
			'Install Plugin',
			'https://wordpress.org/plugins/horizontal-scroll-for-elementor/',
			array_merge( ahs_anim( 3 ), array( '_element_width' => 'auto' ) )
		),
	)
);

$panel_children = array( $hero, $panel_containers, $panel_grid, $panel_widths, $panel_pro, $panel_touch, $endcap );

$widget = array(
	'id'         => ahs_seed_id(),
	'elType'     => 'widget',
	'widgetType' => 'arts-horizontal-scroll',
	'settings'   => array(
		// Row count MUST equal child-container count — linkage is positional.
		'panels'           => array_map(
			static function ( array $panel ): array {
				return array(
					'_id'         => ahs_seed_id(),
					'panel_title' => $panel['settings']['_title'],
				);
			},
			$panel_children
		),
		'layout'           => 'horizontal',
		'layout_mobile'    => 'vertical',
		'touch_vertical'   => 'yes',
		'panels_gap'       => array(
			'unit'  => 'px',
			'size'  => 0,
			'sizes' => array(),
		),
		'viewport_height'  => array(
			'unit'  => 'vh',
			'size'  => 100,
			'sizes' => array(),
		),
		'pin_offset'       => array(
			'unit'  => 'px',
			'size'  => 56,
			'sizes' => array(),
		),
		'pin_offset_mobile' => array(
			'unit'  => 'px',
			'size'  => 48,
			'sizes' => array(),
		),
		'scroll_direction' => 'ltr',
		'scroll_factor'    => array(
			'unit'  => 'px',
			'size'  => 1.2,
			'sizes' => array(),
		),
	),
	'elements'   => $panel_children,
);

$widget_wrap = array(
	'id'       => ahs_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'         => 'Demo Lane',
		'content_width'  => 'full',
		'padding'        => array(
			'unit'     => 'px',
			'top'      => '56',
			'right'    => '0',
			'bottom'   => '0',
			'left'     => '0',
			'isLinked' => false,
		),
		'padding_mobile' => array(
			'unit'     => 'px',
			'top'      => '48',
			'right'    => '0',
			'bottom'   => '0',
			'left'     => '0',
			'isLinked' => false,
		),
		'flex_gap'       => ahs_zero_gap(),
	),
	'elements' => array( $widget ),
);

// --- Outro --------------------------------------------------------------------

$outro = array(
	'id'       => ahs_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'               => 'Outro',
		'content_width'        => 'full',
		'min_height'           => array(
			'unit'  => 'vh',
			'size'  => 64,
			'sizes' => array(),
		),
		'flex_direction'       => 'column',
		'flex_justify_content' => 'space-between',
		'flex_gap'             => ahs_gap( 48 ),
		'padding'              => AHS_PADDING,
		'padding_mobile'       => AHS_PADDING_MOBILE,
		'border_border'        => 'solid',
		'border_width'         => array(
			'unit'     => 'px',
			'top'      => '1',
			'right'    => '0',
			'bottom'   => '0',
			'left'     => '0',
			'isLinked' => false,
		),
		'border_color'         => AHS_HAIRLINE,
	),
	'elements' => array(
		ahs_row(
			array(
				'flex_direction' => 'column',
				'flex_gap'       => ahs_gap( 20 ),
			),
			array(
				ahs_mono_label( "That's the whole tour", ahs_anim( 1 ) ),
				ahs_display_heading( 'Now build yours', 'h2', 'clamp(28px, 4.6vw, 88px)', array_merge( ahs_anim( 2 ), AHS_TITLE_CAP ) ),
			)
		),
		ahs_row(
			array(
				'flex_direction'       => 'row',
				'flex_justify_content' => 'space-between',
				'flex_align_items'     => 'center',
			),
			array(
				ahs_mono_label( '© 2026 Artem Semkin', array( '_element_width' => 'auto' ) ),
			)
		),
	),
);

// --- Persist ------------------------------------------------------------------

$slug     = 'ahs-demo';
$existing = get_page_by_path( $slug );

$post_id = $existing ? $existing->ID : wp_insert_post(
	array(
		'import_id'   => AHS_DEMO_PAGE_ID,
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Arts Horizontal Scroll — Demo',
		'post_name'   => $slug,
	),
	true
);

if ( is_wp_error( $post_id ) ) {
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		WP_CLI::error( $post_id->get_error_message() );
	}
	return;
}

$elements = array( $header, $widget_wrap, $outro );

$page_settings = array(
	'template'              => 'elementor_canvas',
	'hide_title'            => 'yes',
	'background_background' => 'classic',
	'background_color'      => '#0A0A0B',
);

// Mirrors Document::save()'s sequence (elementor/core/base/document.php).
update_post_meta( $post_id, '_elementor_page_settings', wp_slash( $page_settings ) );
update_post_meta( $post_id, '_elementor_data', wp_slash( wp_json_encode( $elements, JSON_UNESCAPED_UNICODE ) ) );
update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
update_post_meta( $post_id, '_wp_page_template', 'elementor_canvas' );
update_post_meta( $post_id, '_elementor_version', ELEMENTOR_VERSION );

// Post CSS never diffs (is_update_required() is hard-coded false) — delete to regen.
\Elementor\Core\Files\CSS\Post::create( $post_id )->delete();
delete_post_meta( $post_id, '_elementor_element_cache' );

// The editor prefers newer autosave revisions over raw meta — remove them all.
foreach ( wp_get_post_revisions( $post_id, array( 'fields' => 'ids' ) ) as $revision_id ) {
	wp_delete_post_revision( $revision_id );
}

// Retire the superseded portfolio draft (design pivot 2026-07-18).
$obsolete = get_page_by_path( 'atelier-mono' );
if ( $obsolete && 'trash' !== $obsolete->post_status ) {
	wp_trash_post( $obsolete->ID );
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		WP_CLI::log( sprintf( 'Trashed superseded page %d (atelier-mono).', $obsolete->ID ) );
	}
}

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::success( sprintf( 'Demo page seeded: post_id=%d %s', $post_id, get_permalink( $post_id ) ) );
}
