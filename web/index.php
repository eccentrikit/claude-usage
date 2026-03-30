<?php

require_once __DIR__ . '/api.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Handle CORS preflight
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

// Route requests
switch (true) {
    case $uri === '/api/health':
        handle_health();
        break;

    case rtrim($uri, '/') === '/api/usage' && $method === 'POST':
        handle_post_usage();
        break;

    case rtrim($uri, '/') === '/api/usage' && $method === 'GET':
        handle_get_usage();
        break;

    case str_starts_with($uri, '/embed'):
        // Serve embed page
        $file = $uri === '/embed' || $uri === '/embed/' ? '/embed/index.html' : $uri;
        $path = __DIR__ . $file;
        if (file_exists($path) && is_file($path)) {
            $ext = pathinfo($path, PATHINFO_EXTENSION);
            $types = [
                'html' => 'text/html',
                'css' => 'text/css',
                'js' => 'application/javascript',
            ];
            header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
            readfile($path);
        } else {
            http_response_code(404);
            echo 'Not found';
        }
        break;

    default:
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
        break;
}
