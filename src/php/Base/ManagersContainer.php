<?php

namespace Arts\HorizontalScroll\Base;

use ArtsHorizontalScroll\Arts\Base\Containers\ManagersContainer as BaseManagersContainer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * @property \Arts\HorizontalScroll\Managers\Assets    $assets
 * @property \Arts\HorizontalScroll\Managers\Elementor $elementor
 * @property \Arts\HorizontalScroll\Managers\Notices   $notices
 */
class ManagersContainer extends BaseManagersContainer {
}
