# Highland Park Lanes — weekly bowling coupons

Members sign up, get a coupon for **3 free games every week**, and staff validate/redeem codes at the desk.

Works on phones in the browser, and can be **installed to the home screen** like an app (PWA).

## Quick start (local)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed staff account

Created automatically on first run:

| Field    | Value                    |
|----------|--------------------------|
| Email    | `staff@strikeclub.local` |
| Password | `change-me`              |

Staff login: `/staff/login`

Change that password in production.

## Phone access (PWA)

After the site is online over **HTTPS**:

1. Open your public URL on a phone
2. **iPhone (Safari):** Share → **Add to Home Screen**
3. **Android (Chrome):** tap **Install** when prompted, or Menu → **Install app** / **Add to Home screen**

Members then open **HPL Coupons** like a normal app and show their weekly QR at the desk.

## Deploy so phones can reach it

SQLite needs a persistent disk, so use **Railway** or **Render** (not Vercel serverless).

### Option A — Railway (recommended)

1. Push this repo to GitHub
2. Create a project at [railway.app](https://railway.app) → Deploy from GitHub
3. Add a **Volume** mounted at `/data`
4. Set variables:

```
SESSION_SECRET=<long-random-string>
ALLEY_TIMEZONE=America/New_York
DATA_DIR=/data
NODE_ENV=production
```

5. Generate a public domain in Railway
6. Share that URL with members and staff

`Dockerfile` + `railway.toml` are included.

### Option B — Render

1. Use the included `render.yaml` Blueprint, or create a **Web Service** from this repo (Docker)
2. Attach a disk at `/data`
3. Set the same env vars as above
4. Deploy and use the `onrender.com` URL

### Option C — Docker on any VPS

```bash
docker build -t hpl-coupons .
docker run -d -p 3000:3000 \
  -e SESSION_SECRET=your-secret \
  -e DATA_DIR=/data \
  -v hpl-data:/data \
  hpl-coupons
```

Put HTTPS in front (Caddy, Nginx, Cloudflare Tunnel).

### Why not plain Vercel?

This app stores data in a **SQLite file**. Vercel’s serverless functions don’t keep a writable disk between requests. Use Railway/Render, or later migrate the database to Turso/Postgres if you want Vercel.

## How weekly coupons work

- Timezone: `America/New_York` (override with `ALLEY_TIMEZONE`)
- Period is **7 days** (Monday–Sunday)
- When a member opens their dashboard, the app ensures one coupon for the current period
- **A brand-new code and QR are generated every 7 days** — old QRs expire
- Codes look like `SC-A1B2-C3D4`
- Only one coupon per member per week
- Staff redeem once; already-redeemed or expired codes are refused

## Environment

See `.env.example`. Locally use `.env.local`:

```
SESSION_SECRET=replace-with-a-long-random-string
ALLEY_TIMEZONE=America/New_York
```

## Stack

- Next.js (App Router) + TypeScript
- SQLite via Node’s built-in `node:sqlite`
- PWA (manifest + service worker + install prompt)
- Session cookies (HMAC-signed)
- bcryptjs for passwords

## Main routes

| Route           | Who     | Purpose                          |
|-----------------|---------|----------------------------------|
| `/`             | Anyone  | Landing                          |
| `/signup`       | Members | Create account                   |
| `/login`        | Members | Sign in                          |
| `/app`          | Members | Current week coupon + QR         |
| `/app/history`  | Members | Past coupons                     |
| `/staff/login`  | Staff   | Staff sign in                    |
| `/staff`        | Staff   | Lookup, redeem, recent activity  |
