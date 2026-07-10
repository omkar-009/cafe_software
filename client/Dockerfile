# ── Client image (React build → NGINX static) ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Workspace lockfile lives at repo root, so install (not ci) inside this context.
RUN npm install --no-audit --no-fund
COPY . .
# Build-time API base is empty → same-origin (edge/nginx proxies /api).
RUN npm run build

FROM nginx:1.27-alpine AS runner
# SPA + API/WebSocket proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
