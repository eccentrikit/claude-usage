# Claude Usage Tracker

## Project Overview

Chrome extension + PHP backend + embeddable dashboard + macOS menu bar plugin for tracking Claude AI usage limits.

## Architecture

- `extension/` — Chrome Extension (Manifest V3), scrapes claude.ai/settings/usage DOM
- `web/` — Plain PHP backend (no framework, no Composer), JSON flat-file storage
- `web/embed/` — Static HTML/CSS/JS embeddable dashboard
- `menubar/` — SwiftBar/xbar Python plugin for macOS menu bar

## Key Files

- `extension/content.js` — DOM scraping logic (most fragile, heuristic-based)
- `extension/service-worker.js` — Background worker, relays data to backend, manages alarms
- `web/api.php` — Shared PHP functions for all API endpoints
- `web/api/usage/index.php` — POST (receive data) and GET (serve data) handler
- `web/config.php` — Configuration via env vars (API_KEY, CORS_ORIGIN)
- `web/embed/embed.js` — Dashboard rendering with pace markers

## Development

- PHP files have no dependencies. Test locally with `php -S localhost:8000 web/index.php`
- Extension: load unpacked from `extension/` in `chrome://extensions`
- Menu bar: requires SwiftBar (`brew install --cask swiftbar`)

## Important Notes

- `extension.pem` is a private key — never commit it
- `web/data/usage.json` contains user data — excluded from git
- Users must update `manifest.json` host_permissions and menubar API_URL for their own server
- Content script scraping may break if Anthropic changes the usage page DOM structure
