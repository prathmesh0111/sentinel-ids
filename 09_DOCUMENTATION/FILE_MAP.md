# File Map — What Every Code File Does

Sentinel IDS / SecureMart: a working e-commerce platform protected by a real-time
intrusion-detection layer (8 rule detectors + Random Forest & Isolation Forest models).
This document explains, file by file, what each piece of code is for.

Generated 2026-11-03.

---

## 1. How the folders connect (read this first)

The numbered folders are the **live source code**, not backups. They are wired into the
Next.js app through path aliases in `tsconfig.json`:

| Import alias | Points to |
|---|---|
| `@/components/*` | `01_FRONTEND_USER_INTERFACE/components/*` |
| `@/hooks/*` | `01_FRONTEND_USER_INTERFACE/hooks/*` |
| `@/lib/*` | `02_BACKEND_SERVER/core/*` |
| `@/lib/security/*` | `06_SECURITY_AND_ATTACK_DETECTION/engine/*` |
| `@/*` | `src/*` |

Only `src/app/` (pages + API routes), `src/proxy.ts` and `src/instrumentation.ts` must stay
inside `src/` — the Next.js framework requires those exact locations.

---

## 2. Root files

| File | What it does |
|---|---|
| `run_application.bat` | One-click Windows launcher: kills stale processes holding ports 3000/3003, installs dependencies on first run, creates `.env`, boots PostgreSQL (`boot-db.mjs`), starts the realtime stream service and the web app, then opens the browser. |
| `package.json` | Node manifest and npm scripts: `dev` (pg-start + next dev), `db:push` (pg-start + prisma db push + seed), `stream` (socket.io service), `db:generate`, `postinstall` (prisma generate). Prisma schema is pinned to `05_DATABASE/schema/schema.prisma`. |
| `tsconfig.json` | TypeScript config holding the path aliases that connect the numbered folders into the app (see section 1). |
| `next.config.ts` | Next.js config: `output: "standalone"`, ignores TS build errors, React strict mode off. |
| `tailwind.config.ts` / `postcss.config.mjs` / `eslint.config.mjs` / `components.json` | Tailwind + shadcn/ui tooling configuration. |
| `requirements.txt` | Python dependencies for the ML trainer only: scikit-learn >= 1.4, numpy >= 1.26. |
| `.env` | Local secrets (DATABASE_URL, SESSION_SECRET). Auto-created from `07_CONFIGURATION/env.example` by the launcher. |
| `patch_engine.py` | One-shot patch script that modified `engine.ts` so loopback IPs are never auto-blocked (the operator's console can never lock itself out). |
| `patch_geo.py` | One-shot patch script that added VPN/datacenter-exit detection to `geo.ts` (VPN ISP keyword list + `isVpnIsp()`). |
| `patch_fix.py` | One-shot patch script that threaded the `vpnSuspected` flag through `geo.ts`'s remote fetch and the engine's geo import. |
| `bun.lock`, `package-lock.json`, `tsconfig.tsbuildinfo`, `next-env.d.ts` | Auto-generated dependency/build files — do not edit. |

---

## 3. `src/` — Next.js pages, API routes and process hooks

### App shell

| File | What it does |
|---|---|
| `src/instrumentation.ts` | Runs once per Node process: starts the security engine's background timers (2s event flush, 10s/60s blocklist refresh, 1.5s geo queue) and a 60s auto-retrain checker for the ML models. |
| `src/proxy.ts` | Middleware route guard: verifies the session JWT and redirects non-admins away from `/admin`. Cookie-less requests are left alone — client code handles those via `/api/auth/me`. |
| `src/app/layout.tsx` | Root layout: fonts, global CSS, metadata, the Toaster and `SessionBridge` (session sync across the app). |
| `src/app/globals.css` | Tailwind v4 stylesheet with the shadcn-style design tokens (zinc monochrome theme). |

### Customer-facing pages

| File | What it does |
|---|---|
| `src/app/page.tsx` | Storefront home: security-themed hero + product grid fed by `/api/products` with search, category filter and sorting. |
| `src/app/login/page.tsx` | Login form → `/api/auth/login`; shows IP-blocked (403) messages and redirects admins to `/admin`. |
| `src/app/register/page.tsx` | Registration form → `/api/auth/register`; the admin invite code unlocks the ADMIN role. |
| `src/app/product/[id]/page.tsx` | Product detail page; treats a 403 as "your IP is blocked". |
| `src/app/cart/page.tsx` | Cart page: quantity updates (`PATCH /api/cart/[id]`), removal, INR totals. |
| `src/app/checkout/page.tsx` | Checkout: shipping address + payment method (COD/UPI/Card) → `POST /api/orders`. |
| `src/app/orders/page.tsx` | Customer order history from `/api/orders`. |
| `src/app/account/security/page.tsx` | "My IP & Security" dashboard: polls `/api/me/security` every 10s to show the user's own IP risk score, geo, login history and security events. |

### Admin console pages (all wrapped by `AdminShell`)

| File | What it does |
|---|---|
| `src/app/admin/layout.tsx` | Wraps all `/admin` routes in the admin console chrome. |
| `src/app/admin/page.tsx` | Live monitoring dashboard: polls `/api/admin/overview` + realtime SSE; charts severity/attack-vector breakdowns, traffic timeline, geo distribution, top-risk IPs. |
| `src/app/admin/ips/page.tsx` | IP ledger: search, status filters, sorting, per-IP credential-attempt drill-down. |
| `src/app/admin/credentials/page.tsx` | Credential ledger: every login attempt with outcome filters and totals. |
| `src/app/admin/access/page.tsx` | Access control: list blocked IPs, manually block/unblock via `/api/admin/ip-actions`. |
| `src/app/admin/models/page.tsx` | ML models page: training-sample counts, model artifacts, metrics charts, "Retrain now" button. |
| `src/app/admin/products/page.tsx` | Catalog manager: create/edit/delete products (rupees converted to paise). |
| `src/app/admin/orders/page.tsx` | Order management: status filter, advance orders through PLACED→PACKED→SHIPPED→DELIVERED/CANCELLED. |
| `src/app/admin/users/page.tsx` | Customer list with order/login/cart stats; promote/demote roles, delete users. |
| `src/app/admin/settings/page.tsx` | Security tuning: risk threshold, auto-block, DDoS RPM, brute-force attempts, retrain parameters. |

### API routes (`src/app/api/...`)

Every handler starts with `guard(req, {requireAdmin/requireAuth})` — that single call runs the
security engine on the request (blocking check) and resolves the session.

| File | What it does |
|---|---|
| `api/route.ts` | Health check. GET: hello JSON. |
| `api/auth/login/route.ts` | POST: login. Records every attempt in the credential ledger + engine (brute-force, impossible-travel detection), issues session cookie + token, 403 when the IP is blocked. |
| `api/auth/register/route.ts` | POST: registration; admin code unlocks ADMIN; emits SIGNUP events. |
| `api/auth/logout/route.ts` | POST: clears the session cookie. |
| `api/auth/me/route.ts` | GET: session introspection + requester IP validity/privacy status. |
| `api/products/route.ts` | GET: public catalog feed (search/category/sort) + category list. |
| `api/products/[id]/route.ts` | GET: single product + up to 4 related items. |
| `api/cart/route.ts` | GET: user's cart; POST: add/increment item (stock-checked, max qty 10). |
| `api/cart/[id]/route.ts` | PATCH: change quantity (deletes at 0); DELETE: remove item. Owner-checked. |
| `api/orders/route.ts` | GET: user's orders; POST: places an order in a transaction (stock decrement + cart clear) and emits ORDER_PLACED. |
| `api/me/security/route.ts` | GET: the signed-in user's own IP risk row, last 15 logins, last 10 security events. |
| `api/admin/overview/route.ts` | GET: dashboard aggregation — counters, top-risk IPs, severity/attack-type distributions, 30-min traffic, geo spread, engine + store stats. |
| `api/admin/events/route.ts` | GET: recent security events with type/severity filters (max 100). |
| `api/admin/ips/route.ts` | GET: IP ledger (300 rows, search/filter/sort, per-IP attempt history). |
| `api/admin/ip-actions/route.ts` | POST: manual block/unblock of an IP (loopback self-block refused). |
| `api/admin/credentials/route.ts` | GET: credential ledger — latest 300 login attempts + success/failed totals. |
| `api/admin/models/route.ts` | GET: ML status — artifacts, labeled/unlabeled sample counts, live model versions + metrics. |
| `api/admin/models/retrain/route.ts` | POST: manual retrain trigger (409 if already training). |
| `api/admin/products/route.ts` | GET: full catalog admin listing; POST: create product. |
| `api/admin/products/[id]/route.ts` | PATCH: edit product; DELETE: remove (409 if referenced by an order). |
| `api/admin/orders/route.ts` | GET: latest 200 orders with revenue totals. |
| `api/admin/orders/[id]/route.ts` | PATCH: advance order status. |
| `api/admin/users/route.ts` | GET: users + stats; PATCH: promote/demote; DELETE: remove user (self-actions blocked). |
| `api/admin/settings/route.ts` | GET/POST: read and save engine tuning settings; invalidates the settings cache. |

---

## 4. `01_FRONTEND_USER_INTERFACE/` — shared UI components & hooks

| File | What it does |
|---|---|
| `components/SessionBridge.tsx` | Invisible client component that keeps sessions alive inside cross-site iframes: stores the `sessionToken` in localStorage and patches `window.fetch` to attach it as an `x-session-token` header on every `/api/` call; validates on load and cleans up rejected tokens. |
| `components/brand-logo.tsx` | `BrandLogo` — renders the shared `/logo.svg` emblem (admin shows it as "SecureSentinel", storefront as "SecureMart"). |
| `components/chart-theme.ts` | Shared Recharts tooltip styling (`CHART_TOOLTIP`) for the dark admin charts. |
| `components/admin/shell.tsx` | `AdminShell`: auth-guards `/admin`, renders the sticky top bar (realtime-stream vs polling indicator, user email, logout) and the collapsible IDS + store-management sidebar. |
| `components/store/header.tsx` | `StoreHeader` (search, login/user menu, live cart count) and `StoreFooter` (fraud-detection feature blurb). |
| `components/store/product-card.tsx` | `ProductCard` tile (image, discount badge, stock overlays, add-to-cart) and `BuyButtons` (Add to Cart / Buy Now). |
| `components/store/types.ts` | TypeScript shapes for storefront data: `Product`, `CartItemRow`, `OrderRow`. |
| `hooks/use-security-stream.ts` | Realtime IDS feed for the admin console: Socket.IO connection through the gateway (port 3003), consumes `security-event` messages, de-duplicates, batches every 400 ms, falls back to 4s polling of `/api/admin/events` when disconnected. |
| `hooks/use-toast.ts` | Standard shadcn toast store: `useToast()` hook + imperative `toast()`. |
| `hooks/use-mobile.ts` | `useIsMobile` — media-query hook at 768px. |
| `components/ui/` (48 files) | Grouped entry: shadcn/ui primitives (button, dialog, table, dropdown-menu, sidebar, sonner, ...) — prebuilt Radix-based components, not project-specific logic. |

---

## 5. `02_BACKEND_SERVER/` — server core

| File | What it does |
|---|---|
| `core/guard.ts` | **The single entry point of every API route**: runs `securityGate` (engine trackRequest + blocklist check → 403 JSON for blocked IPs) and resolves the session; `requireAdmin`/`requireAuth` short-circuit with 401/403. Also re-exports the engine. |
| `core/auth.ts` | JWT session auth (jose HS256, 7-day expiry, bcrypt hashing): registerUser (ADMIN only via invite code), authenticate, session resolution with `x-session-token` header fallback for iframe/third-party-cookie restrictions, requireAdmin, cookie helpers. |
| `core/db.ts` | Creates and caches the singleton PrismaClient; forces `DATABASE_URL` to the local Postgres `postgresql://postgres@127.0.0.1:5432/fraudmart` when missing. |
| `core/settings.ts` | Loads tunable settings from the SystemSetting table into a 10s cache with defaults (riskThreshold 80, autoBlock on, ddosRpm 120, bruteForceAttempts 8, retrainMinSamples 30, retrainIntervalMin 5, adminInviteCode). |
| `core/format.ts` | Presentation helpers: `formatINR` (paise → ₹), `discountPercent`, `timeAgo`, severity/status badge color maps. |
| `core/utils.ts` | `cn()` — Tailwind class merge helper (clsx + tailwind-merge). |
| `core/ml/features.ts` | Defines the canonical 11-feature vector (failed logins 10m, requests 1m, 10s burst, distinct usernames, geo jumps, invalid hits, avg interval, UA changes, is_private, is_invalid) and `computeFeatures()` converting live per-IP window stats into it. Shared by rules, both models and the training corpus. |
| `core/ml/infer.ts` | In-process JS inference: loads active ModelArtifact rows from Postgres (30s cache), walks each exported sklearn tree (flat f/t/l/r/p arrays) to get RF attack probability, computes the Isolation Forest anomaly score (2^(-avgPath/c(n))), and `mlAssess()` blends both. |
| `core/ml/train.ts` | Retraining orchestrator: exports TrainingSample rows to `04_DATASET.../current.json`, spawns the Python trainer (120s timeout, single-flight), parses `model.json`, swaps active ModelArtifact rows, marks samples consumed, invalidates the infer cache, emits ML_TRAINED. |
| `security_stream_service/index.ts` | Standalone socket.io server (port 3003): receives `POST /emit` event batches from the engine and pushes them to admin dashboards as `security-event` messages; a 3s DB poller backstops missed posts. |
| `security_stream_service/package.json` | Manifest for the stream service (socket.io dependency, bun dev script). |

---

## 6. `03_MACHINE_LEARNING_MODELS/` — model training

| File | What it does |
|---|---|
| `model_training/train.py` | Scikit-learn trainer called by `ml/train.ts`: always trains an IsolationForest (100 trees, contamination 0.08/0.15, ≥10 samples); trains a RandomForestClassifier (100 trees, depth 12, class_weight balanced, stratified 75/25 split) when ≥20 labeled samples of both classes exist. Exports accuracy/precision/recall/F1/OOB/feature-importance metrics and serializes both models as flattened JSON trees to `model.json`. |

---

## 7. `04_DATASET_AND_DATA_PROCESSING/` — training data & catalog images

| File | What it does |
|---|---|
| `data_tools/generate-data.mjs` | Offline corpus builder that drives 100% real HTTP traffic at the running app: registers 10 customers, normal browsing for label-0 samples, and four attack phases (brute force, credential stuffing, floods, malformed IPs) for label-1 samples. |
| `data_tools/final-training-round.mjs` | Refinement pass: 10 customers browsing from fixed "home" IPs across spaced windows to bank clean label-0 samples + a slow brute-force top-up, then triggers the retrain API and prints corpus metrics. |
| `data_tools/extract-images.mjs` | One-off tool that scans per-product image-search result files and writes `products-images.json`. |
| `data_tools/fetch-images.sh` / `fetch-images-retry.sh` | One-off bash scripts that fetched product photos via the z-ai image-search CLI (main pass + retry pass). Hardcoded Linux sandbox paths — historical artifacts. |
| `image_datasets/products-images.json` | Index mapping each of the 24 product keys to candidate image URLs. |
| `image_datasets/img/*.json` | Per-product image-search result files (one per catalog product). |
| `training_datasets/current.json` | File-side snapshot of the weak-supervision training buffer: version, the 11 feature names, and labeled feature vectors. |
| `training_datasets/model.json` | File-side snapshot of the trained Random Forest (exported decision trees as f/t/l/r/p arrays). The authoritative copy lives in the DB (ModelArtifact table). |

---

## 8. `05_DATABASE/` — schema, boot & maintenance scripts

| File | What it does |
|---|---|
| `schema/schema.prisma` | Prisma schema, 13 models. E-commerce: User, Product, CartItem, Order, OrderItem. Security/IDS: LoginRecord, IpAddress (risk + blocklist), SecurityEvent, CredentialAttempt, TrainingSample, ModelArtifact, SystemSetting, TrafficMinute. Prices stored in paise. |
| `database_connection/pg-start.mjs` | Starts the embedded PostgreSQL 18 server: exits fast if 127.0.0.1:5432 is already up, otherwise initializes `postgres_data/pgdata` on first run, starts via pg_ctl (logging to `08_LOGS.../postgres.log`), creates the `fraudmart` database. |
| `database_connection/boot-db.mjs` | Launcher boot helper: runs pg-start, then — only if the schema/catalog is missing — runs `npm run db:push` (schema + seed). Existing data always survives a restart. |
| `database_operations/seed.mjs` | Idempotent seeder: upserts only the 24-product catalog + SystemSetting defaults. Never creates fake users/events/orders. |
| `database_operations/reset-dashboard.mjs` | Light wipe: clears only dashboard-facing security tables (events, credentials, IPs, traffic minutes); keeps users, products, training samples, models. |
| `database_operations/reset-except-models.mjs` | Full reset that keeps the trained ML models: wipes security data, orders, carts, non-admin users and training samples, but preserves active ModelArtifact rows, the admin account, the catalog and settings; also deletes the ml JSON intermediates. |
| `database_operations/wipe-all.mjs` | Nuclear option: deletes every table's rows including products, users and ML artifacts (despite its docstring, it does not re-seed — run seed.mjs after). |
| `database_operations/check-state.mjs` | Diagnostic: recent tracked IPs, latest security events, last traffic aggregates. |
| `database_operations/report-state.mjs` | Diagnostic: full security/ML state summary — sample counts by label, active model versions + metrics, IP status distribution, event counts by type. |
| `database_operations/measure-rate.mjs` | Diagnostic: samples the request counter for ::1 over 10s and prints the per-minute request rate. |
| `postgres_data/` | The live PostgreSQL data directory (all application data persists here). Not code. |

---

## 9. `06_SECURITY_AND_ATTACK_DETECTION/` — the IDS engine

| File | What it does |
|---|---|
| `engine/engine.ts` | **The core SecurityEngine** (process-global singleton): tracks every client IP with sliding-window state, runs rule-based detection + ML blending + auto-blocking, buffers and flushes events/IP stats/training samples to Postgres every 2s, broadcasts to the socket.io stream, and exposes `securityGate()` used by every API route. |
| `engine/geo.ts` | Geo-IP resolution via ip-api.com (2.5s timeout, DB + 10-min memory cache, inflight dedupe); private IPs → "Local Network"; `isVpnIsp()` flags VPN/datacenter exits by ISP keyword matching (~35 keywords). |
| `engine/ip.ts` | IP utilities: strict IPv4/IPv6 parsing, private-range classification (RFC1918, loopback, CGNAT...), `extractClientIp` (X-Forwarded-For → CF-Connecting-IP → X-Real-IP), and `haversineKm()` for impossible-travel distance. |

**Detectors inside `engine.ts`** (for reference when reading the file):

| Detector | Trigger |
|---|---|
| BRUTE_FORCE | Failed logins in 10 min ≥ `bruteForceAttempts` (default 8) |
| DDOS_SUSPECTED / RATE_BURST | ≥120 req/min (CRITICAL at 2×) / ≥40 req in 10s burst |
| CREDENTIAL_STUFFING | ≥5 distinct usernames from one IP, or one username targeted from ≥4 IPs, in 10 min |
| GEO_JUMP (impossible travel) | Successive logins >500 km apart with a country change |
| INVALID_IP | Malformed IPv4/IPv6 in headers |
| VPN/datacenter exit | `vpn_hosting` signal (35 pts) via ISP keywords; plus bot-pacing and user-agent signals |
| Loopback exemption | 127.0.0.1 is never auto-blocked and always passes the gate (self-lockout protection) |

Risk scoring: rule signals combine into a 0–100 rule risk; with models live the final score is
`0.4×rule + 0.4×RF + 0.2×IF` (floored at 0.9×rule). Final score ≥ threshold (default 80) →
auto-BLOCK + CRITICAL event + label-1 training sample; ≥55 → WATCHLIST; <40 → back to ACTIVE.

---

## 10. `07_CONFIGURATION/` and `08_LOGS_AND_REPORTS/`

| File | What it does |
|---|---|
| `07_CONFIGURATION/env.example` | Environment template: DATABASE_URL for the embedded Postgres; optional SESSION_SECRET. |
| `08_LOGS_AND_REPORTS/postgres_activity_log/postgres.log` | The embedded PostgreSQL server log (written by pg-start.mjs). |

---

## 11. `09_DOCUMENTATION/` — guides & reports

| File | What it does |
|---|---|
| `real_testing_guide.md` | Hands-on guide for testing the IDS with genuinely real traffic (real networks, phone, VPN, Cloudflare Tunnel) — e.g. impossible-travel detection via a real VPN login. |
| `SecureMart-Security-Documentation.pdf` | The 11-page technical documentation deliverable. |
| `report_source/gen_body.py` | ReportLab script that generates the PDF body (A4, tables, code blocks, TOC). |
| `report_source/make_cover.py` | Renders the PDF cover and merges cover + body into the final PDF. |
| `report_source/patch.py` | One-off string-rewrite script applied to gen_body.py / make_cover.py. |
| `report_source/render.py` | Rasterizes the final PDF pages to PNGs for visual review. |
| `ui_screenshots/*.png` | UI screenshots used in documentation. |

---

## 12. `10_TESTING/` — verification

| File | What it does |
|---|---|
| `run_tests.py` | End-to-end smoke suite (7 sections): project structure integrity, configuration/aliases, database boot, backend APIs (incl. admin guard), frontend pages render, ML model presence + sklearn deps, and a live 12-attempt brute-force that must get flagged/blocked (then unblocked to leave the system clean). Run with `python 10_TESTING/run_tests.py`. |

---

## 13. How a request flows through all of this

1. **Browser** loads a page from `src/app/` (pages fetch their data client-side).
2. Every API call hits a route in `src/app/api/`, which first calls **`guard()`**
   (`02_BACKEND_SERVER/core/guard.ts`).
3. `guard()` invokes **`securityGate()`** in the engine
   (`06_SECURITY_AND_ATTACK_DETECTION/engine/engine.ts`): the request is tracked, scored
   (rules + ML), and blocked with 403 if the IP is on the blocklist.
4. The engine flushes events/IP stats/training samples to **PostgreSQL** every 2s and posts
   events to the **stream service** (`security_stream_service/index.ts`, port 3003).
5. The admin dashboard receives events live via **`use-security-stream.ts`** (Socket.IO) or
   falls back to polling.
6. When enough labeled traffic accumulates, `src/instrumentation.ts`'s 60s checker triggers
   **`ml/train.ts`**, which spawns the **Python trainer** (`train.py`), and the new model is
   swapped into the DB and picked up by **`ml/infer.ts`** within 30 seconds.
