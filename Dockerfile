# VoteWise — Production Dockerfile (multi-stage build)
# Optimized for Next.js 16 with standalone output

# ---- Stage 1: Dependencies ----
FROM node:20-slim AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* yarn.lock* package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (use npm for compatibility)
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# ---- Stage 2: Build ----
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app
RUN npx next build

# ---- Stage 3: Production ----
FROM node:20-slim AS production
WORKDIR /app

# Install only production dependencies
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy mini-service
COPY mini-services/results-service ./mini-services/results-service

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000

CMD ["node", "server.js"]
