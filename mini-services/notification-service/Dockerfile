# VoteWise — Notification Service
# Dedicated delivery microservice for email/SMS/WhatsApp with automatic
# channel fallback (WhatsApp → SMS → Email). Scales independently of the
# app during notification bursts (election day reminders).

FROM node:20-slim AS production
WORKDIR /app
COPY package.json ./
COPY mini-services/notification-service/notification.js ./notification.js
ENV NODE_ENV=production
CMD ["node", "notification.js"]
