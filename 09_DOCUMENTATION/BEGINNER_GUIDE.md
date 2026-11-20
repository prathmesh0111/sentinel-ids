# Beginner Guide — Understand Your Own Project in Plain Words

This file explains the project like a story. No technical words without explanation.
If you can understand a shopping mall, you can understand this project.

---

## THE STORY (read this first)

Your project is an **online shopping mall** with a very smart **security guard**.

1. Customers enter the mall (the website) and shop normally — that's **SecureMart**.
2. At the entrance of every shop stands a guard (**the engine**). He watches every visitor.
3. The guard gives every visitor a **suspicion score from 0 to 100**:
   - 0–54: normal customer, let them shop.
   - 55–79: looking suspicious, write their name in the **watchlist**.
   - 80–100: attacker — **throw them out** (block their IP) and raise an alarm.
4. How does the guard decide? Two ways:
   - **Rules** he memorized: "8 wrong password tries = trouble", "100 clicks in 1 minute = trouble",
     "was in India 5 minutes ago and now in America = fake location".
   - **Two trained brains (ML models)** that learned from past examples what attackers look like.
5. Everything the guard sees appears **live on CCTV screens** (the admin dashboard).
6. The guard keeps a **register** of every visitor: their address (IP), their score,
   every login attempt. The admin can read it anytime.

That's the whole project. Now let's see which code file plays which character.

---

## WHO IS WHO — the 12 files that matter

### The mall (frontend — what people SEE)

| Character in the story | File | One-line meaning |
|---|---|---|
| The mall building | `src/app/page.tsx` | The home page: shows all products to shop from. |
| The billing counter | `src/app/checkout/page.tsx` | Where the customer pays and places the order. |
| The customer's memory | `src/app/orders/page.tsx` | Shows customers their past orders. |
| The CCTV control room | `src/app/admin/page.tsx` | Live dashboard: attack alerts, charts, risky visitors. |
| The guard's register | `src/app/admin/ips/page.tsx` | List of every visitor's IP, score and status. |
| The login attempts register | `src/app/admin/credentials/page.tsx` | Every username/password try — success or fail. |
| The block/unblock switch | `src/app/admin/access/page.tsx` | Admin manually blocks or unblocks a visitor. |
| The brain's report card | `src/app/admin/models/page.tsx` | Shows the two ML models and how accurate they are. |

### The security (backend — what happens BEHIND the scenes)

| Character in the story | File | One-line meaning |
|---|---|---|
| The shop entrance door | `02_BACKEND_SERVER/core/guard.ts` | EVERY request passes through this file first. It checks who you are, then calls the guard. |
| The security guard | `06_SECURITY_AND_ATTACK_DETECTION/engine/engine.ts` | **The main file of the project.** Detects 8 types of attacks, gives the 0–100 score, blocks attackers. |
| The ID-card checker | `06_SECURITY_AND_ATTACK_DETECTION/engine/ip.ts` | Reads the visitor's internet address (IP) and checks it's not fake. |
| The location checker | `06_SECURITY_AND_ATTACK_DETECTION/engine/geo.ts` | Finds which country the visitor is in, and detects VPNs (people hiding their location). |
| The attendance register | `02_BACKEND_SERVER/core/auth.ts` | Handles usernames, passwords, and "remembering" who is logged in. |
| The walkie-talkie | `02_BACKEND_SERVER/security_stream_service/index.ts` | Instantly informs the admin dashboard when an attack happens. |

### The brains (machine learning)

| Character in the story | File | One-line meaning |
|---|---|---|
| The exam paper maker | `02_BACKEND_SERVER/core/ml/features.ts` | Converts a visitor's behaviour into 11 simple numbers the brains can read (how many failed logins, how fast they click, did they jump countries...). |
| The instant grader | `02_BACKEND_SERVER/core/ml/infer.ts` | Feeds those 11 numbers to the two brains and gets an answer: "attack or normal?" |
| The teacher | `03_MACHINE_LEARNING_MODELS/model_training/train.py` | Trains the two brains using past examples, so they keep improving. |
| The brain's notebook | `05_DATABASE/schema/schema.prisma` | The design of the database: what tables exist (users, products, orders, attackers, training data...). |

---

## THE WORDS YOUR MENTOR MIGHT USE (glossary)

| Word | Simple meaning |
|---|---|
| Frontend | The part you SEE in the browser (pages, buttons, colors). |
| Backend | The part working invisibly on the server (checking logins, saving orders, detecting attacks). |
| API | The waiter between the menu and the kitchen. The browser asks the API for data ("show me products"), the API brings it from the database. |
| Database | A set of organized notebooks where all data is saved permanently (users, orders, attackers). |
| PostgreSQL | The specific database software used here. |
| Prisma | A translator that lets the code read and write the database easily. |
| IP address | Your home address on the internet. Every visitor has one, so the system can track and block them. |
| Session / JWT | A hand-stamp you get after login that proves "I already entered" — no need to type the password on every click. |
| Risk score | The suspicion level 0–100 that the engine gives every visitor. |
| Auto-block | The system throwing out an attacker by itself, with no human needed. |
| Machine learning model | A program that LEARNED patterns from examples, instead of a human writing exact rules. |
| Random Forest (RF) | Brain #1: learned from labelled examples what an attack looks like. Answers "how likely is this an attack?" |
| Isolation Forest (IF) | Brain #2: spots anything strange and unusual, even attacks it has never seen before. |
| Retraining | The brains going back to school with fresh examples (from real traffic) to get smarter. |
| Watchlist | The "keep an eye on this person" list — risky but not yet blocked. |
| Brute force attack | Trying many passwords quickly to break into one account. |
| Credential stuffing | Trying stolen username/password pairs on many accounts. |
| Impossible travel | Logging in from India and, minutes later, from Brazil — physically impossible, so the location is fake. |

---

## THE JOURNEY OF ONE CLICK (say this to your mentor)

When a customer clicks "Add to Cart":

1. The browser sends a request to the server.
2. It passes through `guard.ts` — the security door.
3. The door calls the engine (`engine.ts`): "score this visitor."
4. The engine checks its rules + asks the two ML brains (`infer.ts`).
5. Normal visitor? The order is placed and saved in the database. Attacker? Blocked with 403.
6. The event appears live on the admin dashboard through the walkie-talkie.
7. The visit is saved as a new training example, so the brains keep learning.

---

## QUICK ANSWERS IF YOUR MENTOR ASKS

**"Where is your attack detection?"**
→ `06_SECURITY_AND_ATTACK_DETECTION/engine/engine.ts` — 8 detectors + risk score + auto-block.

**"Where do you check the password?"**
→ `02_BACKEND_SERVER/core/auth.ts` checks it; `src/app/api/auth/login/route.ts` records every attempt.

**"How does blocking actually work?"**
→ When the score crosses 80, `engine.ts` adds the IP to the blocklist. Every later request
from that IP is refused at the `guard.ts` door before it reaches any page.

**"Where are the ML models trained?"**
→ `03_MACHINE_LEARNING_MODELS/model_training/train.py` (Python + scikit-learn), called
automatically by `02_BACKEND_SERVER/core/ml/train.ts` when enough new examples pile up.

**"Where is your database design?"**
→ `05_DATABASE/schema/schema.prisma` — 13 tables: 5 for the shop, 8 for security/ML.

**"Is your data real or fake?"**
→ Real. The system only seeds 24 products. All attacks, users and training samples come
from real traffic the system observed itself.

---

## HOW TO READ THE PROJECT FOLDER (the numbered folders)

| Folder | Think of it as |
|---|---|
| `01_FRONTEND_USER_INTERFACE` | Reusable visible pieces (buttons, headers, admin sidebar). |
| `02_BACKEND_SERVER` | The server's helper files (login, database connection, ML plumbing, live alerts). |
| `03_MACHINE_LEARNING_MODELS` | The teacher that trains the brains. |
| `04_DATASET_AND_DATA_PROCESSING` | The examples used for training + product photos. |
| `05_DATABASE` | The database design, how it starts, and reset/cleanup tools. |
| `06_SECURITY_AND_ATTACK_DETECTION` | **The security guard** — the most important folder. |
| `07_CONFIGURATION` | Settings template. |
| `08_LOGS_AND_REPORTS` | The database's own diary. |
| `09_DOCUMENTATION` | Guides (you are reading one). |
| `10_TESTING` | A script that checks the whole project still works (`python 10_TESTING/run_tests.py`). |
| `src/app` | The actual pages and APIs — Next.js forces them to live here. |
