# ── Server image (Node.js API + Socket.IO) ──
# Multi-stage: install production deps once, run as non-root.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Workspace lockfile lives at repo root, so install (not ci) inside this context.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# dumb-init for correct signal handling (graceful shutdown)
RUN apk add --no-cache dumb-init wget

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Run as an unprivileged user
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/ready || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
