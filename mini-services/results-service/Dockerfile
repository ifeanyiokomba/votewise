# VoteWise — Results Service Dockerfile
FROM node:20-slim
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Install Prisma client (shared from main project)
COPY --from=votewise-app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=votewise-app /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3030

CMD ["bun", "run", "dev"]
