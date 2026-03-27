document.addEventListener('DOMContentLoaded', function () {
  // Load config and status
  chrome.storage.local.get({
    apiEndpoint: '',
    apiKey: '',
    scrapeIntervalMinutes: 15,
    lastSync: null,
    lastError: null,
    lastData: null
  }, function (cfg) {
    document.getElementById('cfg-endpoint').value = cfg.apiEndpoint;
    document.getElementById('cfg-key').value = cfg.apiKey;
    document.getElementById('cfg-interval').value = cfg.scrapeIntervalMinutes;
    updateStatus(cfg);
  });

  // Save config
  document.getElementById('btn-save').addEventListener('click', function () {
    var config = {
      apiEndpoint: document.getElementById('cfg-endpoint').value.replace(/\/+$/, ''),
      apiKey: document.getElementById('cfg-key').value,
      scrapeIntervalMinutes: parseInt(document.getElementById('cfg-interval').value) || 15
    };
    chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: config }, function () {
      var msg = document.getElementById('save-msg');
      msg.classList.remove('hidden');
      setTimeout(function () { msg.classList.add('hidden'); }, 2000);
    });
  });

  // Scrape now
  document.getElementById('btn-scrape').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }, function () {
      var btn = document.getElementById('btn-scrape');
      btn.textContent = 'Triggered!';
      setTimeout(function () { btn.textContent = 'Scrape Now'; }, 2000);
    });
  });

  // Auto-refresh popup when storage changes (after scrape completes)
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local') {
      chrome.storage.local.get({
        lastSync: null,
        lastError: null,
        lastData: null
      }, function (cfg) {
        updateStatus(cfg);
      });
    }
  });
});

function updateStatus(cfg) {
  var dot = document.getElementById('status-dot');
  var text = document.getElementById('status-text');
  var syncTime = document.getElementById('sync-time');
  var errorBox = document.getElementById('error-box');
  var preview = document.getElementById('preview');
  var previewEntries = document.getElementById('preview-entries');

  if (cfg.lastError) {
    dot.className = 'dot error';
    text.textContent = 'Error';
    errorBox.textContent = cfg.lastError;
    errorBox.classList.remove('hidden');
  } else if (cfg.lastSync) {
    dot.className = 'dot ok';
    text.textContent = 'Connected';
  } else {
    dot.className = 'dot idle';
    text.textContent = 'Not synced yet';
  }

  if (cfg.lastSync) {
    syncTime.textContent = new Date(cfg.lastSync).toLocaleString();
  }

  if (cfg.lastData && cfg.lastData.entries && cfg.lastData.entries.length > 0) {
    preview.classList.remove('hidden');
    previewEntries.innerHTML = cfg.lastData.entries.map(function (e) {
      return '<div class="preview-row">' +
        '<span class="preview-label">' + esc(e.label || e.modelName || 'Unknown') + '</span>' +
        '<span class="preview-pct">' + (e.usagePercent != null ? e.usagePercent + '%' : '?') + '</span>' +
      '</div>';
    }).join('');
  }
}

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
