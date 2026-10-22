# Multi-stage Dockerfile for MailSentinel
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src

# Install dependencies and build both client & server
RUN npm ci
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy package manifests and production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create data directory for persistent database
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3001

CMD ["node", "dist/server/index.js"]
