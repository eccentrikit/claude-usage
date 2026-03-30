(async function scrapeUsage() {
  'use strict';

  var container = await waitForContent(15000);
  if (!container) {
    chrome.runtime.sendMessage({ type: 'SCRAPE_ERROR', error: 'Usage content not found after 15s' });
    return;
  }

  var data = extractUsageData(container);
  chrome.runtime.sendMessage({ type: 'USAGE_DATA', data: data });
})();

function waitForContent(timeout) {
  return new Promise(function (resolve) {
    var start = Date.now();
    function check() {
      // Look for percentage text anywhere on page — sign the usage data has rendered
      var candidates = document.querySelectorAll('main, [role="main"]');
      for (var i = 0; i < candidates.length; i++) {
        if (/\d+%\s*used/.test(candidates[i].textContent)) {
          return resolve(candidates[i]);
        }
      }
      if (document.body && /\d+%\s*used/.test(document.body.textContent)) {
        return resolve(document.body);
      }
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, 500);
    }
    check();
  });
}

function extractUsageData(container) {
  var result = {
    scrapedAt: new Date().toISOString(),
    planTier: null,
    entries: [],
    rawHtml: container.innerHTML.substring(0, 50000)
  };

  // Extract plan tier from page
  var allText = container.textContent;
  var planMatch = allText.match(/\b(Free|Pro|Team|Max\s*5|Max\s*20|Max|Enterprise)\b/i);
  if (planMatch) {
    result.planTier = planMatch[1].trim();
  }

  // Find all "X% used" text nodes, then walk up to find their containing section
  var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  var usedNodes = [];
  var node;
  while (node = walker.nextNode()) {
    if (/\d+%\s*used/.test(node.textContent)) {
      usedNodes.push(node);
    }
  }

  for (var i = 0; i < usedNodes.length; i++) {
    var entry = parseUsageSection(usedNodes[i]);
    if (entry) {
      result.entries.push(entry);
    }
  }

  // Deduplicate by label
  var seen = {};
  result.entries = result.entries.filter(function (e) {
    if (seen[e.label]) return false;
    seen[e.label] = true;
    return true;
  });

  return result;
}

function parseUsageSection(usedTextNode) {
  // Walk up from the "X% used" text node to find the section container
  // that holds the label, subtitle, reset time, and progress bar
  var section = findSectionContainer(usedTextNode);
  if (!section) return null;

  var text = section.textContent;

  // Extract percentage from "X% used"
  var pctMatch = text.match(/(\d+)%\s*used/);
  if (!pctMatch) return null;
  var usagePercent = parseInt(pctMatch[1], 10);

  // Determine the label: "Current session", "All models", "Sonnet only", etc.
  var label = extractLabel(text);

  // Determine the category: session vs weekly
  var category = 'weekly';
  if (/current\s*session/i.test(text) || /starts\s*when/i.test(text)) {
    category = 'session';
  }

  // Extract reset time: "Resets Mon 3:00 AM", "Resets in 3 hours", etc.
  var resetTime = null;
  var resetMatch = text.match(/Resets?\s+([A-Za-z0-9:, ]+(?:AM|PM|am|pm))/);
  if (resetMatch) {
    resetTime = 'Resets ' + resetMatch[1].trim();
  } else {
    var resetMatch2 = text.match(/Resets?\s+in\s+(?:\d+\s*(?:hours?|hr)\s*)?(?:\d+\s*min(?:utes?)?)?/i);
    if (resetMatch2) {
      resetTime = resetMatch2[0].trim();
    }
  }

  // Extract subtitle: "Starts when a message is sent", etc.
  var subtitle = null;
  if (/Starts\s+when\s+a\s+message\s+is\s+sent/i.test(text)) {
    subtitle = 'Starts when a message is sent';
  }

  return {
    label: label,
    category: category,
    usagePercent: usagePercent,
    usageLabel: usagePercent + '% used',
    resetTime: resetTime,
    subtitle: subtitle
  };
}

function extractLabel(text) {
  // Match known labels from the usage page
  if (/Current\s+session/i.test(text)) return 'Current session';
  if (/All\s+models/i.test(text)) return 'All models';
  if (/Sonnet\s+only/i.test(text)) return 'Sonnet only';
  if (/Opus\s+only/i.test(text)) return 'Opus only';
  if (/Haiku\s+only/i.test(text)) return 'Haiku only';

  // Fallback: grab first short line of text that isn't the percentage or reset
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.length > 2 && line.length < 30 && !/\d+%/.test(line) && !/Reset/i.test(line) && !/Learn more/i.test(line) && !/Starts when/i.test(line)) {
      return line;
    }
  }
  return 'Usage';
}

function findSectionContainer(node) {
  // Walk up from the "X% used" text node until we find a container
  // that has the label text AND the percentage — typically a div
  // wrapping one usage row (label + bar + percentage)
  var el = node.parentElement;
  var depth = 0;

  while (el && el !== document.body && depth < 15) {
    var text = el.textContent || '';
    // A good section container has: a label + "X% used" but NOT multiple "X% used"
    var usedMatches = text.match(/\d+%\s*used/g);
    if (usedMatches && usedMatches.length === 1 && text.length > 10) {
      return el;
    }
    el = el.parentElement;
    depth++;
  }

  // Fallback: if we couldn't isolate a single-entry section,
  // just use the nearest ancestor with some structure
  el = node.parentElement;
  depth = 0;
  while (el && el !== document.body && depth < 8) {
    if (el.children && el.children.length >= 2) {
      return el;
    }
    el = el.parentElement;
    depth++;
  }
  return el;
}
