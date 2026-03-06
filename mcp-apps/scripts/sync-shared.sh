#!/usr/bin/env bash
# Sync mcp_shared/ from root to all app directories.
# Run after editing any file in mcp_shared/ to prevent drift.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/mcp_shared"

if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC not found"
  exit 1
fi

APPS=(
  mcp-web-crawler
  mcp-structured-extractor
  mcp-document-parser
  mcp-knowledge-graph
  mcp-embedding-service
  mcp-deduplication
  mcp-llm-router
  mcp-message-bus
  mcp-webhook-relay
  mcp-audit-logger
  mcp-budget-tracker
)

for app in "${APPS[@]}"; do
  dest="$ROOT/$app/mcp_shared"
  if [ -d "$dest" ]; then
    rsync -a --delete "$SRC/" "$dest/"
    echo "Synced -> $app/mcp_shared/"
  fi
done

echo "Done."
