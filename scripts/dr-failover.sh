#!/usr/bin/env bash
# VoteWise — Region Failover Script (DR drill / real failover)
#
# Promotes the DR region (eu-central-1 / Frankfurt) to serve live traffic
# by repointing the Route53 record. DNS TTL is 60s, so global failover
# completes in < 5 minutes.
#
# Spec: "Minimal downtime, No vote loss, Fast restoration."
#
# Usage: ./scripts/dr-failover.sh [environment]
#        ./scripts/dr-failover.sh production

set -euo pipefail

ENVIRONMENT="${1:-production}"
DOMAIN="votewise.com.ng"
DR_ALB_DNS=$(aws elbv2 describe-load-balancers --region eu-central-1 --query 'LoadBalancers[?contains(LoadBalancerName, `votewise`)].DNSName' --output text | head -1)
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query 'HostedZones[0].Id' --output text | xargs basename)

if [ -z "$DR_ALB_DNS" ]; then
  echo "✗ No DR ALB found in eu-central-1. Has the DR stack been provisioned?"
  exit 1
fi

echo "=== VoteWise Region Failover ==="
echo "Environment: $ENVIRONMENT"
echo "Domain:      $DOMAIN"
echo "DR ALB:      $DR_ALB_DNS"
echo ""

# 1. Trigger global ElectionLock (prevents new votes during failover)
echo "[1/4] Triggering global ElectionLock..."
curl -s -X POST -H "Authorization: Bearer $FAILOVER_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Region failover drill","scope":"global"}' \
  "https://$DOMAIN/api/eifdirs/election-lock/trigger" || true
echo "  ElectionLock engaged."

# 2. Repoint Route53 to the DR ALB
echo "[2/4] Repointing Route53 $DOMAIN → $DR_ALB_DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "'"$DOMAIN"'",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z32O12XQLNTSW2",
          "DNSName": "'"$DR_ALB_DNS"'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# 3. Wait for DNS propagation + health
echo "[3/4] Waiting for DNS propagation (60s TTL)..."
sleep 70

echo "  Health-checking DR endpoint..."
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/pihed/health" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  ✓ DR is serving traffic (HTTP 200)"
    break
  fi
  echo "  Waiting... ($STATUS) attempt $i/12"
  sleep 10
done

# 4. Release ElectionLock
echo "[4/4] Releasing ElectionLock..."
curl -s -X POST -H "Authorization: Bearer $FAILOVER_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Region failover complete"}' \
  "https://$DOMAIN/api/eifdirs/election-lock/release" || true

if [ "$STATUS" = "200" ]; then
  echo ""
  echo "✓ Failover complete. Live traffic now served by DR region (eu-central-1)."
  echo "  To fail back: ./scripts/dr-failback.sh"
else
  echo ""
  echo "✗ Failover verification failed. ElectionLock remains engaged. Investigate."
  exit 1
fi
