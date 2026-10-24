# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install system dependencies needed for native modules like argon2
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Stage 1: Dependencies & Build
FROM base AS builder

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package
RUN npm run build --workspace=@geminihub/shared

# Generate Prisma Client & compile API
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 geminihub

# Copy production node_modules and built output
COPY --from=builder --chown=geminihub:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=geminihub:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=geminihub:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=geminihub:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=geminihub:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=geminihub:nodejs /app/apps/api/package.json ./apps/api/package.json

USER geminihub

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]

