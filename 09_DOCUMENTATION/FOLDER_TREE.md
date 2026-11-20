# Folder Tree — Main Files Only (for your presentation)

Walk your mentor down this tree top to bottom. Every line is: file → what it's for.
Only the files a mentor would actually ask about are listed.

```
P:\G2Project\
│
├── run_application.bat              The ONE-CLICK launcher: starts database, web app
│                                    and live alerts, then opens the browser
├── package.json                     The script list (npm run dev, npm run db:push...)
│
├── src\app\                         *** ALL PAGES & APIs live here (Next.js rule) ***
│   │
│   │   ── CUSTOMER PAGES (what shoppers see) ──
│   ├── page.tsx                     Shop home: all products with search & filters
│   ├── login\page.tsx               Login page
│   ├── register\page.tsx            Sign-up page (admin needs invite code)
│   ├── product\[id]\page.tsx        One product's detail page
│   ├── cart\page.tsx                Shopping cart
│   ├── checkout\page.tsx            Address + payment → places the order
│   ├── orders\page.tsx              Customer's past orders
│   ├── account\security\page.tsx    "My IP & Security": user sees their OWN
│   │                                risk score, location, login history
│   │
│   │   ── ADMIN CONSOLE (the security control room) ──
│   ├── admin\page.tsx               LIVE DASHBOARD: attack charts, risky IPs, traffic
│   ├── admin\ips\page.tsx           IP Ledger: every visitor's IP, score, status
│   ├── admin\credentials\page.tsx   Credential Ledger: every login try, success/fail
│   ├── admin\access\page.tsx        Manually block / unblock an IP
│   ├── admin\models\page.tsx        The 2 ML models, their accuracy, "Retrain now"
│   ├── admin\products\page.tsx      Add / edit / delete shop products
│   ├── admin\orders\page.tsx        Advance orders: PLACED → PACKED → SHIPPED...
│   ├── admin\users\page.tsx         Manage customers & make someone admin
│   ├── admin\settings\page.tsx      Tune the engine (thresholds, auto-block on/off)
│   │
│   │   ── APIs (the "waiters" between pages and database) ──
│   ├── api\auth\login\route.ts      Login API: checks password, reports every try
│   │                                to the engine (feeds brute-force detection)
│   ├── api\auth\register\route.ts   Sign-up API
│   ├── api\auth\me\route.ts         "Who am I?" — used by every page on load
│   ├── api\products\route.ts        Product list for the shop
│   ├── api\cart\route.ts            Add / view cart items
│   ├── api\orders\route.ts          Place an order (reduces stock, clears cart)
│   ├── api\me\security\route.ts     A user's own IP-risk report
│   └── api\admin\...                Admin data APIs (overview, ips, ip-actions,
│                                    credentials, models, retrain, products, orders,
│                                    users, settings — one per admin page above)
│
├── 01_FRONTEND_USER_INTERFACE\      *** REUSABLE UI PIECES ***
│   ├── components\admin\shell.tsx        ADMIN SHELL: the console's frame —
│   │                                     sidebar menu + top bar + login check
│   ├── components\store\header.tsx       Shop top bar: search, cart count, user menu
│   ├── components\store\product-card.tsx The product tile used all over the shop
│   ├── components\SessionBridge.tsx      Keeps you logged in even inside an iframe
│   ├── components\brand-logo.tsx         The logo, used in both shop and console
│   └── hooks\use-security-stream.ts      LIVE ALERTS: connects admin dashboard
│                                         to instant attack notifications
│
├── 02_BACKEND_SERVER\               *** SERVER HELPERS (no pages, pure logic) ***
│   ├── core\guard.ts                ⭐ SECURITY DOOR — every single API call passes
│   │                                through it; runs the engine on every visitor
│   ├── core\auth.ts                 Passwords (bcrypt), login sessions (JWT), roles
│   ├── core\db.ts                   The database connection (Prisma client)
│   ├── core\settings.ts             Reads admin's tunable settings from DB
│   ├── core\ml\features.ts          Turns visitor behaviour into 11 numbers
│   ├── core\ml\infer.ts             Runs the 2 ML models live on those numbers
│   ├── core\ml\train.ts             Auto-retrain manager: collects samples,
│   │                                calls the Python trainer, swaps models
│   └── security_stream_service\index.ts  Separate mini-server (port 3003) that
│                                         pushes attack alerts to the dashboard LIVE
│
├── 03_MACHINE_LEARNING_MODELS\
│   └── model_training\train.py      ⭐ The Python "teacher": trains Random Forest
│                                    (knows attacks) + Isolation Forest (spots the
│                                    never-seen) using scikit-learn
│
├── 05_DATABASE\
│   ├── schema\schema.prisma         ⭐ Database design: 13 tables (5 shop tables,
│   │                                8 security/ML tables)
│   ├── database_connection\pg-start.mjs   Starts the built-in PostgreSQL 18
│   ├── database_connection\boot-db.mjs    First-run setup (later runs keep all data)
│   └── database_operations\seed.mjs       Fills the catalog with 24 real products
│
├── 06_SECURITY_AND_ATTACK_DETECTION\    *** ⭐⭐ THE SECURITY GUARD — MOST IMPORTANT ***
│   └── engine\
│       ├── engine.ts                THE BRAIN of the whole project:
│       │                            • 8 detectors (brute force, DDoS, credential
│       │                              stuffing, impossible travel, VPN, invalid IP...)
│       │                            • gives every visitor a risk score 0–100
│       │                            • score 80+ → BLOCKS the attacker automatically
│       ├── ip.ts                    Reads the visitor's real IP, checks it's valid
│       └── geo.ts                   Which country are you from + VPN detection
│
└── 10_TESTING\
    └── run_tests.py                 One command checks everything works:
                                    structure, APIs, pages, ML, and even launches a
                                    real fake-attack to prove blocking works
```

---

## Folders NOT in the tree (safe to skip if the mentor doesn't ask)

| Folder / file | Why it's skipped |
|---|---|
| `04_DATASET_AND_DATA_PROCESSING` | Just training examples + product photos (the ML teacher reads these). |
| `07_CONFIGURATION\env.example` | A settings template — the launcher copies it on first run. |
| `08_LOGS_AND_REPORTS` | The database's own diary (log file). |
| `09_DOCUMENTATION` | The guides you're reading. |
| `patch_*.py` at root | One-time fix scripts already applied — historical, no role now. |
| `components\ui\` (48 files) | Prebuilt buttons/dialogs from shadcn/ui — not written for this project. |
| `node_modules`, `.next`, lock files | Auto-generated by tools — never opened by humans. |

---

## If you remember only 5 things

1. `06.../engine/engine.ts` = the guard: detects attacks, scores 0–100, auto-blocks.
2. `02.../core/guard.ts` = the door: every API call passes through it first.
3. `train.py` = the teacher that trains the two ML brains from real traffic.
4. `src/app` = every page (shop + admin) and every API — the framework needs them there.
5. `run_application.bat` = starts everything with one double-click.
