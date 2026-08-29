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

**Stable production URL:** [https://blakjac21-website.vercel.app](https://blakjac21-website.vercel.app)

Pushes to **`blakjac21-website`** can deploy two ways:

1. **GitHub Actions → Vercel** (recommended — reliable; setup below)
2. **Vercel Git integration** — set **Settings → Git → Production Branch** to `blakjac21-website`

### One-time: enable auto-deploy (recommended)

Do this once so every merge/push goes live automatically via GitHub Actions.

#### 1. Create a Vercel token

1. Open [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a token (e.g. `blakjac21-github-deploy`)
3. Copy it

#### 2. Link the project and copy IDs

On your computer (or any terminal logged into Vercel):

```bash
npx vercel login
npx vercel link
# pick the blakjac21-website project
cat .vercel/project.json
```

You’ll see something like:

```json
{ "orgId": "team_…", "projectId": "prj_…" }
```

#### 3. Add GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | token from step 1 |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

#### 4. Confirm Kick / app env vars still live on Vercel

In the Vercel project → **Settings → Environment Variables** (Production):

```
KICK_CLIENT_ID=…
KICK_CLIENT_SECRET=…
SESSION_SECRET=long-random-string
ADMIN_KICK_USERNAME=Blakjac21
```

Optional but recommended for Bonus Hunts:

```
UPSTASH_REDIS_REST_URL=…
UPSTASH_REDIS_REST_TOKEN=…
```

#### 5. Trigger the first deploy

- Push any commit to `blakjac21-website`, **or**
- GitHub → **Actions** → **Deploy Blakjac21 to Vercel Production** → **Run workflow**

When it succeeds, [https://blakjac21-website.vercel.app](https://blakjac21-website.vercel.app) updates.

### What happens after setup

| Event | Result |
|-------|--------|
| Push / merge to `blakjac21-website` | GitHub Action builds + deploys **Production** (after secrets are set) |
| Other branches | No production deploy from this workflow |

### Also set Vercel’s production branch (backup)

In Vercel → project → **Settings → Git**:

- **Production Branch** = **`blakjac21-website`** (not `main`)

That way Vercel’s own Git hook can still deploy if Actions isn’t configured yet.

### Quick fix if the site is stuck on an old build

1. Confirm the 3 GitHub secrets above are set
2. Actions → **Deploy Blakjac21 to Vercel Production** → **Run workflow**
3. Or Vercel → Deployments → latest `blakjac21-website` → **Promote to Production**
4. Hard refresh the site (Ctrl+Shift+R)

### Vercel project settings (still useful)

1. **Settings → Domains** → `blakjac21-website.vercel.app` on Production
2. **Settings → Deployment Protection** → Production **Off** (so Kick OAuth + viewers work)
3. **Build settings** → Root Directory empty, Output Directory empty

### One-time setup (stop redeploying + reconfiguring Kick auth)

Temporary `vercel deploy --temporary` URLs change every run (~60 min expiry). **Use the stable project above instead.**

#### Environment variables (set once in Vercel)

In **Settings → Environment Variables**, add only secrets — **no URL variables required**:

```
KICK_CLIENT_ID=…
KICK_CLIENT_SECRET=…
SESSION_SECRET=long-random-string
GUESS_ADMIN_TOKEN=your-admin-token
ADMIN_KICK_USERNAME=Blakjac21
```

**Recommended for Bonus Hunts + OBS overlays on Vercel** (shared hunt state across serverless instances):

```
UPSTASH_REDIS_REST_URL=https://….upstash.io
UPSTASH_REDIS_REST_TOKEN=…
```

Create a free Redis database at [upstash.com](https://upstash.com), copy the REST URL and token into Vercel env vars, then redeploy. Without this, hunt data can drift between API requests and OBS overlays may not clear reliably after End hunt.

Do **not** set `KICK_REDIRECT_URI` or `NEXT_PUBLIC_SITE_URL` unless you have a special override need. The site derives the OAuth callback from the URL visitors use.

If you previously set those URL vars to an old temporary deploy URL, **delete them** so they do not override the live site.

#### Kick developer app (register URLs once)

In [Kick Developer settings](https://kick.com/settings/developer), add **both** redirect URLs to the same app (you can list multiple):

- Local dev: `http://localhost:3000/api/account/kick/callback`
- Production: `https://blakjac21-website.vercel.app/api/account/kick/callback`

Use `localhost` (not `127.0.0.1`) for local. After this one-time step, code changes and redeploys do **not** require updating Kick auth — as long as your public URL stays the same.

The `/account` page shows the exact callback URL for the site you are on if you need to copy it.

### Option B — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → branch `blakjac21-website`
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
