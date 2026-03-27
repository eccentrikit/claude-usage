chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'USAGE_DATA') {
    handleUsageData(message.data);
    sendResponse({ status: 'received' });
  } else if (message.type === 'SCRAPE_ERROR') {
    chrome.storage.local.set({ lastError: message.error, lastErrorTime: new Date().toISOString() });
    sendResponse({ status: 'error_logged' });
  } else if (message.type === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  } else if (message.type === 'TRIGGER_SCRAPE') {
    triggerScrape();
    sendResponse({ status: 'triggered' });
  } else if (message.type === 'SAVE_CONFIG') {
    chrome.storage.local.set(message.config, function () {
      // Recreate alarm with new interval
      chrome.alarms.create('scrape-usage', {
        periodInMinutes: message.config.scrapeIntervalMinutes || 15
      });
      sendResponse({ status: 'saved' });
    });
    return true;
  }
});

async function handleUsageData(data) {
  var config = await getConfig();
  if (!config.apiEndpoint || !config.apiKey) {
    chrome.storage.local.set({
      lastError: 'API endpoint or key not configured. Open the extension popup to set them.',
      lastData: data
    });
    return;
  }

  try {
    var response = await fetch(config.apiEndpoint + '/api/usage/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      var errBody = await response.text();
      throw new Error('HTTP ' + response.status + ': ' + errBody);
    }

    chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      lastData: data,
      lastError: null
    });
  } catch (err) {
    chrome.storage.local.set({
      lastError: err.message,
      lastErrorTime: new Date().toISOString(),
      lastData: data
    });
  }
}

function getConfig() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(
      { apiEndpoint: '', apiKey: '', scrapeIntervalMinutes: 15 },
      resolve
    );
  });
}

function getStatus() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(
      ['lastSync', 'lastError', 'lastErrorTime', 'lastData'],
      resolve
    );
  });
}

async function triggerScrape() {
  var tabs = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage*' });
  if (tabs.length > 0) {
    var tabId = tabs[0].id;
    // Reload the tab first so the page fetches fresh usage data
    await chrome.tabs.reload(tabId);
    // Wait for the page to finish loading before injecting
    await waitForTabLoad(tabId);
    // Small extra delay for React to render
    await sleep(2000);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  } else {
    // No usage tab open — create one in the background
    var tab = await chrome.tabs.create({
      url: 'https://claude.ai/settings/usage',
      active: false
    });
    await waitForTabLoad(tab.id);
    await sleep(3000);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
}

function waitForTabLoad(tabId) {
  return new Promise(function (resolve) {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout after 15s in case the event never fires
    setTimeout(function () {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Set up periodic scraping alarm
chrome.runtime.onInstalled.addListener(async function () {
  var config = await getConfig();
  chrome.alarms.create('scrape-usage', {
    periodInMinutes: config.scrapeIntervalMinutes
  });
});

chrome.runtime.onStartup.addListener(async function () {
  var config = await getConfig();
  chrome.alarms.create('scrape-usage', {
    periodInMinutes: config.scrapeIntervalMinutes
  });
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === 'scrape-usage') {
    triggerScrape();
  }
});
