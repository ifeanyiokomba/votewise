#!/usr/bin/env bash
# VoteWise — Instant Rollback Script
#
# Switches traffic back to the previous live version. Works for both
# blue-green and canary deployments.
#
# Usage: ./scripts/rollback.sh [reason] [environment]

set -euo pipefail

REASON="${1:-manual rollback}"
ENVIRONMENT="${2:-production}"
HEALTH_URL="https://${ENVIRONMENT}.votewise.com.ng/api/pihed/health"

echo "=== VoteWise Instant Rollback ==="
echo "Reason:      $REASON"
echo "Environment: $ENVIRONMENT"
echo ""

# Determine current and previous colors
CURRENT=$(kubectl -n votewise get service votewise-app -o jsonpath='{.spec.selector.color}')
PREVIOUS=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")

if [ -z "$PREVIOUS" ] || [ "$PREVIOUS" = "$CURRENT" ]; then
  echo "✗ No previous version available for rollback."
  exit 1
fi

echo "Current: $CURRENT  →  Rolling back to: $PREVIOUS"

# Switch traffic
kubectl -n votewise patch service votewise-app -p "{\"spec\":{\"selector\":{\"color\":\"$PREVIOUS\"}}}"

# Verify
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
if [ "$STATUS" = "200" ]; then
  echo "✓ Rollback complete. Traffic now on $PREVIOUS."
  echo "  Reason recorded: $REASON"
else
  echo "✗ Rollback verification failed (HTTP $STATUS). Investigate manually."
  exit 1
fi
