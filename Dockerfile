# ── Stage 1: Install dependencies ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the web workspace ───────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (override via docker-compose or --build-arg)
ARG NEXT_PUBLIC_API_BASE_URL=https://api.smrestoration.com
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build --workspace @smsystem/web

# ── Stage 3: Production runner ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Keep runtime simple and stable for monorepo workspace layout.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web

USER nextjs
WORKDIR /app/apps/web

EXPOSE 3000

CMD ["../../node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
