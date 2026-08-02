#!/usr/bin/env bash
# VoteWise — Scheduled Backup Cron Wrapper
#
# Called by the system cron (or the scheduler microservice) on the backup
# schedule: hourly / daily / weekly / monthly. Triggers a backup via the
# PIHED API and records the result.
#
# Install in crontab:
#   5 * * * *   /home/votewise/scripts/backup-cron.sh hourly
#   0 2 * * *   /home/votewise/scripts/backup-cron.sh daily
#   0 3 * * 0   /home/votewise/scripts/backup-cron.sh weekly
#   0 4 1 * *   /home/votewise/scripts/backup-cron.sh monthly
#
# Spec: "Automatic backups. Policy: Hourly snapshots, Daily backups,
#        Weekly backups, Monthly archives. Encrypted, multi-region."

set -euo pipefail

TYPE="${1:?Usage: $0 <hourly|daily|weekly|monthly>}"
API_URL="${VOTEWISE_API_URL:-https://votewise.com.ng/api}"
AUTH_TOKEN="${BACKUP_AUTH_TOKEN:?Set BACKUP_AUTH_TOKEN env var}"

echo "[$(date -Iseconds)] Starting $TYPE backup..."

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"$TYPE\"}" \
  "$API_URL/pihed/backups/trigger")

STATUS=$(echo "$RESPONSE" | jq -r '.backup.status // "unknown"')
SIZE_MB=$(echo "$RESPONSE" | jq -r '.backup.sizeBytes // 0' | awk '{printf "%.1f", $1/1024/1024}')
LOCATION=$(echo "$RESPONSE" | jq -r '.backup.location // "?"')

if [ "$STATUS" = "COMPLETED" ]; then
  echo "[$(date -Iseconds)] ✓ $TYPE backup completed: ${SIZE_MB}MB at $LOCATION"
  logger -t votewise-backup "$TYPE backup OK: ${SIZE_MB}MB"
else
  echo "[$(date -Iseconds)] ✗ $TYPE backup FAILED: $RESPONSE"
  logger -t votewise-backup "$TYPE backup FAILED"
  # Alert via the alerting system
  curl -s -X POST \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"event\":\"backup.failed\",\"type\":\"$TYPE\",\"severity\":\"critical\"}" \
    "$API_URL/pihed/alerts/trigger" || true
  exit 1
fi
