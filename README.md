# Claude Usage Tracker

Track your [Claude AI](https://claude.ai) usage limits and display them on an embeddable dashboard. Includes a Chrome extension for scraping, a PHP backend for storage, an embeddable web widget, and a macOS menu bar plugin.

## Components

### Chrome Extension (`extension/`)

A Manifest V3 Chrome extension that scrapes usage stats from `claude.ai/settings/usage` and sends them to your backend.

**Features:**
- Automatic scraping on a configurable interval (default: 15 min)
- Reloads the usage page before scraping to ensure fresh data
- Auto-opens a usage tab if none exists
- Popup UI for configuration and status

**Setup:**
1. Open `chrome://extensions` and enable **Developer mode**
2. Click **Load unpacked** and select the `extension/` directory
3. Click the extension icon and configure:
   - **API Endpoint**: Your server URL (e.g., `https://your-server.com`)
   - **API Key**: Must match the key configured on your server
   - **Scrape Interval**: How often to scrape (in minutes)
4. **Important**: Update `host_permissions` in `manifest.json` to include your server's domain

### PHP Backend (`web/`)

A plain PHP backend (no framework, no Composer) that receives usage data from the extension and serves it via a JSON API.

**Endpoints:**
- `GET /api/health/` — Health check
- `POST /api/usage/` — Receive usage data (requires `X-API-Key` header)
- `GET /api/usage/` — Return latest usage data (no auth, for embed page)
- `/embed/` — Embeddable dashboard page

**Configuration** is via environment variables:
- `API_KEY` — Shared secret for POST authentication (default: `change-me`)
- `CORS_ORIGIN` — Allowed CORS origin (default: `*`)

**Deployment:**
```bash
# Docker with PHP built-in server
docker run -p 3000:8000 \
  -e API_KEY=your-secret-key \
  -v $(pwd)/web:/app -w /app \
  php:8-cli php -S 0.0.0.0:8000 index.php

# Docker with Apache
docker run -p 3000:80 \
  -e API_KEY=your-secret-key \
  -v $(pwd)/web:/var/www/html \
  php:8-apache
```

Make sure the `web/data/` directory is writable by the PHP process.

**Storage:** JSON flat file at `web/data/usage.json`. Keeps the latest snapshot and up to 100 historical entries.

### Embeddable Dashboard (`web/embed/`)

A standalone HTML page that fetches usage data from the API and renders it with progress bars and pace indicators.

**Features:**
- Dark theme by default, light theme via `?theme=light`
- Color-coded progress bars (blue < 70%, amber 70-90%, red > 90%)
- Pace marker showing where you should be based on time elapsed in the reset window
- Auto-refreshes every 60 seconds
- Compact, iframe-friendly layout

**Embed in a dashboard:**
```html
<iframe src="https://your-server.com/embed/" width="400" height="350"></iframe>
```

### macOS Menu Bar Plugin (`menubar/`)

A [SwiftBar](https://github.com/swiftbar/SwiftBar) / [xbar](https://xbarapp.com/) plugin that shows usage in your macOS menu bar.

**Shows:** `41%-2%` (41% used, 2% under pace)

**Dropdown includes:**
- All three usage bars with text progress indicators
- Pace status (under/over)
- Reset countdown (e.g., "Resets Mon 3:00 AM (4d 5h left)")
- Link to open dashboard

**Setup:**
1. Install SwiftBar: `brew install --cask swiftbar`
2. Edit `menubar/claude-usage.5m.py` and set `API_URL` to your server
3. Point SwiftBar's plugin folder to the `menubar/` directory

The filename `claude-usage.5m.py` means it refreshes every 5 minutes.

## Data Flow

```
claude.ai/settings/usage
        │
        │ content script scrapes DOM
        ▼
Chrome Extension (service-worker.js)
        │
        │ POST /api/usage/
        ▼
PHP Backend (web/)
        │
        │ stores to data/usage.json
        ▼
   ┌────┴────┐
   ▼         ▼
Embed Page   Menu Bar Plugin
(auto-refresh) (polls every 5m)
```

## Usage Data Format

The API returns JSON in this format:

```json
{
  "scrapedAt": "2026-03-26T10:30:00.000Z",
  "planTier": "Pro",
  "entries": [
    {
      "label": "Current session",
      "category": "session",
      "usagePercent": 3,
      "usageLabel": "3% used",
      "resetTime": null,
      "subtitle": "Starts when a message is sent"
    },
    {
      "label": "All models",
      "category": "weekly",
      "usagePercent": 39,
      "usageLabel": "39% used",
      "resetTime": "Resets Mon 3:00 AM"
    },
    {
      "label": "Sonnet only",
      "category": "weekly",
      "usagePercent": 23,
      "usageLabel": "23% used",
      "resetTime": "Resets Mon 4:00 AM"
    }
  ]
}
```

## Content Script Scraping Strategy

The claude.ai usage page is a React SPA with no stable DOM selectors. The content script uses heuristic pattern matching:

1. Finds all `X% used` text nodes via TreeWalker
2. Walks up the DOM to isolate each usage section
3. Extracts labels by matching known patterns ("Current session", "All models", "Sonnet only")
4. Extracts reset times via regex (`Resets Mon 3:00 AM`)
5. Categorizes entries as "session" or "weekly"

If the page structure changes and scraping breaks, inspect the DOM in DevTools and update the patterns in `extension/content.js`.

## License

MIT
