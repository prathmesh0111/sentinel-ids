# Real-World Security Testing Guide — Sentinel IDS

Everything in this guide uses **real networks, real devices, real VPNs and real
attacks** — no simulation, no fake data. The detection engine only learns from
genuine traffic, so the tests genuinely feed it.

Requirements before starting:

- The app running (`run_application.bat`) — note your PC's LAN IP
  (`ipconfig` → IPv4 Address, e.g. `192.168.1.20`)
- A smartphone (for LAN + mobile-data tests)
- A free VPN account (ProtonVPN / Windscribe — real VPN exits, real countries)
- Optional, for the full public-internet test: Cloudflare Tunnel (`cloudflared`)

---

## 1. Location-spoofing detection (impossible travel) — real VPN test

The engine compares every successful login of an account with the previous one
and computes **velocity = distance / hours** between the two logins:

- Rule R1 — distance > 500 km **and** velocity > 700 km/h → CRITICAL
- Rule R2 — distance > 100 km **and** velocity > 900 km/h → CRITICAL
  (catches short-distance jumps minutes apart that R1's distance gate would miss)

### Steps

1. On your PC (normal connection), **register** an account, e.g.
   `traveler@test.com`, and log in once. This pins the account to your real
   location (the first login record).
2. Install a **real free VPN** (ProtonVPN or Windscribe) on the same PC.
3. Connect the VPN to a **distant country** (US, Japan, Australia — 5,000+ km
   away is ideal).
4. Wait **2–3 minutes** (keep the time gap short — that is what makes travel
   impossible), then log in to the **same account** again through the VPN.
5. Open `/admin` → Live Monitor: a **CRITICAL GEO_JUMP — "Impossible travel"**
   event appears, showing the distance in km, the minutes since the previous
   login, and the implied velocity in km/h.

Why it is real: the VPN exit gives you a genuinely different public IP in a
genuinely different country; ip-api resolves both locations; the velocity math
is computed from the real clock delta between the two logins.

> Note: the geo comparison needs public IPs (a VPN exit is one). Private
> addresses cannot be geo-located by anyone — that is physics, not a limitation
> of the product.

## 2. VPN / datacenter-exit detection — real VPN test

1. Keep the VPN **connected** (from test 1).
2. Browse the storefront: home page, a few product pages.
3. Open `/admin` → **IP Ledger** → find the VPN exit IP.
4. Its signal breakdown shows **vpn_hosting** — the engine recognised the
   exit's ISP (most commercial VPNs run on datacenter networks such as M247,
   Datacamp, DigitalOcean, OVH — matched against a keyword list, since
   free geo-APIs do not expose a paid "proxy" flag).
5. Watch the risk score: a VPN alone raises attention (it is not an attack),
   but combined with failed logins or bursts it pushes the source toward the
   block threshold faster.

## 3. Auto-block — real attacker from the real internet (Cloudflare Tunnel)

This proves the full kill-chain over the genuine internet with real public IPs.

1. Install cloudflared (single binary) and run:
   `cloudflared tunnel --url http://localhost:3000`
   → it prints a temporary public URL like `https://xyz.trycloudflare.com`.
2. On your **phone, with WiFi OFF (mobile data only)** — a genuinely different
   network and public IP — open that URL.
3. Try to sign in **10–12 times with wrong passwords** (vary the usernames like
   an attacker would).
4. Within seconds the phone starts receiving **HTTP 403** responses.
5. On your PC open `/admin` → IP Ledger: your phone's real public IP is
   **BLOCKED** — auto-blocked by the engine the moment its risk crossed 80 —
   with the full signal breakdown recorded. The Credential Ledger shows every
   attempt.
6. (Cleanup) Unblock the phone from Access Control, or it stays blocked for
   that IP.

## 4. LAN test — real second device, no internet tooling

1. Phone on the **same WiFi**, browse `http://<your-PC-LAN-IP>:3000`.
2. Fire wrong-password attempts at the login page (10+ times).
3. The phone's private IP is tracked, watchlisted and can be blocked — every
   attempt visible in the Credential Ledger in realtime.
4. Meanwhile your own PC keeps working: the server's own address
   (`127.0.0.1` / `::1`) is **exempt from auto-block** — the engine flags and
   watchlists it but can never lock the operator out (and the Access Control
   page refuses to block it manually).

## 5. Self-protection proof (why your console can no longer lock you out)

Earlier versions allowed the server's own address to be blocked (manually or
by a risk spike), which 403'd the entire machine — including the page needed
to undo it. Now:

- The gate never enforces the blocklist against loopback addresses.
- The engine never auto-blocks loopback (risk is still computed and shown).
- The Access Control API refuses manual loopback blocks with a clear message.

Try it: in Access Control, type `127.0.0.1` and press Block — the API refuses
with: *"this server's own address… refused."*

---

## What each detector proves (summary table)

| Test | Detector exercised | Where to see the result |
|---|---|---|
| VPN far-country login | Impossible travel (R1/R2 velocity math) | Live Monitor → CRITICAL event |
| VPN browsing | VPN/hosting-exit signal | IP Ledger → vpn_hosting in signals |
| Phone brute force via tunnel | Brute-force + auto-block + 403 enforcement | IP Ledger BLOCKED + Credential Ledger |
| Phone brute force via LAN | Same, on private ranges | IP Ledger + Credential Ledger |
| Heavy local browsing | Loopback exemption | Loopback never BLOCKED, at most WATCHLIST |
