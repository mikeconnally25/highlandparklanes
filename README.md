# Blakjac21

Landing site for the **Blakjac21** Kick channel.

## Features (v1)

- Brand-first landing page
- Live Kick player embed when the channel is online
- Latest VOD fallback when offline (HLS when available, otherwise Kick link)
- Logo placeholder for a later asset drop-in

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (public URL for viewers)

This is a standalone Next.js app in the **blakjac21 website** repo. Deploy the repo root — no monorepo subfolder needed.

### One-time setup (stop redeploying + reconfiguring Kick auth)

Temporary `vercel deploy --temporary` URLs change every run (~60 min expiry). That forces you to update Kick redirect URLs and env vars constantly. **Use a permanent Vercel project instead** — same URL forever, auto-deploy on every git push.

#### 1. Connect GitHub → Vercel (do this once)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `mikeconnally25/blakjac21-website`
2. Leave **Root Directory** empty (repo root is the app)
3. Framework: Next.js (auto-detected). Deploy
4. Copy your **Production URL** (e.g. `https://blakjac21-website.vercel.app`) — it stays the same across redeploys
5. Optional: add a custom domain under **Settings → Domains**

Every push to `main` redeploys automatically. You do **not** need to run manual deploys or update URL env vars.

#### 2. Vercel environment variables (set once)

In **Settings → Environment Variables**, add only secrets — **no URL variables required**:

```
KICK_CLIENT_ID=…
KICK_CLIENT_SECRET=…
SESSION_SECRET=long-random-string
GUESS_ADMIN_TOKEN=your-admin-token
ADMIN_KICK_USERNAME=Blakjac21
```

Do **not** set `KICK_REDIRECT_URI` or `NEXT_PUBLIC_SITE_URL` unless you have a special override need. The site derives the OAuth callback from the URL visitors use.

If you previously set those URL vars to an old temporary deploy URL, **delete them** so they do not override the live site.

#### 3. Kick developer app (register URLs once)

In [Kick Developer settings](https://kick.com/settings/developer), add **both** redirect URLs to the same app (you can list multiple):

- Local dev: `http://localhost:3000/api/account/kick/callback`
- Production: `https://YOUR-STABLE-VERCEL-URL/api/account/kick/callback`

Use `localhost` (not `127.0.0.1`) for local. After this one-time step, code changes and redeploys do **not** require updating Kick auth — as long as your public URL stays the same.

The `/account` page shows the exact callback URL for the site you are on if you need to copy it.

### Option B — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → `mikeconnally25/blakjac21-website`
2. Repo root is the app (Dockerfile included)
3. Generate a public domain under Networking
4. Add the same env vars as above (secrets only — URL vars optional)
5. Add your Railway domain callback URL in Kick developer settings (once)

### Avoid temporary deploys for production

`npx vercel deploy --temporary` is fine for quick previews, but each run gets a **new** URL. Kick OAuth will not work there unless you add that new URL to your Kick app every time. Use the permanent GitHub-linked project for the live site.

## Kick status

Server routes:

- `GET /api/kick/status` — live flag, title, viewers, latest VOD metadata
- `GET /api/kick/vod/[uuid]` — VOD playback source for HLS

Channel slug: `Blakjac21`

## Guess the Balance

Set an admin token to control entries during stream:

```bash
cp .env.example .env.local
# edit GUESS_ADMIN_TOKEN in .env.local
```

In **Streamer controls** under Guess the Balance, paste the same token to open/close entries and clear guesses.

## Kick account login (viewers sign up with Kick)

Create account / Sign in is **Kick OAuth only** (`user:read`). No email/password on this site.

### Streamer admin (your Kick account only)

Streamer controls (Guess the Balance, Bonus Hunts, Giveaways) are **hidden** unless you are signed in with the admin Kick account.

Set in `.env.local` / production:

```bash
ADMIN_KICK_USERNAME=Blakjac21
# optional, more precise:
# ADMIN_KICK_USER_ID=12345678
```

Sign in with Kick as that account — the header shows an **Admin** badge and streamer controls appear. Other Kick accounts can still sign in as viewers; they will not see or call admin controls.

`GUESS_ADMIN_TOKEN` remains an optional server-only fallback for scripts; it is no longer shown in the UI.

### 1. Create a Kick developer app

1. Log into Kick as **your** streamer account.
2. Open [kick.com/settings/developer](https://kick.com/settings/developer).
3. Create an application (name e.g. `Blakjac21 site`).
4. Add a **Redirect URL** that matches your site exactly (no trailing slash):
   - Local: `http://localhost:3000/api/account/kick/callback`
   - Production: `https://YOUR_DOMAIN/api/account/kick/callback`
5. You can list both URLs on the same app if you develop locally and deploy.
6. Copy the **Client ID** and **Client Secret**.

Use `localhost` (not `127.0.0.1`) for local redirects.

### 2. Set environment variables

**Local** — copy and edit:

```bash
cp .env.example .env.local
```

```bash
KICK_CLIENT_ID=your_client_id
KICK_CLIENT_SECRET=your_client_secret
SESSION_SECRET=long-random-string
```

**Production (Vercel / Railway)** — set the same keys as service Variables. URL env vars are optional; register your stable production callback URL in Kick once (see Deploy section).

Redeploy / restart after saving. `KICK_CLIENT_SECRET` must stay server-only (never in client code).

### 3. Verify

1. Open `/account` on your site.
2. If env is missing, the page shows a setup checklist.
3. Click **Continue with Kick** → authorize on Kick → you return signed in with your Kick username.

Viewers then use the same button: Kick consent → site account tied to their Kick profile.

## Guess the Balance chat

When entries are open, the site listens to Kick chat and records messages like `1234`, `$1,234.50`, or `!guess 500` (one guess per username).
