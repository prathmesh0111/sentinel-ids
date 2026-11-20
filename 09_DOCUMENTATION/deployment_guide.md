# Hosting Guide — Render (backend) + Vercel (frontend)

Sentinel IDS is a Next.js full-stack app, so the split works like this:

```
Your browser
   │
   ├── Vercel  →  serves the FRONTEND (pages, static assets, CDN)
   │              every /api/* call is proxied to Render (rewrite in next.config.ts)
   │
   └── Render  →  runs the BACKEND persistently:
                  · all API routes + the security engine (needs a live process —
                    in-memory IP tracking cannot run on serverless)
                  · ML retraining (Python + scikit-learn available on Render)
                  · the Socket.IO stream service (websockets need a live server)
```

One repository, two Render services, one Vercel project. Zero code changes
needed at deploy time — everything is wired through environment variables.

---

## STEP 0 — Push the code to GitHub (already committed locally)

Git is installed and the project is committed. Create an empty repository on
github.com (e.g. `sentinel-ids`, no README), then:

```bash
git remote add origin https://github.com/<your-username>/sentinel-ids.git
git push -u origin master
```

(The `.gitignore` already excludes the local database, `.env` and generated files.)

## STEP 1 — Create a hosted database (Neon — free, no expiry)

The embedded local PostgreSQL cannot run in the cloud, so both services point
to one hosted database.

1. Go to **neon.tech** → sign up → **New Project**.
2. Copy the **connection string** — looks like:
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`
3. From your PC, create the schema + catalog in Neon once:
   ```powershell
   $env:DATABASE_URL="<your-neon-url>"
   npx prisma db push --schema 05_DATABASE/schema/schema.prisma
   node 05_DATABASE/database_operations/seed.mjs
   ```

## STEP 2 — Backend on Render

1. Render dashboard → **New → Blueprint** → choose your GitHub repo.
   It reads `render.yaml` and creates **two services** automatically.
2. When prompted, fill in the secret values:
   - `DATABASE_URL` → your Neon connection string (same for both services)
   - `STREAM_INTERNAL_URL` → `https://sentinel-ids-stream.onrender.com`
     (the stream service's URL — the engine POSTs events there)
3. Deploy. The backend app URL looks like
   `https://sentinel-ids-backend.onrender.com` — verify with
   `/api/products` (should return the catalog JSON).

Notes:
- Free Render instances **sleep after 15 min idle** — the first request after
  a pause takes ~1 minute to wake. Paid plans stay warm.
- The build installs Python + scikit-learn, so **ML retraining works on the
  server** (the engine retrains automatically every 5 minutes once 30+ new
  traffic samples accumulate).

## STEP 3 — Frontend on Vercel

1. vercel.com → **Add New → Project** → import the same GitHub repo.
2. Framework auto-detects **Next.js**. Set these environment variables:
   - `BACKEND_URL` = `https://sentinel-ids-backend.onrender.com`
     (proxies every `/api/*` request to Render — see next.config.ts)
   - `NEXT_PUBLIC_STREAM_URL` = `https://sentinel-ids-stream.onrender.com`
     (the dashboard websocket connects to the Render stream)
   - `SESSION_SECRET` = the same value Render generated (not strictly needed
     on Vercel, but keeps environments consistent)
3. Deploy. Your frontend URL: `https://<project>.vercel.app`.

## STEP 4 — Point the stream service at your frontend (CORS)

The stream service allows all origins by default (`cors: { origin: '*' }`),
so no change is needed. If you want to lock it down later, replace the origin
with your Vercel URL.

## STEP 5 — Log in and use it

1. Open your Vercel URL → sign in as `admin@securemart.in`.
   (The admin account exists only in your LOCAL database — in the hosted
   Neon database, register a fresh admin with the invite code
   `ADMIN-2026-SENTINEL` at `/register`.)
2. Open `/admin` → the Live Monitor connects to the Render stream — the
   badge shows **REALTIME STREAM**.
3. Test a real attack from your phone (mobile data) against the Vercel URL:
   10–12 wrong logins → the engine auto-blocks that public IP → see it in the
   IP Ledger. Full walkthrough: `real_testing_guide.md` in this folder.

---

## Environment variables summary

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | Render (both) + local build | Neon connection string |
| `SESSION_SECRET` | Render | long random string |
| `STREAM_INTERNAL_URL` | Render (backend) | Render stream service URL |
| `BACKEND_URL` | Vercel | Render backend URL |
| `NEXT_PUBLIC_STREAM_URL` | Vercel | Render stream service URL |

## Costs

Everything above runs on free tiers: Vercel Hobby, Render free (services
sleep when idle), Neon free. Total: **₹0**.

## Two honest caveats

1. **Render free sleeps** — after 15 idle minutes the first request wakes the
   service (~60 s). For a live demo, click the site once beforehand.
2. **Geo lookups** — ip-api.com free allows 45 lookups/min from one server IP;
   results are cached in memory + database, which is enough for a demo.
