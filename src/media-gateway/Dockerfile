# ==============================================================================
# SMRKOMED EXOTEL AGENTSTREAM MEDIA GATEWAY DOCKERFILE
# ==============================================================================
# Dedicated persistent Node.js container for real-time bidirectional WebSocket
# audio streaming with Exotel Voicebot / AgentStream.
# Deploy to AWS ECS, Fly.io, Railway, or DigitalOcean App Platform.
# ==============================================================================

FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for container health check probe
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV VOICE_GATEWAY_PORT=8080
ENV VOICE_GATEWAY_HOST=0.0.0.0

# 1. Copy package definitions and Prisma schema BEFORE installing dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 2. Install production dependencies with --ignore-scripts to prevent premature postinstall.
#    Then install tsx and prisma CLI required for execution and Prisma Client generation.
RUN npm ci --omit=dev --ignore-scripts && \
    npm install tsx prisma && \
    npx prisma generate && \
    npm cache clean --force

# 3. Copy application source, TypeScript configuration, and runtime assets
COPY tsconfig.json ./
COPY src/media-gateway ./src/media-gateway
COPY src/lib/config ./src/lib/config
COPY src/types ./src/types

EXPOSE 8080

# Container healthcheck probe respecting dynamic PORT environment variable
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

CMD ["npx", "tsx", "src/media-gateway/server.ts"]
