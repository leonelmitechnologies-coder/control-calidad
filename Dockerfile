# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Skip Puppeteer Chromium download — not used in this app
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install ALL deps including devDependencies (Vite, TypeScript, tsx needed for build)
RUN npm ci --include=dev

# Copy source
COPY . .

# Build: React frontend + TypeScript server
RUN npm run build

# ── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public

# Patch Alpine system packages and install Chromium for Puppeteer PDF generation
RUN apk upgrade --no-cache && \
    apk add --no-cache chromium

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install only production dependencies
RUN npm ci --omit=dev

# Create uploads directory for file storage
RUN mkdir -p public/uploads

EXPOSE 3001

# Copy PM2 config (pm2-runtime is in node_modules/.bin after npm ci --omit=dev)
COPY --from=builder /app/ecosystem.config.cjs ./ecosystem.config.cjs

CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.cjs"]
