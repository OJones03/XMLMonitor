# ── Stage 1: Build the React app ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────
FROM node:20-alpine

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Express server
COPY server/ ./server/

# Copy built React assets from stage 1
COPY --from=builder /app/dist ./dist

# Create scans mount point and hand ownership to the app user
RUN mkdir -p /scans && chown appuser:appgroup /scans

USER appuser

EXPOSE 3001

ENV PORT=3001 \
    SCANS_DIR=/scans \
    NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
