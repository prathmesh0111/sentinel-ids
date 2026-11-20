# SecureMart / Sentinel IDS — Simple Guide to the Important Files

**One line for your mentor:** "It's a working online shop (SecureMart) that watches every
visitor in real time, detects attackers using rules + two machine-learning models, and
blocks them automatically. All the training data comes from the shop's own real traffic."

---

## FRONTEND — what the user sees

### 1. The shop pages (customer side)

| File | What it is |
|---|---|
| `src/app/page.tsx` | The home page of the shop. Shows all products with search and category filters. |
| `src/app/login/page.tsx` | The login page. |
| `src/app/register/page.tsx` | The sign-up page (admins need a special invite code). |
| `src/app/product/[id]/page.tsx` | The detail page for one product. |
| `src/app/cart/page.tsx` | The shopping cart page. |
| `src/app/checkout/page.tsx` | The checkout page (address + payment, places the order). |
| `src/app/orders/page.tsx` | Shows the customer their past orders. |
| `src/app/account/security/page.tsx` | A special page where any user can see their OWN risk score, location and login history. |

### 2. The admin console (security team side)

| File | What it is |
|---|---|
| `src/app/admin/page.tsx` | The main security dashboard — live charts of attacks, traffic and the riskiest IPs. |
| `src/app/admin/ips/page.tsx` | The IP Ledger — every visitor's IP, risk score and status (Active / Watchlist / Blocked). |
| `src/app/admin/credentials/page.tsx` | The Credential Ledger — every login attempt ever made, success or fail. |
| `src/app/admin/access/page.tsx` | Where the admin manually blocks or unblocks an IP. |
| `src/app/admin/models/page.tsx` | Shows the two ML models, their accuracy, and has a "Retrain now" button. |
| `src/app/admin/products/orders/users/page.tsx` | Normal shop management: products, orders, customers. |
| `src/app/admin/settings/page.tsx` | Where the admin tunes the system (attack threshold, auto-block on/off, etc.). |

### 3. Reusable UI pieces (components)

| File | What it is |
|---|---|
| `01_FRONTEND_USER_INTERFACE/components/admin/shell.tsx` | The frame of the admin console — sidebar + top bar. |
| `01_FRONTEND_USER_INTERFACE/components/store/header.tsx` | The shop's top bar (search, cart, login). |
| `01_FRONTEND_USER_INTERFACE/components/store/product-card.tsx` | The single product tile used everywhere in the shop. |
| `01_FRONTEND_USER_INTERFACE/components/SessionBridge.tsx` | Keeps you logged in even when the site is opened inside another site (iframe). |
| `01_FRONTEND_USER_INTERFACE/hooks/use-security-stream.ts` | Brings LIVE attack alerts into the admin dashboard the moment they happen. |

---

## BACKEND — how everything works behind the scenes

### 1. The security brain (most important part)

| File | What it is |
|---|---|
| `06_SECURITY_AND_ATTACK_DETECTION/engine/engine.ts` | **The heart of the project.** Watches every visitor, runs 8 attack detectors (brute force, DDoS, credential stuffing, fake location/impossible travel, VPN exits, invalid IPs), calculates a 0–100 risk score, and blocks attackers automatically. |
| `06_SECURITY_AND_ATTACK_DETECTION/engine/geo.ts` | Finds *where in the world* an IP is from, and detects VPN/datacenter connections. |
| `06_SECURITY_AND_ATTACK_DETECTION/engine/ip.ts` | Reads the visitor's real IP address and checks if it's valid, private or fake. |

### 2. The server helpers

| File | What it is |
|---|---|
| `02_BACKEND_SERVER/core/guard.ts` | The security checkpoint. Every single API call passes through it — it checks who you are AND runs the attack engine on you. |
| `02_BACKEND_SERVER/core/auth.ts` | Handles passwords, login sessions and user roles (customer vs admin). |
| `02_BACKEND_SERVER/core/db.ts` | The connection to the PostgreSQL database. |
| `02_BACKEND_SERVER/core/settings.ts` | Loads the admin's tunable settings (attack thresholds etc.). |
| `02_BACKEND_SERVER/security_stream_service/index.ts` | A small separate server (port 3003) that pushes live attack alerts to the admin dashboard instantly. |

### 3. The machine-learning part

| File | What it is |
|---|---|
| `02_BACKEND_SERVER/core/ml/features.ts` | Turns a visitor's behaviour into 11 numbers (failed logins, request speed, location jumps...) that the models can read. |
| `02_BACKEND_SERVER/core/ml/infer.ts` | Runs the two trained models on those numbers to get an attack probability — in real time, while the user browses. |
| `02_BACKEND_SERVER/core/ml/train.ts` | The retraining manager — collects training samples and calls the Python trainer. |
| `03_MACHINE_LEARNING_MODELS/model_training/train.py` | The Python script that actually trains the two models: Random Forest (learns what attacks look like) and Isolation Forest (spots strange, never-seen behaviour). |

### 4. The database

| File | What it is |
|---|---|
| `05_DATABASE/schema/schema.prisma` | The database design — 13 tables: shop tables (users, products, orders, cart) + security tables (IPs, security events, login records, training samples, saved ML models). |
| `05_DATABASE/database_connection/pg-start.mjs` | Starts the built-in PostgreSQL database. |
| `05_DATABASE/database_connection/boot-db.mjs` | Sets up the database on first run, keeps data on later runs. |
| `05_DATABASE/database_operations/seed.mjs` | Fills the shop with its 24 products (no fake users or fake attacks — everything else is real). |

### 5. The API routes (the server's endpoints, in `src/app/api/`)

| Group | Routes | What they do |
|---|---|---|
| Login APIs | `api/auth/*` | Register, login, logout, check who's logged in. |
| Shop APIs | `api/products`, `api/cart`, `api/orders` | Browse products, manage cart, place orders. |
| My-security API | `api/me/security` | Lets a user see their own IP risk report. |
| Admin APIs | `api/admin/*` | Dashboard stats, IP ledger, block/unblock, login ledger, ML model status + retrain, product/order/user management, security settings. |

---

## HOW IT ALL WORKS — tell it in this order

1. A visitor opens the shop and browses products like on any normal e-commerce site.
2. Every click calls an API, and every API first passes the **security checkpoint** (`guard.ts`).
3. The checkpoint sends the visitor to the **security engine** (`engine.ts`), which scores
   them 0–100 using 8 rule detectors plus the two ML models.
4. Score below 55 → normal user, nothing happens. 55+ → put on a watchlist.
   80+ → **blocked automatically** and a critical alert is raised.
5. The alert appears live on the **admin dashboard** through the stream service.
6. Every detection is saved as a training sample, so the models keep retraining themselves
   from the shop's real traffic — the system gets smarter on its own.
7. The admin can review everything in the IP Ledger and Credential Ledger, and manually
   block or unblock any IP.
