(function () {
  var REFRESH_INTERVAL = 60000;
  var API_URL = '../api/usage/';
  var SESSION_BUDGET = 80; // fixed pace marker for session bar

  async function fetchUsage() {
    try {
      var res = await fetch(API_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      var el = document.getElementById('error');
      el.textContent = 'Failed to load: ' + err.message;
      el.classList.remove('hidden');
      return null;
    }
  }

  function render(data) {
    var entriesEl = document.getElementById('entries');
    var noDataEl = document.getElementById('no-data');
    var errorEl = document.getElementById('error');
    var planEl = document.getElementById('plan-tier');
    var updatedEl = document.getElementById('updated-at');

    errorEl.classList.add('hidden');

    if (!data || !data.entries || data.entries.length === 0) {
      noDataEl.classList.remove('hidden');
      entriesEl.innerHTML = '';
      return;
    }

    noDataEl.classList.add('hidden');
    planEl.textContent = data.planTier ? data.planTier + ' Plan' : '';
    updatedEl.textContent = data.scrapedAt
      ? 'Updated ' + timeAgo(new Date(data.scrapedAt))
      : '';

    // Group entries by category: session first, then weekly
    var sessionEntries = data.entries.filter(function (e) { return e.category === 'session'; });
    var weeklyEntries = data.entries.filter(function (e) { return e.category !== 'session'; });

    var html = '';

    if (sessionEntries.length > 0) {
      html += '<div class="section">';
      html += '<div class="section-header">Plan usage limits</div>';
      html += sessionEntries.map(renderCard).join('');
      html += '</div>';
    }

    if (weeklyEntries.length > 0) {
      html += '<div class="section">';
      html += '<div class="section-header">Weekly limits</div>';
      html += weeklyEntries.map(renderCard).join('');
      html += '</div>';
    }

    if (sessionEntries.length === 0 && weeklyEntries.length === 0) {
      html = data.entries.map(renderCard).join('');
    }

    entriesEl.innerHTML = html;
  }

  function renderCard(entry) {
    var pct = clamp(entry.usagePercent, 0, 100);
    var level = getLevel(pct);
    var subtitle = entry.resetTime || entry.subtitle || '';

    // Calculate pace marker position
    var pace = calcPace(entry);
    var paceStatus = getPaceStatus(pct, pace);

    var paceMarkerHtml = '';
    if (pace !== null) {
      paceMarkerHtml = '<div class="pace-marker" style="left:' + pace + '%">' +
        '<div class="pace-line"></div>' +
        '<div class="pace-label">' + Math.round(pace) + '%</div>' +
      '</div>';
    }

    var paceTextHtml = '';
    if (pace !== null) {
      var diff = Math.round(pct - pace);
      if (diff <= 0) {
        paceTextHtml = '<span class="pace-text pace-under">Under pace by ' + Math.abs(diff) + '%</span>';
      } else {
        paceTextHtml = '<span class="pace-text pace-over">Over pace by ' + diff + '%</span>';
      }
    }

    return '<div class="usage-card">' +
      '<div class="card-header">' +
        '<span class="card-label">' + esc(entry.label || 'Usage') + '</span>' +
        '<span class="usage-percent">' + pct + '% used</span>' +
      '</div>' +
      '<div class="progress-wrapper">' +
        '<div class="progress-container">' +
          '<div class="progress-bar" style="width:' + pct + '%" data-level="' + level + '"></div>' +
        '</div>' +
        paceMarkerHtml +
      '</div>' +
      '<div class="card-footer">' +
        (subtitle ? '<span class="reset-time">' + esc(subtitle) + '</span>' : '<span></span>') +
        paceTextHtml +
      '</div>' +
    '</div>';
  }

  // Calculate the pace marker percentage for an entry
  function calcPace(entry) {
    // Session bar: fixed budget marker
    if (entry.category === 'session') {
      return SESSION_BUDGET;
    }

    // Weekly bars: time-based pacing from reset time
    if (!entry.resetTime) return null;
    var nextReset = parseResetTime(entry.resetTime);
    if (!nextReset) return null;

    // The window is 7 days. Previous reset was 7 days before next reset.
    var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    var prevReset = new Date(nextReset.getTime() - WEEK_MS);
    var now = Date.now();

    // If now is past the next reset, the data is stale — show 100% pace
    if (now >= nextReset.getTime()) return 100;
    // If now is before previous reset (shouldn't happen), show 0
    if (now <= prevReset.getTime()) return 0;

    var elapsed = now - prevReset.getTime();
    var pct = (elapsed / WEEK_MS) * 100;
    return clamp(pct, 0, 100);
  }

  // Parse "Resets Mon 3:00 AM" into the next occurrence of that day/time
  function parseResetTime(str) {
    var match = str.match(/Resets?\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    var dayNames = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    var targetDay = dayNames[match[1].toLowerCase().substring(0, 3)];
    var hours = parseInt(match[2], 10);
    var minutes = parseInt(match[3], 10);
    var ampm = match[4].toUpperCase();

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    // Find the next occurrence of this day/time
    var now = new Date();
    var candidate = new Date(now);
    candidate.setHours(hours, minutes, 0, 0);

    // Set to the target day of this week
    var diff = targetDay - candidate.getDay();
    candidate.setDate(candidate.getDate() + diff);

    // If that's in the past, move forward a week
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }

    return candidate;
  }

  function getPaceStatus(usage, pace) {
    if (pace === null) return 'unknown';
    return usage <= pace ? 'under' : 'over';
  }

  function getLevel(pct) {
    if (pct >= 90) return 'critical';
    if (pct >= 70) return 'warning';
    return 'ok';
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val || 0));
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function timeAgo(date) {
    var s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  // Theme: ?theme=light or ?theme=dark (default dark)
  var params = new URLSearchParams(window.location.search);
  var theme = params.get('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  // Initial load + periodic refresh
  (async function init() {
    var data = await fetchUsage();
    render(data);
    setInterval(async function () {
      var data = await fetchUsage();
      render(data);
    }, REFRESH_INTERVAL);
  })();
})();
