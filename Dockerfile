# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Skip Puppeteer Chromium download — prod uses the system Chromium (see runner stage)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Enable Corepack + pin pnpm (fleet standard)
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# Copy dependency manifests first for better layer caching.
# pnpm-workspace.yaml carries the supply-chain guard (allowBuilds/overrides) and
# MUST be present so `pnpm install` applies the same policy as the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install ALL deps including devDependencies (Vite, TypeScript, tsx needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build: React frontend (vite) + TypeScript server (tsc)
RUN pnpm run build

# ── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Enable Corepack + pin pnpm (fleet standard)
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# Copy built artifacts + manifests from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/public ./public

# Patch Alpine system packages and install Chromium for Puppeteer PDF generation
RUN apk upgrade --no-cache && \
    apk add --no-cache chromium

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install only production dependencies (frozen against the committed lockfile)
RUN pnpm install --prod --frozen-lockfile

# Create uploads directory for file storage
RUN mkdir -p public/uploads

EXPOSE 3001

# Copy PM2 config (pm2-runtime is in node_modules/.bin after the prod install)
COPY --from=builder /app/ecosystem.config.cjs ./ecosystem.config.cjs

CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.cjs"]
