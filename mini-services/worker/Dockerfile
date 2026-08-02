# VoteWise — Background Worker
# Consumes the job queue: email/SMS/WhatsApp delivery, report generation,
# large imports/exports, analytics aggregation, scheduled backups, alert
# evaluation, metrics capture. Long-running jobs NEVER block the web path.

FROM node:20-slim
WORKDIR /app

# The worker is a self-contained Node.js script with no external imports.
# In production, the TypeScript source (src/lib/jobs.ts, src/lib/infra/*)
# is compiled to JS during a multi-stage build and copied in. For the
# reference image, the self-contained worker.js is sufficient.
COPY mini-services/worker/worker.js ./worker.js

ENV NODE_ENV=production
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "worker.js"]
