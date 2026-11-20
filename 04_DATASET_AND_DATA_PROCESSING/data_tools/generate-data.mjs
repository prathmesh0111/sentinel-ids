/**
 * SecureMart — realistic data & ML training-corpus generator.
 *
 * Drives 100% REAL HTTP traffic against the running app (same mechanism the
 * old simulator used, but as an offline dev script — the admin panel stays
 * free of any simulation UI):
 *
 *   A. registers real customers, they browse, fill carts and place real orders
 *   B. normal visitors from many countries browse the storefront  → label 0
 *   C. genuine attack traffic (real failed logins, floods, malformed IPs):
 *        C1 brute-force        → BRUTE_FORCE + auto-block          → label 1
 *        C2 credential stuffing→ CREDENTIAL_STUFFING               → label 1
 *        C3 request floods     → DDOS_SUSPECTED / RATE_BURST       → label 1
 *        C4 malformed sources  → INVALID_IP                        → label 1
 *   D. repeat legit logins + extra orders
 *
 * The engine observes every request, weak-supervision-labels IP windows and
 * buffers training samples — afterwards use "Retrain now" (or the retrain API)
 * to train Random Forest + Isolation Forest on this real corpus.
 *
 * Usage:  node scripts/generate-data.mjs
 */
const BASE = 'http://127.0.0.1:3000'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (arr) => arr[rand(0, arr.length - 1)]

// distinct, genuinely routable public IPs so geo resolution is realistic
const CUSTOMER_IPS = [
  '13.126.13.2', '52.96.165.18', '49.36.181.19', '103.21.244.12', '117.99.44.21',
  '182.71.99.108', '49.207.181.164', '115.240.101.32', '103.25.128.19', '14.139.85.203',
]
const VISITOR_IPS = [
  '8.8.8.8', '1.1.1.1', '104.16.132.229', '185.199.108.153', '151.101.65.69',
  '13.107.42.14', '52.78.231.108', '13.228.69.5', '52.215.15.18', '13.77.161.179',
  '20.50.2.152', '172.217.14.99', '104.18.32.47', '34.117.59.81', '92.123.72.30',
  '195.8.215.136', '37.228.107.25', '80.239.155.16', '213.180.204.3', '94.100.180.70',
]
const ATTACKER_IPS = [
  '45.148.10.201', '45.148.121.88', '185.220.101.34', '185.220.102.7', '89.248.167.131',
  '91.219.236.18', '5.188.206.130', '195.133.18.24', '80.94.95.226', '171.25.193.78',
  '104.244.76.13', '162.247.74.217', '193.32.162.145', '46.17.46.100', '185.156.73.54',
  '179.43.167.70', '51.15.43.205', '62.171.177.80', '138.201.8.90', '95.211.230.84',
  '37.49.230.131', '5.2.71.90', '23.129.64.210', '109.70.100.29', '45.154.98.30',
  '176.10.99.200', '82.102.26.150', '193.106.191.25',
]
const MALFORMED_IPS = [
  '999.888.777.666', 'not-an-ip-address', '10.0.0.0.0.0', '300.12.34.1',
  '::ffff:999.1.2.3.4', '1.2..3', 'abc::def::ghi', '192.168.1.999',
]

const CUSTOMERS = [
  { name: 'Aarav Sharma', email: 'aarav.sharma.1996@gmail.com', city: 'Bengaluru', state: 'Karnataka' },
  { name: 'Priya Patel', email: 'priya.patel.official@gmail.com', city: 'Ahmedabad', state: 'Gujarat' },
  { name: 'Rohan Mehta', email: 'rohan.mehta24@yahoo.com', city: 'Mumbai', state: 'Maharashtra' },
  { name: 'Ananya Iyer', email: 'ananya.iyer.cs@outlook.com', city: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Vikram Singh', email: 'vikram.singh.89@gmail.com', city: 'Jaipur', state: 'Rajasthan' },
  { name: 'Sneha Reddy', email: 'sneha.reddy.hyd@gmail.com', city: 'Hyderabad', state: 'Telangana' },
  { name: 'Karan Malhotra', email: 'karan.malhotra@rediffmail.com', city: 'New Delhi', state: 'Delhi' },
  { name: 'Ishita Bose', email: 'ishita.bose.kol@gmail.com', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Arjun Nair', email: 'arjun.nair.kochi@gmail.com', city: 'Kochi', state: 'Kerala' },
  { name: 'Meera Kapoor', email: 'meera.kapoor22@gmail.com', city: 'Lucknow', state: 'Uttar Pradesh' },
]
const PASSWORD = 'Customer@123'

const UA_CUSTOMERS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
]
const UA_ATTACKERS = [
  'curl/8.4.0',
  'python-requests/2.31.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0',
  'Go-http-client/2.0',
]

const stats = { requests: 0, ok: 0, blocked: 0, errors: 0 }

async function req(path, { method = 'GET', body, ip, ua, token, label } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (ip) headers['x-forwarded-for'] = ip
  if (ua) headers['user-agent'] = ua
  if (token) headers['x-session-token'] = token
  stats.requests++
  try {
    const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    stats[r.status === 403 ? 'blocked' : 'ok'] += r.status === 403 ? 1 : 0
    const text = await r.text()
    try { return { status: r.status, json: JSON.parse(text) } } catch { return { status: r.status, json: null } }
  } catch {
    stats.errors++
    return { status: 0, json: null }
  }
}

async function registerAll() {
  console.log(`[A] registering ${CUSTOMERS.length} real customers…`)
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i]
    const r = await req('/api/auth/register', {
      method: 'POST', ip: CUSTOMER_IPS[i], ua: pick(UA_CUSTOMERS),
      body: { name: c.name, email: c.email, password: PASSWORD },
    })
    if (r.status === 201 || (r.json && r.json.user)) console.log(`    + ${c.email} (${c.city})`)
    else console.log(`    ! ${c.email}: ${r.status} ${JSON.stringify(r.json)?.slice(0, 80)}`)
    await sleep(300)
  }
}

async function login(email, password, ip, ua) {
  const r = await req('/api/auth/login', { method: 'POST', ip, ua, body: { email, password } })
  return r.json?.sessionToken ?? null
}

async function customerJourney(idx, c, products, ordersTarget) {
  const ip = CUSTOMER_IPS[idx]
  const ua = UA_CUSTOMERS[idx % UA_CUSTOMERS.length]
  const token = await login(c.email, PASSWORD, ip, ua)
  if (!token) { console.log(`    ! login failed for ${c.email}`); return }

  // realistic browse: home, products, a few product pages
  const views = rand(6, 12)
  for (let v = 0; v < views; v++) {
    await req(pick(['/', '/api/products', `/product/${pick(products).id}`]), { ip, ua, token })
    await sleep(rand(250, 900))
  }
  // cart + checkout
  for (let o = 0; o < ordersTarget; o++) {
    const cart = []
    for (let k = 0; k < rand(1, 3); k++) {
      const p = pick(products)
      if (cart.includes(p.id)) continue
      cart.push(p.id)
      await req('/api/cart', { method: 'POST', ip, ua, token, body: { productId: p.id, quantity: rand(1, 2) } })
      await sleep(rand(200, 600))
    }
    const r = await req('/api/orders', {
      method: 'POST', ip, ua, token,
      body: {
        fullName: c.name, phone: `9${rand(100000000, 999999999)}`,
        addressLine: `${rand(1, 200)} ${pick(['MG Road', 'Park Street', 'Sector 15', 'Gandhi Nagar', 'Lake View Ave'])}`,
        city: c.city, state: c.state, pincode: `${rand(110001, 799999)}`,
        paymentMethod: pick(['COD', 'UPI', 'Card']),
      },
    })
    console.log(r.status === 200 || r.status === 201 ? `    🛒 ${c.name} placed order (${r.json?.order?.status})` : `    ! order failed ${r.status}: ${JSON.stringify(r.json)?.slice(0, 90)}`)
    // clear cart implicitly by checkout; small pause between orders
    await sleep(rand(400, 900))
  }
}

async function phaseA(products) {
  await registerAll()
  console.log('[A] customers browse & place real orders…')
  for (let i = 0; i < CUSTOMERS.length; i++) {
    await customerJourney(i, CUSTOMERS[i], products, rand(1, 2))
  }
}

async function phaseB(products) {
  console.log(`[B] ${VISITOR_IPS.length} normal visitors browsing (label 0 corpus)…`)
  const rounds = 2
  await Promise.all(VISITOR_IPS.map(async (ip, i) => {
    const ua = UA_CUSTOMERS[i % UA_CUSTOMERS.length]
    for (let r = 0; r < rounds; r++) {
      // ≥10 requests per minute per IP keeps windows 'meaningful' but calm
      for (let k = 0; k < 11; k++) {
        await req(pick(['/', '/api/products', `/product/${pick(products).id}`, '/api/me']), { ip, ua })
        await sleep(rand(700, 1600))
      }
      await sleep(25_000) // gap so a second sample falls in a new 30s window
    }
  }))
}

async function phaseC1() {
  console.log('[C1] brute-force bursts from 12 attacker IPs (label 1 + auto-block)…')
  await Promise.all(ATTACKER_IPS.slice(0, 12).map(async (ip, i) => {
    const ua = UA_ATTACKERS[i % UA_ATTACKERS.length]
    const target = CUSTOMERS[i % CUSTOMERS.length].email
    for (let k = 0; k < 15; k++) {
      await req('/api/auth/login', {
        method: 'POST', ip, ua,
        body: { email: k % 3 === 0 ? target : `user${rand(1000, 9999)}@mail.com`, password: `Wrong${rand(10000, 99999)}!` },
      })
      await sleep(rand(150, 500))
    }
  }))
}

async function phaseC2() {
  console.log('[C2] credential stuffing — many usernames from 6 IPs…')
  await Promise.all(ATTACKER_IPS.slice(12, 18).map(async (ip, i) => {
    const ua = UA_ATTACKERS[(i + 1) % UA_ATTACKERS.length]
    for (let k = 0; k < 10; k++) {
      await req('/api/auth/login', {
        method: 'POST', ip, ua,
        body: { email: `${pick(['rahul', 'priya', 'amit', 'sara', 'john', 'inbox', 'test', 'admin', 'info', 'sales'])}${rand(10, 999)}@${pick(['gmail.com', 'yahoo.com', 'outlook.com'])}`, password: `Pass${rand(1000, 9999)}` },
      })
      await sleep(rand(400, 900))
    }
  }))
}

async function phaseC3(products) {
  console.log('[C3] request floods from 6 IPs (DDoS/rate-burst detectors)…')
  await Promise.all(ATTACKER_IPS.slice(18, 24).map(async (ip, i) => {
    const ua = UA_ATTACKERS[(i + 2) % UA_ATTACKERS.length]
    const bursts = 3
    for (let b = 0; b < bursts; b++) {
      const batch = Array.from({ length: 45 }, (_, k) =>
        req('/api/products?page=' + k, { ip, ua }))
      await Promise.all(batch)
      await sleep(4_000)
    }
  }))
}

async function phaseC4() {
  console.log('[C4] malformed source IPs (invalid-IP detector)…')
  await Promise.all(MALFORMED_IPS.map(async (bad, i) => {
    const ua = UA_ATTACKERS[i % UA_ATTACKERS.length]
    for (let k = 0; k < 6; k++) {
      await req('/api/products', { ip: bad, ua })
      await sleep(rand(600, 1200))
    }
  }))
}

async function phaseD(products) {
  console.log('[D] repeat legit logins + a few more orders…')
  for (let i = 0; i < 5; i++) {
    const c = CUSTOMERS[(i * 2) % CUSTOMERS.length]
    await customerJourney((i * 2) % CUSTOMER_IPS.length, c, products, 1)
    await sleep(1_500)
  }
}

async function main() {
  const started = Date.now()
  const health = await req('/')
  if (health.status !== 200) {
    console.error('App is not running on ' + BASE + ' — start SecureMart first.')
    process.exit(1)
  }
  const cat = await req('/api/products')
  const products = cat.json?.products ?? []
  if (!products.length) { console.error('No products in catalog.'); process.exit(1) }
  console.log(`catalog: ${products.length} products — starting realistic traffic\n`)

  await phaseA(products)
  console.log()
  await Promise.all([
    phaseB(products).then(() => console.log('    [B] done')),
    (async () => { await sleep(8_000); await phaseC1(); await sleep(3_000); await phaseC2(); await sleep(3_000); await phaseC3(products); await sleep(2_000); await phaseC4() })().then(() => console.log('    [C] done')),
  ])
  console.log()
  await phaseD(products)

  console.log(`\n—— traffic generation complete in ${Math.round((Date.now() - started) / 1000)}s —–`)
  console.log(`requests: ${stats.requests} (ok ${stats.ok}, blocked ${stats.blocked}, errors ${stats.errors})`)
  console.log('The engine buffers samples on a 30s-per-IP cadence — wait ~30s, then retrain via the admin API/UI.')
}

main().catch((e) => { console.error(e); process.exit(1) })
