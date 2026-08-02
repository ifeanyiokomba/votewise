# VoteWise — Analytics Engine
# Dedicated microservice for RAEI report generation, historical aggregation,
# and AI insight generation. Heavy CPU work that must never slow down voting.

FROM node:20-slim AS production
WORKDIR /app
COPY package.json ./
COPY mini-services/analytics-engine/analytics-engine.js ./analytics-engine.js
ENV NODE_ENV=production
CMD ["node", "analytics-engine.js"]
