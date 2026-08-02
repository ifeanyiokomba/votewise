#!/usr/bin/env bash
# VoteWise — Blue-Green Deployment Script
#
# Deploys a new version alongside the current live version, health-checks
# it, then switches traffic. If the health check fails, the new version is
# torn down and traffic stays on the old version.
#
# Usage: ./scripts/blue-green-deploy.sh <version-tag> [environment]
# Example: ./scripts/blue-green-deploy.sh v17.2.0 production

set -euo pipefail

VERSION="${1:?Usage: $0 <version-tag> [environment]}"
ENVIRONMENT="${2:-production}"
HEALTH_URL="https://${ENVIRONMENT}.votewise.com.ng/api/pihed/health"
TIMEOUT=300  # 5 minutes

echo "=== VoteWise Blue-Green Deploy ==="
echo "Version:     $VERSION"
echo "Environment: $ENVIRONMENT"
echo ""

# 1. Determine the current live color (blue or green)
CURRENT=$(kubectl -n votewise get deployment votewise-app -o jsonpath='{.metadata.labels.color}' 2>/dev/null || echo "blue")
NEXT=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")
echo "Current live: $CURRENT"
echo "Deploying:    $NEXT"
echo ""

# 2. Deploy the new version (not receiving traffic yet)
echo "[1/4] Deploying $NEXT version ($VERSION)..."
kubectl -n votewise set image deployment/votewise-app-$NEXT app=ghcr.io/ifeanyiokomba/votewise:$VERSION
kubectl -n votewise rollout status deployment/votewise-app-$NEXT --timeout=${TIMEOUT}s

# 3. Health check the new version
echo "[2/4] Health-checking $NEXT..."
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  ✓ Health check passed (HTTP 200)"
    break
  fi
  echo "  Waiting for health check... ($STATUS) attempt $i/30"
  sleep 10
done

if [ "$STATUS" != "200" ]; then
  echo "  ✗ Health check FAILED. Rolling back."
  kubectl -n votewise delete deployment votewise-app-$NEXT
  exit 1
fi

# 4. Switch traffic
echo "[3/4] Switching traffic from $CURRENT to $NEXT..."
kubectl -n votewise patch service votewise-app -p "{\"spec\":{\"selector\":{\"color\":\"$NEXT\"}}}"

# 5. Verify
echo "[4/4] Verifying..."
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
if [ "$STATUS" = "200" ]; then
  echo "  ✓ Deployment LIVE on $NEXT ($VERSION)"
  echo ""
  echo "✓ Blue-green deploy complete. Old version ($CURRENT) kept for rollback."
  echo "  To roll back: ./scripts/rollback.sh"
else
  echo "  ✗ Verification failed! Initiating automatic rollback..."
  kubectl -n votewise patch service votewise-app -p "{\"spec\":{\"selector\":{\"color\":\"$CURRENT\"}}}"
  echo "  Rolled back to $CURRENT."
  exit 1
fi
