<?php

require_once __DIR__ . '/../../api.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

if ($method === 'POST') {
    handle_post_usage();
} else {
    handle_get_usage();
}
