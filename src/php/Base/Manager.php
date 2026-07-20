<?php

namespace Arts\HorizontalScroll\Base;

use ArtsHorizontalScroll\Arts\Base\Managers\BaseManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

abstract class Manager extends BaseManager {

	/** @var ManagersContainer|null */
	protected $managers;
}
