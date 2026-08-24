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
KICK_REDIRECT_URI=http://localhost:3000/api/account/kick/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SESSION_SECRET=long-random-string
```

**Production (Railway)** — set the same keys as service Variables, with production URLs:

```bash
KICK_CLIENT_ID=your_client_id
KICK_CLIENT_SECRET=your_client_secret
KICK_REDIRECT_URI=https://YOUR_DOMAIN/api/account/kick/callback
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
SESSION_SECRET=long-random-string
```

Redeploy / restart after saving. `KICK_CLIENT_SECRET` must stay server-only (never in client code).

### 3. Verify

1. Open `/account` on your site.
2. If env is missing, the page shows a setup checklist.
3. Click **Continue with Kick** → authorize on Kick → you return signed in with your Kick username.

Viewers then use the same button: Kick consent → site account tied to their Kick profile.

## Guess the Balance chat

When entries are open, the site listens to Kick chat and records messages like `1234`, `$1,234.50`, or `!guess 500` (one guess per username).
