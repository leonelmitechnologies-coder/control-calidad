# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install ALL deps including devDependencies (Vite, TypeScript, tsx needed for build)
RUN npm ci --include=dev

# Copy source
COPY . .

# Build: React frontend + TypeScript server
RUN npm run build

# ── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public

# Install only production dependencies
RUN npm ci --omit=dev

# Create uploads directory for file storage
RUN mkdir -p public/uploads

EXPOSE 3001

CMD ["node", "dist/server/index.js"]
