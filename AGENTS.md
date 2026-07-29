# AGENTS.md — RestroSaaS Project Context

> **Single source of truth for AI agents & developers.** Read this first before editing.
> It captures architecture, conventions, the data model, the full API surface, and
> "how to add X" recipes so you can make changes without re-reading the whole codebase.
> Keep this file updated when you add modules, tables, endpoints, or env vars.

---

## 1. What this is

Multi-tenant **Restaurant Management SaaS**: QR ordering · Kitchen Display (KDS) · Waiter ·
Billing · Coupons · Analytics · Audit · Notifications. Sold per-restaurant (tenant).
Every domain row carries `tenant_id`; isolation is enforced at the middleware layer.

**Stack:** Node.js/Express + PostgreSQL + Socket.IO (backend) · React 18 (Vite) + Tailwind +
Framer Motion + Recharts + React Query + Zustand (frontend) · Supabase Storage · JWT cookie auth ·
Docker + NGINX + GitHub Actions.

**Status:** All 10 build phases complete & verified. Backend 35/35 sanity tests pass; full
stack runs in Docker. See §12 for what's intentionally stubbed.

---

## 2. Repo layout (monorepo, npm workspaces)

```
cafe_software/
├── package.json                  # workspaces: [server, client]; root scripts (dev, db:*, build)
├── docker-compose.yml            # DEV full stack: postgres(5433) + api(4000) + client-nginx(5173)
├── docker-compose.prod.yml       # PROD: postgres + api + client + edge nginx (80/443)
├── .env.prod.example             # prod env template (copy → .env.prod)
├── nginx/nginx.conf              # PROD edge reverse proxy (TLS-ready, rate limit, WS upgrade)
├── .github/workflows/ci.yml      # lint → migrate+seed+rollback on real PG → build → GHCR
├── README.md                     # user-facing setup/deploy docs
├── AGENTS.md                     # ← this file
│
├── server/
│   ├── Dockerfile                # Node 22 alpine, multi-stage, non-root, HEALTHCHECK
│   ├── .env / .env.example       # server env (see §9)
│   └── src/
│       ├── server.js             # entrypoint: boots HTTP + Socket.IO, graceful shutdown
│       ├── app.js                # express factory: helmet/cors/compression/cookies/csrf/routes
│       ├── config/
│       │   ├── env.js            # Zod-validated env, exports `env`, isProd/isDev/isTest
│       │   ├── logger.js         # pino (pretty in dev IF pino-pretty installed, else JSON)
│       │   └── database.js       # pg Pool; query(), getClient(), withTransaction(fn)
│       ├── shared/               # cross-cutting kernel (see §5)
│       │   ├── ApiError.js       # operational error w/ statusCode+code; static helpers
│       │   ├── ApiResponse.js    # ok()/created()/noContent() envelope
│       │   ├── catchAsync.js     # async route wrapper → forwards errors
│       │   ├── constants.js      # ROLES, PERMISSIONS, ROLE_PERMISSIONS, *_STATUS enums, AUDIT_MODULE
│       │   ├── pagination.js     # offset + cursor helpers
│       │   ├── security.js       # bcrypt, JWT sign/verify, refresh tokens, QR HMAC sign/verify
│       │   ├── cookies.js        # set/clear auth cookies + CSRF cookie
│       │   ├── ms.js             # "15m" → ms
│       │   ├── sqlUpdate.js      # buildUpdate() whitelist + mapKeysToSnake()
│       │   ├── storage.js        # Supabase (LAZY init, placeholder-aware) signed uploads
│       │   └── export.js         # buildCsv/buildXlsx/sendExport for reports
│       ├── middleware/
│       │   ├── requestContext.js # req.id + req.clientCtx {ip,browser,os,device}
│       │   ├── authenticate.js   # authenticate / optionalAuthenticate → req.user, req.tenantId
│       │   ├── authorize.js      # requireRole / requirePermission / requireAllPermissions
│       │   ├── tenantContext.js  # requireTenant → sets req.tenantId (SUPER_ADMIN via X-Tenant-Id)
│       │   ├── validate.js       # validate({body,query,params}) with Zod; replaces req.* with parsed
│       │   ├── csrf.js           # double-submit CSRF (only when cookie auth present)
│       │   ├── rateLimiter.js    # globalLimiter + authLimiter
│       │   ├── errorHandler.js   # central error → envelope; maps ZodError/pg codes
│       │   └── notFound.js
│       ├── realtime/socket.js    # Socket.IO gateway + rooms + emitToTenant/Role/User/Order
│       ├── routes/
│       │   ├── index.js          # API v1 aggregator (mounts every module router)
│       │   └── health.routes.js  # /health, /health/ready
│       ├── db/
│       │   ├── migrate.js        # runner: `up|down|status`; reads migrations/*.sql
│       │   ├── seed.js           # idempotent demo data (see §11 creds)
│       │   └── migrations/       # 0001..0006 .sql (each has `-- migrate:up` / `-- migrate:down`)
│       └── modules/<feature>/    # feature slices (see §4)
│
└── client/
    ├── Dockerfile                # Vite build → nginx:alpine static + API/WS proxy
    ├── nginx.conf                # client container: SPA fallback + proxy /api & /socket.io → api:4000
    ├── vite.config.js            # dev proxy to :4000; manualChunks (react/charts/motion/query)
    ├── tailwind.config.js        # darkMode:'class'; brand palette; glass shadows; keyframes
    ├── .env / .env.example       # VITE_API_URL, VITE_SOCKET_URL (empty in dev → same-origin)
    └── src/
        ├── main.jsx              # QueryClientProvider + BrowserRouter + Toaster
        ├── App.jsx               # routes + RoleRoute guard + lazy-loaded panels
        ├── index.css             # tailwind + .glass/.glass-strong/.card/.skeleton/.aurora
        ├── lib/
        │   ├── api.js            # axios: CSRF header inject + 401→refresh→retry; request() unwraps
        │   ├── socket.js         # connect/get/disconnect Socket.IO
        │   ├── cn.js             # cn() classnames + money()
        │   └── chartTheme.js     # useChartTokens() — validated chart colors (light/dark)
        ├── store/                # Zustand: auth.js, theme.js, cart.js
        ├── hooks/useSocketEvents.js  # subscribe to socket events + playBeep()
        ├── components/
        │   ├── ui/               # Button.jsx + index.jsx (Card,Input,Select,Textarea,Badge,
        │   │                     #   Spinner,Skeleton,EmptyState,Modal)
        │   ├── ThemeToggle.jsx
        │   └── admin/            # AdminLayout, NotificationBell, StatCard
        └── pages/
            ├── auth/LoginPage.jsx
            ├── customer/         # CustomerApp, MenuItemCard, ItemModal, CartSheet, OrderTracking
            ├── kitchen/          # KitchenDisplay, KitchenCard
            ├── waiter/WaiterPanel.jsx
            ├── admin/            # AdminApp(routes)+Dashboard,Orders,Menu,Tables,Coupons,Staff,Branding,Audit
            └── superadmin/SuperAdminApp.jsx
```

---

## 3. Roles & permissions (RBAC)

Roles (`shared/constants.js` → `ROLES`): `SUPER_ADMIN` (platform, `tenant_id=NULL`),
`RESTAURANT_ADMIN`, `KITCHEN`, `WAITER`, `CUSTOMER` (guest orders, usually no user row).

- `ROLE_PERMISSIONS` maps each role → permission list (`PERMISSIONS.*`, e.g. `menu:manage`,
  `order:update_status`, `audit:view`). `SUPER_ADMIN` bypasses permission checks.
- Access token JWT carries `{sub, tenantId, role, name, permissions?}`. If `permissions` absent,
  role defaults apply.
- **Guard routes with:** `authenticate` → `requireTenant` (tenant-scoped) → `requirePermission(P.X)`.
  Super-admin-only routes: `requireRole(ROLES.SUPER_ADMIN)`.

---

## 4. Backend module anatomy (THE pattern — copy it)

Each `modules/<feature>/` is a layered slice:
```
<feature>.routes.js       # Router; applies authenticate/requireTenant/requirePermission + validate()
<feature>.validators.js   # Zod schemas (camelCase in) → exported per action
<feature>.controller.js   # thin; catchAsync; calls service; returns ok()/created()
<feature>.service.js      # business logic + audit + socket emits + transactions
<feature>.repository.js    # SQL only, parameterized, tenant-scoped
```
Existing modules: `auth, tenants, staff, categories, menu, tables, coupons, orders, billing,
public, notifications, audit, analytics, finance, uploads`.

**Conventions (follow exactly):**
- **Money is computed server-side** from the DB catalog (never trust client prices). See
  `orders/orders.pricing.js` (pure fn) + `orders.service.createOrder` (transactional).
- **Validators use camelCase**; repositories map to snake_case columns via `mapKeysToSnake()`
  and whitelist columns via `buildUpdate(data, ALLOWED, startIdx)`.
- **Every mutating action writes an audit log** via `auditFromRequest(req, {...})` or
  `recordAudit({...})` (module from `AUDIT_MODULE`).
- **Success envelope:** `{ success, message, data, meta? }` via `ok/created`. **Errors:**
  `{ success:false, error:{ code, message, details? } }` via `ApiError` + central handler.
- **Pagination:** `parseOffsetPagination(req.query)` → `{limit,offset,page}`; wrap with
  `buildOffsetMeta({page,limit,total})`. Repos return `{rows, total}`.
- **Transactions:** `withTransaction(async (q) => { ... })`; pass `q` down to repo fns that
  accept `{ q }`.
- **Soft delete:** set `deleted_at/deleted_by`; all reads filter `deleted_at IS NULL`.
- **Tracking columns** on important tables: `created_at, updated_at, deleted_at, created_by,
  updated_by, deleted_by` (updated_at maintained by `set_updated_at()` trigger).

---

## 5. Data model (PostgreSQL, UUID PKs)

Migrations `server/src/db/migrations/0001..0006`. Key tables & relations:

- **subscription_plans** (code, price, limits, features)
- **tenants** (slug, name, status[TRIAL/ACTIVE/SUSPENDED/DISABLED], **branding: logo_url,
  cover_url, brand_color, menu_header, menu_footer**, currency, address JSONB, gst_number,
  settings JSONB{defaultTaxRate,serviceChargeRate,enableServiceCharge,currencySymbol})
- **tenant_subscriptions** (tenant→plan, status, period)
- **users** (tenant_id NULL for super admin; role; password_hash; permissions JSONB override;
  unique email per tenant)
- **refresh_tokens** (hashed, family_id for rotation reuse-detection)
- **categories** → **menu_items** (price, tax_rate, food_type, spicy_level, prep_time_mins,
  flags: is_available/is_out_of_stock/is_recommended/is_bestseller) → **menu_item_images**,
  **menu_variants** (price_delta), **addon_groups** (min/max_select) → **addon_options** (price)
- **floors** → **restaurant_tables** (table_number, status, **qr_token, qr_version** — rotating)
- **customers** (per-tenant, phone unique; visits_count, total_spent)
- **coupons** (type PERCENTAGE/FLAT, value, min_order_amount, max_discount, usage_limit,
  used_count, expiry)
- **orders** (order_number `ORD-#####`, status[PENDING/ACCEPTED/PREPARING/READY/SERVED/COMPLETED/
  REJECTED/DELAYED/CANCELLED], payment_status, money cols, coupon, waiter_id, timestamps per stage)
  → **order_items** (name/variant SNAPSHOTS, unit_price, line_total, tax_rate) → **order_item_addons**
- **payments** (method CASH/CARD/UPI/ONLINE) · **invoices** (invoice_number `INV-#####`, snapshot
  JSONB, print_count) · **tenant_counters** (race-safe per-tenant sequence for order/invoice #)
- **notifications** (user_id OR target_role; is_read) · **audit_logs** (module, action, record_id,
  old/new_values JSONB, actor_*, ip/device/browser/os)
- **expenses** (0007) — category, title, amount, vendor, payment_method, expense_date, note.
  Plus **menu_items.cost_price** and **order_items.cost_snapshot** (unit cost captured at order
  time). COGS = Σ(qty × `COALESCE(NULLIF(cost_snapshot,0), menu_items.cost_price, 0)`), so
  historical orders fall back to the product's current cost. P&L = NetSales − COGS − Expenses.

Enums are **TEXT + CHECK constraints** (not native enums) — add values by editing the CHECK in a
new migration.

---

## 6. API surface (all under `/api/v1`, mounted in `routes/index.js`)

Auth cookies: `rs_access` (15m), `rs_refresh` (7d, rotating), `rs_csrf` (JS-readable, echo in
`X-CSRF-Token` on mutations). `GET/HEAD/OPTIONS` skip CSRF.

| Module | Endpoints |
|---|---|
| **auth** | `POST /auth/register` (new tenant+admin), `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| **tenants** | `GET/PATCH /tenants/me` (branding/settings); super: `GET /tenants`, `GET /tenants/:id`, `PATCH /tenants/:id/status` |
| **staff** | `GET/POST /staff`, `GET/PATCH/DELETE /staff/:id`, `POST /staff/:id/reset-password` |
| **categories** | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` |
| **menu** | `GET/POST /menu`, `GET/PATCH/DELETE /menu/:id`, `PATCH /menu/:id/toggle` |
| **tables** | `GET/POST /tables`, `GET/PATCH/DELETE /tables/:id`, `GET /tables/:id/qr`, `POST /tables/:id/qr/regenerate`; floors: `GET/POST /tables/floors`, `PATCH/DELETE /tables/floors/:id` |
| **coupons** | `GET/POST /coupons`, `GET/PATCH/DELETE /coupons/:id` |
| **orders** | `GET /orders`, `GET /orders/:id`, `GET /orders/kitchen/queue`, `POST /orders`, `PATCH /orders/:id/status`, `POST /orders/:id/serve`, `POST /orders/:id/cancel` |
| **billing** | `POST /billing/orders/:orderId/pay`, `GET /billing/orders/:orderId/invoice`, `GET /billing/orders/:orderId/invoice.pdf` |
| **public** (no auth; QR payload `d`) | `GET /public/resolve?d=`, `POST /public/orders`, `GET /public/orders/:orderId?d=`, `POST /public/coupon/preview` |
| **notifications** | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read` |
| **audit-logs** | `GET /audit-logs`, `GET /audit-logs/facets`, `GET /audit-logs/export?format=csv|xlsx` |
| **analytics** | `GET /analytics/dashboard`, `GET /analytics/reports/sales?format=csv|xlsx` |
| **finance** | Expenses: `GET/POST /finance/expenses`, `PATCH/DELETE /finance/expenses/:id`, `GET /finance/expenses/export`. P&L: `GET /finance/pnl`, `GET /finance/pnl/trend`, `GET /finance/product-profit`, `GET /finance/product-profit/export`. Perms: `expense:view/manage`, `finance:view` |
| **uploads** | `POST /uploads/signed-url`, `GET /uploads/status` |
| **health** | `GET /health`, `GET /health/ready` |

---

## 7. Real-time (Socket.IO)

Cookie-auth handshake (`realtime/socket.js`). Rooms: `tenant:<id>`, `tenant:<id>:<ROLE>`,
`user:<id>`, `order:<id>`. Emit via `emitToTenant/emitToRole/emitToUser/emitToOrder`.

**Events emitted** (consumed by KDS/Waiter/Admin/Customer):
`order:new`, `order:updated`, `order:status`, `orders:changed`, `notification:new`.
Customers subscribe to their order via `order:subscribe`/`order:unsubscribe` (they poll the public
track endpoint since they're unauthenticated; staff panels use live sockets).

---

## 8. Frontend conventions

- **Routing** (`App.jsx`): `/order` (public customer), `/login`, `/super`, `/admin/*`,
  `/kitchen`, `/waiter`. `RoleRoute` guards + redirects by role. All panels lazy-loaded
  (customers never download the charts bundle).
- **Data:** React Query (`useQuery`/`useMutation`) + `request(api.x())` which unwraps `data.data`
  and throws friendly `err.message`. Invalidate `queryKey`s after mutations.
- **State:** Zustand — `useAuth` (bootstrap/login/logout/hasPermission), `useTheme`,
  `useCart` (customer).
- **Real-time in UI:** `useSocketEvents({ 'order:new': fn, ... })` + `playBeep()`.
- **UI kit:** import from `@/components/ui`. Glass classes in `index.css`. Brand color `#f97316`.
- **Charts:** colors from `useChartTokens()` — single-series = one hue; the customers donut uses
  a CVD-validated blue+orange pair (validated via the dataviz skill script, ΔE ~97). If you add a
  multi-series categorical chart, re-validate the palette.
- **`@/` alias** → `client/src`.

---

## 9. Environment variables

Server (`server/.env`, schema in `config/env.js`): `NODE_ENV, PORT(4000), API_PREFIX(/api/v1),
CLIENT_URL, CORS_ORIGINS, DATABASE_URL` (or DB_HOST/PORT/NAME/USER/PASSWORD), `DB_SSL,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, QR_TOKEN_SECRET,
COOKIE_DOMAIN, COOKIE_SECURE, COOKIE_SAME_SITE, SUPABASE_URL, SUPABASE_SERVICE_KEY,
SUPABASE_STORAGE_BUCKET, RATE_LIMIT_*, LOG_LEVEL`. Secrets must be ≥16 chars or boot fails.

Client (`client/.env`): `VITE_API_URL`, `VITE_SOCKET_URL` — **empty in dev** (Vite proxies).

---

## 10. Run / build / test

```bash
# Dev (hot reload): needs Postgres
docker compose up -d postgres           # host port 5433 → container 5432 (see gotcha)
npm install                             # root workspaces
npm run db:migrate --workspace server && npm run db:seed --workspace server
npm run dev                             # api(4000) + client(5173) concurrently

# Full stack in Docker (production-like)
docker compose up --build               # client-nginx on 5173, api on 4000; auto migrate+seed

# Migrations
npm run db:migrate --workspace server   # up
npm run db:rollback --workspace server  # down (last)
npm run db:status  --workspace server

# Frontend build
npm run build --workspace client

# Sanity test (backend, 35 checks through nginx proxy at :5173):
bash scripts/sanity-backend.sh          # requires the stack running (docker compose up)
```

---

## 11. Demo data (seed.js) — password for all: `Password123!`

| Role | Email | Tenant handle |
|---|---|---|
| Super Admin | `superadmin@restrosaas.com` | (blank) |
| Restaurant Admin | `owner@demo.com` | `demo-cafe` |
| Kitchen | `kitchen@demo.com` | `demo-cafe` |
| Waiter | `waiter@demo.com` | `demo-cafe` |

Seeds: demo-cafe tenant (branding set), PRO subscription, 8 tables/Ground Floor, 4 categories +
7 items, coupon `WELCOME10` (10%, min ₹199, max ₹100).

---

## 12. Intentionally stubbed (wire later)

- **Supabase Storage** — signed-upload endpoint + lazy client built; set real `SUPABASE_URL`/
  `SUPABASE_SERVICE_KEY` (non-placeholder) to activate. Menu/branding accept image **URLs** so
  nothing is blocked meanwhile.
- **Payment gateway** — billing records CASH/CARD/UPI + issues invoices; integrate a real PSP as a
  drop-in in `billing.service.completePayment`.
- **Lint** — ESLint is a dep but no config committed; CI runs it `continue-on-error`. Add
  `eslint.config.js` (flat) if you want enforced linting.
- **Tests** — no unit test suite yet; sanity is an integration bash script (§13).

---

## 13. GOTCHAS (read before debugging — these cost time)

1. **Postgres port 5433**, not 5432. The host already runs a native Postgres on 5432, so
   `docker-compose.yml` maps the container to **5433**. `server/.env` uses 5433. If migrations fail
   with `28P01 auth failed`, you're hitting the wrong Postgres.
2. **Server image is Node 22** (not 20): `@supabase/realtime-js` needs native WebSocket. On Node 20
   the Supabase client crashes at boot. Storage client is also **lazily** initialized and treats
   placeholder creds (`your-project`) as unconfigured, so boot never depends on Supabase.
3. **Logger + prod image:** `pino-pretty` is a devDependency pruned from the prod image. `logger.js`
   guards with `require.resolve` and falls back to JSON — don't remove that guard.
4. **CSRF:** mutations with cookie auth require `X-CSRF-Token` == `rs_csrf` cookie. Pure Bearer
   clients are exempt. The axios client injects it automatically; server-to-server callers must too.
5. **Money & QR are server-authoritative.** Never compute totals client-side for real charges. QR
   deep links are HMAC-signed (`QR_TOKEN_SECRET`); placing an order re-verifies the payload → tenant
   + table are derived server-side, never from the request body. Regenerating a table QR bumps
   `qr_version`, invalidating old codes.
6. **camelCase (API) vs snake_case (DB):** validators/DTOs are camelCase; repos map with
   `mapKeysToSnake`. Responses currently return **raw snake_case DB rows** in many endpoints — the
   frontend reads snake_case (e.g. `o.order_number`, `item.is_available`). Keep that in mind when
   adding fields.
7. **Order state machine** lives in `orders.service.js` (`ALLOWED` map + `TIMESTAMP_FIELD`). Invalid
   transitions → 400. Payment on a SERVED order auto-COMPLETES it.
8. **Adding an enum value** (status/food_type/etc.) = new migration altering the `CHECK` constraint,
   plus update `shared/constants.js` and any frontend tone maps.

---

## 14. Recipes

**Add a backend module `foo`:**
1. `modules/foo/foo.repository.js` (parameterized, tenant-scoped, `{rows,total}` for lists).
2. `foo.service.js` (logic + `auditFromRequest` + socket emits + `withTransaction`).
3. `foo.validators.js` (Zod, camelCase). `foo.controller.js` (catchAsync + `ok/created`).
4. `foo.routes.js` (`authenticate, requireTenant, requirePermission(P.X), validate({...})`).
5. Register in `routes/index.js`. Add any new `PERMISSIONS`/`ROLE_PERMISSIONS` in `constants.js`.
6. If new tables: add `db/migrations/000N_foo.sql` with `-- migrate:up`/`-- migrate:down`,
   tracking columns, indexes, `set_updated_at` trigger. Run `db:migrate`.

**Add a frontend admin page:** create `pages/admin/FooPage.jsx` (React Query + `@/components/ui`),
add a `<Route>` in `pages/admin/AdminApp.jsx`, add a nav item in `components/admin/AdminLayout.jsx`
`NAV`.

**Add a real-time event:** emit in the service via `emitToRole/Tenant(...)`; consume in the panel
via `useSocketEvents({ 'your:event': fn })` (usually `qc.invalidateQueries`).

---

## 15. Verification checklist before you call a change done

- `npm run build --workspace client` passes.
- `npm run db:migrate --workspace server` (and `db:rollback` reverses cleanly) if schema changed.
- Backend sanity script (§10) still 35/35, or extend it for your new endpoints.
- If Docker changed: `docker compose up --build` → all containers HEALTHY, and through nginx
  `login/dashboard/kds/socket.io = 200`.
```
