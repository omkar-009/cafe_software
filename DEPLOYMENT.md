# Going live — deployment guide

Backend is on Render: `https://cafe-software-01gs.onrender.com`. Pick ONE hosting
model below. Option A is the most robust (no third-party-cookie issues).

---

## Backend (Render web service) — required env vars

Set these in Render → your service → Environment (Supabase is already your DB):

```
NODE_ENV=production
PORT=<Render sets this automatically — do not hardcode>
DATABASE_URL=postgresql://postgres.rpqkkitysofiqyrshtfl:Cafe_software%402026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
DB_SSL=true

JWT_ACCESS_SECRET=<random 48+ chars>       # openssl rand -base64 48
JWT_REFRESH_SECRET=<random 48+ chars>
QR_TOKEN_SECRET=<random 32+ chars>

# Cookies for cross-site auth (Option B). For Option A, lax is fine.
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
# leave COOKIE_DOMAIN unset (host-only cookie)

# Where customers open the menu (used in table QR codes):
PUBLIC_URL=<your FRONTEND url>
```

Render **Start command**: `node server/src/server.js`
Render **Build command**: `npm install` (Option B) — or see Option A.

The server listens on `0.0.0.0` and reads Render's `PORT`. Migrations already ran
against Supabase; to auto-run on deploy use start command
`npm run db:migrate --workspace server && node server/src/server.js`.

---

## Option A — Single origin (RECOMMENDED)

Serve the built frontend FROM the backend, so everything is one domain
(`…onrender.com`). No CORS, no cross-site cookies, CSRF "just works".

Render service settings:
- **Build command:** `npm install && npm run build --workspace client`
- **Start command:** `node server/src/server.js`
- **Env:** add `SERVE_CLIENT=true` (plus the vars above; `COOKIE_SAME_SITE=lax`
  is fine here). Leave the client's `VITE_API_URL`/`VITE_SOCKET_URL` empty.
- `PUBLIC_URL=https://cafe-software-01gs.onrender.com`

Open the app at `https://cafe-software-01gs.onrender.com`. Done.

---

## Option B — Separate frontend host (Vercel / Netlify / Render Static)

Frontend and API are on different domains.

1. **Frontend build env** (Vercel/Netlify project settings):
   ```
   VITE_API_URL=https://cafe-software-01gs.onrender.com
   VITE_SOCKET_URL=https://cafe-software-01gs.onrender.com
   ```
2. **Backend env** (Render): add your frontend URL to CORS, and use cross-site cookies:
   ```
   CORS_ORIGINS=https://your-frontend.vercel.app
   COOKIE_SAME_SITE=none
   COOKIE_SECURE=true
   PUBLIC_URL=https://your-frontend.vercel.app
   ```
3. Auth uses cross-site cookies. The CSRF token is returned in the login/refresh
   body and stored client-side (so it works across domains) — no action needed.

> ⚠ Cross-site cookies rely on third-party cookies, which Safari (and, soon,
> Chrome) may block. If staff login is flaky in some browsers, switch to Option A.

---

## Checklist after deploy
- `GET https://…onrender.com/health` → `{ "status": "ok" }`
- `GET https://…onrender.com/health/ready` → `{ "db": "up" }`
- Log in as `owner@demo.com` / handle `demo-cafe` / `Password123!`
- Admin → Tables → QR: the link now uses `PUBLIC_URL`; scan it from a phone.
