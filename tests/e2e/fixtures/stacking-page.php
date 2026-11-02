<?php
/**
 * Seeds the browser tier's panel-width fixture page.
 *
 * The demo page (dev/seed/demo-page.php) is the shop window and keeps its
 * design; this page carries the panel-width cases that design does not:
 * Layout vertical on tablet, a Fit Content panel, a legacy typed `max-content`
 * Width, and a boxed panel. Run from tests/e2e/global-setup.ts:
 *   wp eval-file tests/e2e/fixtures/stacking-page.php --user=1
 *
 * Idempotent: finds the page by slug and rewrites it wholesale. Persist tail
 * mirrors the seed's. Outside phpcs/phpstan scope like the seed, and kept to
 * the seed's style (WP_CLI-guarded, no namespace).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AHS_STACKING_PAGE_ID', 9912 );

const AHS_FIXTURE_ZERO_PADDING = array(
	'unit'     => 'px',
	'top'      => '0',
	'right'    => '0',
	'bottom'   => '0',
	'left'     => '0',
	'isLinked' => true,
);
const AHS_FIXTURE_ZERO_GAP     = array(
	'unit'     => 'px',
	'column'   => '0',
	'row'      => '0',
	'isLinked' => true,
);
const AHS_FIXTURE_ONE_SCREEN   = array(
	'unit'  => 'vw',
	'size'  => 100,
	'sizes' => array(),
);

function ahs_fixture_id(): string {
	return substr( bin2hex( random_bytes( 4 ) ), 0, 7 );
}

/** A heading pinned to a definite 600px width, so max-content has a known answer. */
function ahs_fixture_heading( string $title ): array {
	return array(
		'id'         => ahs_fixture_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array(
			'title'                 => $title,
			'header_size'           => 'h2',
			'_element_width'        => 'initial',
			'_element_custom_width' => array(
				'unit'  => 'px',
				'size'  => 600,
				'sizes' => array(),
			),
		),
		'elements'   => array(),
	);
}

/**
 * A panel: a locked child Container carrying the panel marker, zero padding
 * (so its max-content equals its content's width) and a CSS ID for the specs.
 */
function ahs_fixture_panel( string $css_id, array $settings, array $children ): array {
	return array(
		'id'       => ahs_fixture_id(),
		'elType'   => 'container',
		'isInner'  => false,
		'isLocked' => true,
		'settings' => array_merge(
			array(
				'_title'         => ucfirst( $css_id ),
				'_element_id'    => $css_id,
				'content_width'  => 'full',
				'width'          => AHS_FIXTURE_ONE_SCREEN,
				'arts_hs_panel'  => 'yes',
				'flex_direction' => 'column',
				'flex_gap'       => AHS_FIXTURE_ZERO_GAP,
				'padding'        => AHS_FIXTURE_ZERO_PADDING,
			),
			$settings
		),
		'elements' => $children,
	);
}

$panel_children = array(
	ahs_fixture_panel( 'full', array(), array( ahs_fixture_heading( 'Full' ) ) ),
	ahs_fixture_panel(
		'fit',
		array( 'arts_hs_fit_content' => 'yes' ),
		array( ahs_fixture_heading( 'Fit' ) )
	),
	ahs_fixture_panel(
		'legacy',
		array(
			'width' => array(
				'unit'  => 'custom',
				'size'  => 'max-content',
				'sizes' => array(),
			),
		),
		array( ahs_fixture_heading( 'Legacy' ) )
	),
	ahs_fixture_panel(
		'boxed',
		array(
			'content_width' => 'boxed',
			'boxed_width'   => array(
				'unit'  => 'px',
				'size'  => 500,
				'sizes' => array(),
			),
		),
		array( ahs_fixture_heading( 'Boxed' ) )
	),
);

$widget = array(
	'id'         => ahs_fixture_id(),
	'elType'     => 'widget',
	'widgetType' => 'arts-horizontal-scroll',
	'settings'   => array(
		// Row count MUST equal child-container count — linkage is positional.
		'panels'        => array_map(
			static function ( array $panel ): array {
				return array(
					'_id'         => ahs_fixture_id(),
					'panel_title' => $panel['settings']['_title'],
				);
			},
			$panel_children
		),
		'layout'        => 'horizontal',
		'layout_tablet' => 'vertical',
	),
	'elements'   => $panel_children,
);

$spacer = array(
	'id'       => ahs_fixture_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'        => 'Spacer',
		'content_width' => 'full',
		'min_height'    => array(
			'unit'  => 'vh',
			'size'  => 100,
			'sizes' => array(),
		),
	),
	'elements' => array(),
);

$widget_wrap = array(
	'id'       => ahs_fixture_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'        => 'Lane',
		'content_width' => 'full',
		'padding'       => AHS_FIXTURE_ZERO_PADDING,
		'flex_gap'      => AHS_FIXTURE_ZERO_GAP,
	),
	'elements' => array( $widget ),
);

// --- Persist (mirrors dev/seed/demo-page.php) ---------------------------------

$slug     = 'ahs-stacking';
$existing = get_page_by_path( $slug );

$post_id = $existing ? $existing->ID : wp_insert_post(
	array(
		'import_id'   => AHS_STACKING_PAGE_ID,
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Arts Horizontal Scroll — Stacking Fixture',
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

$elements = array( $spacer, $widget_wrap );

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
	WP_CLI::success( sprintf( 'Stacking fixture seeded: post_id=%d %s', $post_id, get_permalink( $post_id ) ) );
}
