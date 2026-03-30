<?php

require_once __DIR__ . '/config.php';

function send_json(int $status, array $data): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function check_api_key(): void {
    $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($key !== API_KEY) {
        send_json(401, ['error' => 'Invalid API key']);
    }
}

function read_data(): array {
    if (!file_exists(DATA_FILE)) {
        return ['latest' => null, 'history' => []];
    }
    $raw = file_get_contents(DATA_FILE);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return ['latest' => null, 'history' => []];
    }
    return $data;
}

function write_data(array $data): void {
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function handle_health(): void {
    send_json(200, ['status' => 'ok']);
}

function handle_get_usage(): void {
    $data = read_data();
    if ($data['latest'] === null) {
        send_json(200, ['planTier' => null, 'updatedAt' => null, 'entries' => []]);
    }
    send_json(200, $data['latest']);
}

function handle_post_usage(): void {
    check_api_key();

    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !isset($body['entries']) || !is_array($body['entries']) || count($body['entries']) === 0) {
        send_json(400, ['error' => 'entries array is required and must not be empty']);
    }

    $snapshot = [
        'scrapedAt' => $body['scrapedAt'] ?? date('c'),
        'planTier' => $body['planTier'] ?? null,
        'entries' => $body['entries'],
    ];

    write_data(['latest' => $snapshot]);

    send_json(201, [
        'status' => 'ok',
        'inserted' => count($body['entries']),
        'timestamp' => $snapshot['scrapedAt'],
    ]);
}
