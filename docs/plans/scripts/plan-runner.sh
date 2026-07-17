#!/bin/bash
# plan-runner.sh — Feed plan files to Claude Code sequentially
# Usage: ./docs/plans/scripts/plan-runner.sh [plans-dir]
set -euo pipefail

PLANS_DIR="${1:-docs/plans}"
QUEUE="$PLANS_DIR/queue"
ACTIVE="$PLANS_DIR/active"
DONE="$PLANS_DIR/done"
FAILED="$PLANS_DIR/failed"
LOGS="$PLANS_DIR/logs"

mkdir -p "$ACTIVE" "$DONE" "$FAILED" "$LOGS"

plan_count=$(ls "$QUEUE"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$plan_count" -eq 0 ]; then
  echo "No plans in queue ($QUEUE/). Nothing to do."
  exit 0
fi

echo "=== Plan Queue Runner ==="
echo "Found $plan_count plan(s) in queue"
echo ""

completed=0
failed_count=0

for plan_file in $(ls "$QUEUE"/*.md 2>/dev/null | sort); do
  plan_name=$(basename "$plan_file" .md)
  plan_basename=$(basename "$plan_file")
  active_file="$ACTIVE/$plan_basename"
  timestamp=$(date +%Y%m%d-%H%M%S)
  log_file="$LOGS/${plan_name}-${timestamp}.json"

  echo "--- Starting: $plan_name ---"
  echo "  Log: $log_file"

  # Move to active
  mv "$plan_file" "$active_file"

  if claude -p "Execute this implementation plan completely. Follow each phase in order. Check off each step as you complete it. If you hit a blocker you cannot resolve, explain what blocked you and stop.

$(cat "$active_file")" \
    --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
    --output-format json > "$log_file" 2>&1; then
    mv "$active_file" "$DONE/"
    completed=$((completed + 1))
    echo "--- Completed: $plan_name ---"
  else
    mv "$active_file" "$FAILED/"
    failed_count=$((failed_count + 1))
    echo "--- FAILED: $plan_name (see $log_file) ---"
  fi
  echo ""
done

echo "=== Queue Complete ==="
echo "  Completed: $completed"
echo "  Failed: $failed_count"
echo "  Logs: $LOGS/"
