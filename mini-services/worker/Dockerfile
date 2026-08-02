# VoteWise — Background Worker
# Consumes the job queue: email/SMS/WhatsApp delivery, report generation,
# large imports/exports, analytics aggregation. Long-running jobs NEVER
# block the web request path.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json bun.lockb* package-lock.json* ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps && npx prisma generate

FROM node:20-slim AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json ./
COPY mini-services/worker/worker.js ./worker.js
COPY src/lib/jobs.ts ./src/lib/jobs.ts
COPY src/lib/db.ts ./src/lib/db.ts
COPY src/lib/pihed ./src/lib/pihed
COPY src/lib/cnse ./src/lib/cnse
COPY src/lib/election ./src/lib/election
COPY src/lib/auth.ts ./src/lib/auth.ts
COPY src/lib/secrets.ts ./src/lib/secrets.ts

ENV NODE_ENV=production
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["node", "worker.js"]
