#!/bin/bash
set -euo pipefail

PLIST_NAME="com.trey.system-monitor.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
UID_NUM="$(id -u)"

echo "=== system-monitor uninstall ==="

# 1. Unload the agent
launchctl bootout "gui/$UID_NUM/$PLIST_NAME" 2>/dev/null || true

# 2. Remove the plist
rm -f "$PLIST_DST"

echo "Unloaded and removed."
echo "Logs and history preserved in project logs/ directory."
