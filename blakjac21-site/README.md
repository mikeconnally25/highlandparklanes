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

## Kick account login

Create account / Sign in uses **Kick OAuth** only (`user:read`).

1. Create an app in the [Kick Developer settings](https://kick.com/settings/developer)
2. Set redirect URL to `https://YOUR_DOMAIN/api/account/kick/callback` (or `http://localhost:3000/api/account/kick/callback` for local)
3. Add to `.env.local`:

```bash
KICK_CLIENT_ID=...
KICK_CLIENT_SECRET=...
KICK_REDIRECT_URI=http://localhost:3000/api/account/kick/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SESSION_SECRET=...
```

When entries are open, the site listens to Kick chat and records messages like `1234`, `$1,234.50`, or `!guess 500` (one guess per username).
