# Sentinel IDS — AI-Based Cloud Server Intrusion Detection and Automated Attacker Blocking System

Sentinel IDS is a fully working e-commerce platform (SecureMart) protected by a real-time
intrusion-detection layer. Every request is inspected by a hybrid engine — eight rule-based
detectors plus two machine-learning models (Random Forest + Isolation Forest) — and hostile
sources are blocked automatically.

All detections are genuine: the system learns exclusively from traffic it observes itself.

## Project Structure

```
SENTINEL_IDS/
│
├── 01_FRONTEND_USER_INTERFACE/        What users see and interact with
│   ├── components/                    UI building blocks (storefront + admin console widgets)
│   │   ├── store/                     Storefront header, footer, product cards
│   │   ├── admin/                     Admin console shell / navigation
│   │   └── ui/                        Reusable primitives (button, table, dialog, ...)
│   └── hooks/                         React hooks (live security stream, toasts, cart)
│
├── 02_BACKEND_SERVER/                 How the application processes requests
│   ├── core/                          Auth (JWT+bcrypt), DB client, guards, settings, formatting
│   │   └── ml/                        ML orchestration: training pipeline + in-process inference
│   ├── security_stream_service/       Socket.IO realtime event stream (port 3003)
│   └── (API routes live in src/app/api — Next.js requires them there)
│
├── 03_MACHINE_LEARNING_MODELS/        How suspicious activities are detected (models)
│   └── model_training/
│       └── train.py                   scikit-learn trainer: RF + IF, exports trees as JSON
│
├── 04_DATASET_AND_DATA_PROCESSING/    What data is used for training
│   ├── training_datasets/             Live-exported traffic feature vectors (current.json)
│   ├── image_datasets/                Product image datasets + fetch tools
│   └── data_tools/                    Traffic generator, image extractors
│
├── 05_DATABASE/                       Where application information is stored
│   ├── schema/                        Prisma schema (13 tables)
│   ├── database_connection/           Embedded PostgreSQL 18 start / boot helpers
│   ├── database_operations/           Seed, wipe, reset-preserving-models, state report
│   └── postgres_data/                 The live PostgreSQL data directory (all data persists here)
│
├── 06_SECURITY_AND_ATTACK_DETECTION/  How attackers are handled
│   └── engine/                        The security engine: IP tracking, rule detectors
│                                      (brute force, stuffing, DDoS, geo-spoofing, invalid IP),
│                                      risk scoring, auto-blocking, geo intelligence
│
├── 07_CONFIGURATION/                  Application settings
│   └── env.example                    Environment template (DATABASE_URL, SESSION_SECRET)
│
├── 08_LOGS_AND_REPORTS/               Security alerts and system activity
│   └── postgres_activity_log/         PostgreSQL server log
│
├── 09_DOCUMENTATION/                  Guides and reports
│   ├── SecureMart-Security-Documentation.pdf   11-page technical documentation
│   └── report_source/                 Source used to rebuild the PDF
│
├── 10_TESTING/                        How the application is tested
│   └── run_tests.py                   Smoke suite: frontend, backend, ML, database, security
│
├── src/app/                           Next.js pages & API routes (framework-required location)
│   ├── page.tsx                       Storefront home
│   ├── admin/                         Admin console: monitor, IP ledger, credentials,
│   │                                  access control, ML models, products, orders, customers
│   ├── api/                           All REST endpoints (guard-protected)
│   └── login/, register/, cart/, ...  Customer pages
│
├── requirements.txt                   Python ML dependencies (scikit-learn, numpy)
├── run_application.bat                ONE-CLICK launcher (Windows)
└── README.md
```

> Note: `src/app/` (pages + API routes), `src/proxy.ts` and `src/instrumentation.ts`
> remain in `src/` because the Next.js framework requires those exact locations.

## How to Run

### One-click (Windows)
Double-click **`run_application.bat`**. It installs dependencies on first run, starts
PostgreSQL, seeds the catalog when the database is empty, launches the realtime stream and
the web app, then opens your browser.

### Manual
```bash
npm install                 # Node dependencies (+ Prisma client)
pip install -r requirements.txt   # Python ML dependencies
npm run db:push             # Start PostgreSQL + create schema + seed catalog
npm run stream              # Realtime event stream (port 3003)
npm run dev                 # Web app (http://localhost:3000)
```

### Verify everything
```bash
python 10_TESTING/run_tests.py
```

## Key URLs
| URL | Purpose |
|---|---|
| http://localhost:3000 | Storefront |
| http://localhost:3000/admin | Admin console (type the URL directly) |
| http://localhost:3003 | Realtime security event stream |

## Admin Access
Sign in at `/admin` with `admin@securemart.in` / `AdminPass#2026`.
New admin accounts require the invite code `ADMIN-2026-SENTINEL` at registration.

## ML Models
- **Random Forest** (supervised): P(window = attack) from 100 trees, trained on weak-supervision
  labels the engine itself assigns. Current production model: 100% test accuracy, F1 1.0.
- **Isolation Forest** (unsupervised): anomaly score for novel-attack detection.
- Retraining: automatic every 5 min when 30+ new samples accumulate, or via the ML Models
  page ("Retrain now"). Trained artifacts are stored in the database and never deleted by
  the reset tooling (`05_DATABASE/database_operations/reset-except-models.mjs`).
