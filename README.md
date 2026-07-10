# 🍽️ RestroSaaS — Restaurant Management SaaS Platform

Multi-tenant Restaurant Management Software: **QR Ordering · Kitchen Display (KDS) · Waiter · Billing · Analytics**.

Built to be sold as SaaS to thousands of restaurants — isolated tenant data, role-based access, real-time updates, audit logging, and subscription-ready architecture.

---

## 🧱 Tech Stack

| Layer        | Technology                                        |
|--------------|---------------------------------------------------|
| Frontend     | React 18 (Vite) + Tailwind CSS + Framer Motion    |
| Backend      | Node.js + Express + PostgreSQL                     |
| Real-time    | Socket.IO (WebSocket, long-polling fallback)      |
| Storage      | Supabase Storage                                  |
| Auth         | JWT (access + refresh) via HTTP-only cookies      |
| Infra        | Docker · Docker Compose · NGINX · GitHub Actions  |

---

## 🗂️ Monorepo Layout

```
cafe_software/
├── server/                 # Node.js API + WebSocket
│   ├── src/
│   │   ├── config/         # env, database pool, logger
│   │   ├── db/             # migrations + seeds + migrate runner
│   │   ├── middleware/     # auth, tenant isolation, rbac, audit, errors
│   │   ├── modules/        # feature modules (auth, menu, orders, ...)
│   │   │   └── <feature>/  # controller · service · repository · routes · validators
│   │   ├── realtime/       # Socket.IO gateway + tenant rooms
│   │   ├── shared/         # ApiError, ApiResponse, pagination, constants
│   │   └── app.js / server.js
│   └── Dockerfile
├── client/                 # React (Vite) frontend
├── nginx/                  # reverse proxy config
├── .github/workflows/      # CI/CD
├── docker-compose.yml      # local dev (Postgres + api + client)
└── docker-compose.prod.yml # production
```

Each backend feature follows a **layered architecture**:

```
routes → validators → controller → service → repository → database
                                    (business)  (data access)
```

---

## 🏢 Multi-Tenancy

- Every domain row carries a `tenant_id`.
- Isolation is enforced at the **middleware layer** (`tenantContext`) — a request can never read/write another tenant's data.
- Super Admin operates above tenants (platform scope).

---

## 👥 Roles

`SUPER_ADMIN` · `RESTAURANT_ADMIN` · `KITCHEN` · `WAITER` · `CUSTOMER`

Permissions are RBAC-driven and checked per route.

---

## 🚀 Getting Started (Local Dev)

> Prerequisites: Node.js ≥ 20, Docker Desktop.

```bash
# 1. Clone & install
npm install                 # root (workspaces installs server + client)

# 2. Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# (fill in DB + JWT + Supabase credentials)

# 3. Start Postgres (via Docker)
docker compose up -d postgres

# 4. Run DB migrations + seed a demo tenant
npm run db:migrate --workspace server
npm run db:seed --workspace server

# 5. Start API + client (two terminals or use root script)
npm run dev
```

- API:      http://localhost:4000/api/v1
- Health:   http://localhost:4000/health
- Client:   http://localhost:5173

Full one-command stack:

```bash
docker compose up --build
```

---

## 🔐 Security Baseline

Helmet · CORS allow-list · rate limiting · CSRF (double-submit) · input validation (Zod) · bcrypt password hashing · HTTP-only + Secure cookies · SQL via parameterized queries.

---

## 📦 Environment Variables

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). Credentials are injected at runtime — never committed.

---

## 🐳 Deployment

### Local full stack (Docker)
```bash
docker compose up --build            # postgres + api + client(nginx)
# API auto-runs migrations + seed on boot
```
- App:    http://localhost:5173  (NGINX serves the SPA + proxies `/api` and `/socket.io`)
- API:    http://localhost:4000/api/v1

### Production
```bash
cp .env.prod.example .env.prod       # fill in real secrets (DB, JWT, Supabase)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
Topology: an **NGINX edge** (`nginx/nginx.conf`, TLS-ready + rate limiting) fronts the
`client` (static SPA) and `api` (REST + WebSocket) services; `api` runs migrations on
boot (seed is skipped in prod). Mount TLS certs at `nginx/certs/` and uncomment the
`443` block to enable HTTPS.

### CI/CD
`.github/workflows/ci.yml` runs on every push/PR: lint → **migrate + seed + rollback
against a real Postgres service** → client build → build & (on `main`) push both Docker
images to GHCR, with layer caching.

### Health checks
- `GET /health` — liveness · `GET /health/ready` — readiness (DB reachable)
- Both `api` and `client` containers ship Docker `HEALTHCHECK`s.

---

## 🧭 Build status

All 10 phases delivered and verified end-to-end (auth · multi-tenant isolation · menu/
tables/QR · orders → KDS → waiter → billing/PDF · coupons · real-time · notifications ·
audit · analytics/exports · 5 React panels · Docker/NGINX/CI). Backend flows and the
full containerized stack are smoke-tested (`login/dashboard/kds/socket.io = 200`).
