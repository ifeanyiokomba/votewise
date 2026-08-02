# VoteWise — Fraud Engine
# Dedicated microservice for the EIFDIRS detectors, risk scorer, and
# incident manager. Continuously evaluates integrity events and raises
# fraud incidents when thresholds are crossed.

FROM node:20-slim AS production
WORKDIR /app
COPY package.json ./
COPY mini-services/fraud-engine/fraud-engine.js ./fraud-engine.js
ENV NODE_ENV=production
CMD ["node", "fraud-engine.js"]
