<?php

define('API_KEY', getenv('API_KEY') ?: 'change-me');
define('DATA_FILE', __DIR__ . '/data/usage.json');
define('CORS_ORIGIN', getenv('CORS_ORIGIN') ?: '*');
define('MAX_HISTORY', 100);
