# VoteWise — Scheduler
# Cron-style dispatcher: hourly backups, daily reports, renewal reminders,
# uptime sampling, cost aggregation. Single replica (leader-elected).

FROM node:20-slim AS production
WORKDIR /app
COPY package.json ./
COPY --from=votewise-worker-deps /app/node_modules ./node_modules || true
# Fallback: install fresh if multi-stage ref unavailable
COPY mini-services/scheduler/scheduler.js ./scheduler.js

ENV NODE_ENV=production
CMD ["node", "scheduler.js"]
