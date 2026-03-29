#!/usr/bin/env python3
# <xbar.title>Claude Usage</xbar.title>
# <xbar.desc>Shows Claude AI usage stats from your dashboard</xbar.desc>
# <xbar.version>1.0</xbar.version>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>

import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone

# Change this to your server URL
API_URL = "https://your-server.example.com/api/usage/"

DAY_NAMES = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def fetch_usage():
    try:
        req = urllib.request.Request(API_URL, headers={"User-Agent": "ClaudeUsageMenuBar/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def parse_reset_time(reset_str):
    if not reset_str:
        return None

    # Format 1: "Resets in X hours", "Resets in 23 hr", etc.
    m_relative = re.match(
        r"Resets?\s+in\s+(\d+)\s*(?:hours?|hr)",
        reset_str,
        re.I,
    )
    if m_relative:
        hours = int(m_relative.group(1))
        return datetime.now() + timedelta(hours=hours)

    # Format 2: "Resets Monday 2:59 AM"
    m = re.match(
        r"Resets?\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(\d{1,2}):(\d{2})\s*(AM|PM)",
        reset_str,
        re.I,
    )
    if not m:
        return None
    target_day = DAY_NAMES[m.group(1).lower()[:3]]
    hours = int(m.group(2))
    minutes = int(m.group(3))
    ampm = m.group(4).upper()
    if ampm == "PM" and hours != 12:
        hours += 12
    if ampm == "AM" and hours == 12:
        hours = 0
    now = datetime.now()
    candidate = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    diff = target_day - candidate.weekday()
    candidate += timedelta(days=diff)
    if candidate <= now:
        candidate += timedelta(days=7)
    return candidate


def time_until(dt):
    if not dt:
        return ""
    delta = dt - datetime.now()
    if delta.total_seconds() < 0:
        return "now"
    hours = int(delta.total_seconds() // 3600)
    minutes = int((delta.total_seconds() % 3600) // 60)
    if hours >= 24:
        days = hours // 24
        hours = hours % 24
        return f"{days}d {hours}h"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def calc_pace(entry):
    if entry.get("category") == "session":
        return 80.0
    reset_str = entry.get("resetTime")
    if not reset_str:
        return None
    next_reset = parse_reset_time(reset_str)
    if not next_reset:
        return None
    week = timedelta(days=7)
    prev_reset = next_reset - week
    now = datetime.now()
    if now >= next_reset:
        return 100.0
    if now <= prev_reset:
        return 0.0
    elapsed = (now - prev_reset).total_seconds()
    total = week.total_seconds()
    return round((elapsed / total) * 100, 1)


def bar_chart(pct, width=20):
    filled = int(round(pct / 100 * width))
    return "\u2588" * filled + "\u2591" * (width - filled)


def color_for_pct(pct):
    if pct >= 90:
        return "#ef4444"
    if pct >= 70:
        return "#f59e0b"
    return "#6b9eff"


def main():
    data = fetch_usage()

    if not data or not data.get("entries"):
        print("Claude: --")
        print("---")
        print("No usage data | color=gray")
        print("Refresh | refresh=true")
        return

    entries = data["entries"]

    # Find "All models" for menu bar display, fallback to first weekly
    weekly = [e for e in entries if e.get("category") != "session"]
    display_entry = weekly[0] if weekly else entries[0]
    display_pct = int(display_entry.get("usagePercent", 0))
    pace = calc_pace(display_entry)
    color = color_for_pct(display_pct)

    # Menu bar title
    if pace is not None:
        diff = round(display_pct - pace)
        sign = "+" if diff > 0 else ""
        print(f"{display_pct}%{sign}{diff}% | color={color}")
    else:
        print(f"{display_pct}% | color={color}")
    print("---")

    # Plan tier
    if data.get("planTier"):
        print(f"{data['planTier']} Plan | size=11 color=gray")
        print("---")

    for entry in entries:
        label = entry.get("label", "Usage")
        pct = entry.get("usagePercent", 0)
        reset_str = entry.get("resetTime") or entry.get("subtitle") or ""
        pct_color = color_for_pct(pct)

        print(f"{label} \u2014 {pct}% | color={pct_color} size=14")
        print(f"{bar_chart(pct)} | font=Menlo size=11")

        # Pace info
        pace = calc_pace(entry)
        if pace is not None:
            diff = round(pct - pace)
            if diff <= 0:
                print(f"Under pace by {abs(diff)}% | color=#22c55e size=11")
            else:
                print(f"Over pace by {diff}% | color=#f59e0b size=11")

        # Reset / subtitle
        if entry.get("resetTime"):
            next_reset = parse_reset_time(entry["resetTime"])
            remaining = time_until(next_reset)
            print(f"{reset_str} ({remaining} left) | color=gray size=11")
        elif reset_str:
            print(f"{reset_str} | color=gray size=11")

        print("---")

    # Last updated
    if data.get("scrapedAt"):
        try:
            scraped = datetime.fromisoformat(data["scrapedAt"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            ago = int((now - scraped).total_seconds() // 60)
            if ago < 1:
                print("Updated just now | color=gray size=11")
            else:
                print(f"Updated {ago}m ago | color=gray size=11")
        except Exception:
            pass

    print("---")
    print(f"Open Dashboard | href={API_URL.rsplit('/api/', 1)[0]}/embed/")
    print("Refresh | refresh=true")


if __name__ == "__main__":
    main()
