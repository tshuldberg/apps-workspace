#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.trey.system-monitor.plist"
PLIST_SRC="$PROJECT_DIR/launchd/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
NODE_PATH="$(which node)"
UID_NUM="$(id -u)"

echo "=== system-monitor install ==="
echo "Project:  $PROJECT_DIR"
echo "Node:     $NODE_PATH"
echo "Plist:    $PLIST_DST"

# 1. Build TypeScript
echo ""
echo "Building TypeScript..."
cd "$PROJECT_DIR" && npm run build

# 2. Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# 3. Generate plist with correct node path
sed "s|/opt/homebrew/bin/node|$NODE_PATH|g" "$PLIST_SRC" > "$PLIST_DST"

# 4. Unload if already loaded (ignore errors)
launchctl bootout "gui/$UID_NUM/$PLIST_NAME" 2>/dev/null || true

# 5. Load the agent
launchctl bootstrap "gui/$UID_NUM" "$PLIST_DST"

echo ""
echo "Installed and started!"
echo ""
echo "Check status:"
echo "  launchctl print gui/$UID_NUM/$PLIST_NAME"
echo ""
echo "View logs:"
echo "  tail -f $PROJECT_DIR/logs/daemon-stderr.log"
echo ""
echo "Uninstall:"
echo "  npm run uninstall-daemon"
