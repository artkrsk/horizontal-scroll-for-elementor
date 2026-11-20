<?php
/**
 * Seeds the browser tier's keyboard-focus fixture page.
 *
 * The demo page (dev/seed/demo-page.php) is the shop window: it has two
 * controls in its track and both carry an Elementor entrance animation, which
 * keeps them at `visibility: hidden`, out of the tab order, until the stage has
 * passed them once. This page carries what the focus cases need instead:
 * controls before and after the section, several per panel, a panel wider than
 * the stage with controls along it, a text field, and one control wider than
 * the stage itself. Nothing here is animated. Run from
 * tests/e2e/global-setup.ts:
 *   wp eval-file tests/e2e/fixtures/keyboard-page.php --user=1
 *
 * Idempotent: finds the page by slug and rewrites it wholesale. Persist tail
 * mirrors the seed's. Outside phpcs/phpstan scope like the seed, and kept to
 * the seed's style (WP_CLI-guarded, no namespace).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AHS_KEYBOARD_PAGE_ID', 9913 );

const AHS_KB_ZERO_PADDING = array(
	'unit'     => 'px',
	'top'      => '0',
	'right'    => '0',
	'bottom'   => '0',
	'left'     => '0',
	'isLinked' => true,
);
const AHS_KB_PADDING      = array(
	'unit'     => 'px',
	'top'      => '80',
	'right'    => '80',
	'bottom'   => '80',
	'left'     => '80',
	'isLinked' => true,
);
const AHS_KB_ONE_SCREEN   = array(
	'unit'  => 'vh',
	'size'  => 100,
	'sizes' => array(),
);

function ahs_kb_id(): string {
	return substr( bin2hex( random_bytes( 4 ) ), 0, 7 );
}

function ahs_kb_heading( string $title ): array {
	return array(
		'id'         => ahs_kb_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array(
			'title'       => $title,
			'header_size' => 'h2',
		),
		'elements'   => array(),
	);
}

/** A core Button widget; the CSS ID lands on the widget wrapper, the control is its `a`. */
function ahs_kb_button( string $css_id, string $text ): array {
	return array(
		'id'         => ahs_kb_id(),
		'elType'     => 'widget',
		'widgetType' => 'button',
		'settings'   => array(
			'_element_id' => $css_id,
			'text'        => $text,
			'link'        => array(
				'url'         => '#',
				'is_external' => '',
				'nofollow'    => '',
			),
		),
		'elements'   => array(),
	);
}

function ahs_kb_html( string $html ): array {
	return array(
		'id'         => ahs_kb_id(),
		'elType'     => 'widget',
		'widgetType' => 'html',
		'settings'   => array(
			'html' => $html,
		),
		'elements'   => array(),
	);
}

/**
 * A panel: a locked child Container carrying the panel marker, a definite vw
 * width and a CSS ID for the specs.
 */
function ahs_kb_panel( string $css_id, int $width_vw, string $background, array $settings, array $children ): array {
	return array(
		'id'       => ahs_kb_id(),
		'elType'   => 'container',
		'isInner'  => false,
		'isLocked' => true,
		'settings' => array_merge(
			array(
				'_title'                => ucfirst( $css_id ),
				'_element_id'           => $css_id,
				'content_width'         => 'full',
				'width'                 => array(
					'unit'  => 'vw',
					'size'  => $width_vw,
					'sizes' => array(),
				),
				'arts_hs_panel'         => 'yes',
				'min_height'            => AHS_KB_ONE_SCREEN,
				'flex_direction'        => 'column',
				'flex_justify_content'  => 'center',
				'flex_align_items'      => 'flex-start',
				'padding'               => AHS_KB_PADDING,
				'background_background' => 'classic',
				'background_color'      => $background,
			),
			$settings
		),
		'elements' => $children,
	);
}

/** A full-height block outside the section, holding one control. */
function ahs_kb_block( string $title, array $children ): array {
	return array(
		'id'       => ahs_kb_id(),
		'elType'   => 'container',
		'isInner'  => false,
		'settings' => array(
			'_title'               => $title,
			'content_width'        => 'full',
			'min_height'           => AHS_KB_ONE_SCREEN,
			'flex_direction'       => 'column',
			'flex_justify_content' => 'center',
			'flex_align_items'     => 'flex-start',
			'padding'              => AHS_KB_PADDING,
		),
		'elements' => $children,
	);
}

const AHS_KB_ROW = array(
	'flex_direction'       => 'row',
	'flex_justify_content' => 'space-between',
	'flex_align_items'     => 'center',
);

$panel_children = array(
	ahs_kb_panel(
		'kb-one',
		100,
		'#F4F1EA',
		array(),
		array(
			ahs_kb_heading( 'One' ),
			ahs_kb_button( 'kb-one-button', 'One' ),
		)
	),
	ahs_kb_panel(
		'kb-two',
		100,
		'#E6ECEF',
		AHS_KB_ROW,
		array(
			ahs_kb_button( 'kb-two-left', 'Two, left' ),
			ahs_kb_button( 'kb-two-right', 'Two, right' ),
		)
	),
	ahs_kb_panel(
		'kb-wide',
		250,
		'#F4F1EA',
		AHS_KB_ROW,
		array(
			ahs_kb_button( 'kb-wide-start', 'Wide, start' ),
			ahs_kb_button( 'kb-wide-middle', 'Wide, middle' ),
			ahs_kb_button( 'kb-wide-end', 'Wide, end' ),
		)
	),
	ahs_kb_panel(
		'kb-form',
		100,
		'#E6ECEF',
		array(),
		array(
			ahs_kb_heading( 'A field and a link' ),
			ahs_kb_html( '<p><label>Name <input type="text" id="kb-input"></label></p><p><a href="#" id="kb-link">A plain link</a></p>' ),
		)
	),
	// Zero padding: the link below is then exactly as wide as its panel, wider than any stage.
	ahs_kb_panel(
		'kb-banner',
		160,
		'#F4F1EA',
		array(
			'padding'          => AHS_KB_ZERO_PADDING,
			'flex_align_items' => 'stretch',
		),
		array(
			ahs_kb_html( '<a href="#" id="kb-banner-link" style="display:block;padding:80px;font-size:48px">A link wider than the stage, from one edge of its panel to the other</a>' ),
		)
	),
	ahs_kb_panel(
		'kb-last',
		100,
		'#E6ECEF',
		array(),
		array(
			ahs_kb_heading( 'Last' ),
			ahs_kb_button( 'kb-last-button', 'Last' ),
		)
	),
);

$widget = array(
	'id'         => ahs_kb_id(),
	'elType'     => 'widget',
	'widgetType' => 'arts-horizontal-scroll',
	'settings'   => array(
		// Row count MUST equal child-container count — linkage is positional.
		'panels' => array_map(
			static function ( array $panel ): array {
				return array(
					'_id'         => ahs_kb_id(),
					'panel_title' => $panel['settings']['_title'],
				);
			},
			$panel_children
		),
		'layout' => 'horizontal',
	),
	'elements'   => $panel_children,
);

$widget_wrap = array(
	'id'       => ahs_kb_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'        => 'Lane',
		'content_width' => 'full',
		'padding'       => AHS_KB_ZERO_PADDING,
	),
	'elements' => array( $widget ),
);

$elements = array(
	ahs_kb_block(
		'Before',
		array(
			ahs_kb_heading( 'Keyboard focus: press Tab' ),
			ahs_kb_button( 'kb-before', 'Before the section' ),
		)
	),
	$widget_wrap,
	ahs_kb_block(
		'After',
		array(
			ahs_kb_button( 'kb-after', 'After the section' ),
		)
	),
);

// --- Persist (mirrors dev/seed/demo-page.php) ---------------------------------

$slug     = 'ahs-keyboard';
$existing = get_page_by_path( $slug );

$post_id = $existing ? $existing->ID : wp_insert_post(
	array(
		'import_id'   => AHS_KEYBOARD_PAGE_ID,
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Arts Horizontal Scroll — Keyboard Fixture',
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

$page_settings = array(
	'template'   => 'elementor_canvas',
	'hide_title' => 'yes',
);

// Writes the meta of an Elementor-built page directly. Not Document::save()'s
// sequence: save() puts _wp_page_template first and does not write
// _elementor_edit_mode.
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

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::success( sprintf( 'Keyboard fixture seeded: post_id=%d %s', $post_id, get_permalink( $post_id ) ) );
}
