/**
 * Final label-0 banking round: each customer logs in from their established
 * home IP (one stable IP per customer — real returning-customer pattern) and
 * browses storefront APIs across 3 spaced windows → ~30 clean label-0 samples.
 * Small attack top-up keeps label-1 fresh. Then retrain for the final model.
 */
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const BASE = 'http://127.0.0.1:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (arr) => arr[rand(0, arr.length - 1)]

const CUSTOMER_IPS = [
  '13.126.13.2', '52.96.165.18', '49.36.181.19', '103.21.244.12', '117.99.44.21',
  '182.71.99.108', '49.207.181.164', '115.240.101.32', '103.25.128.19', '14.139.85.203',
]
const CUSTOMERS = [
  ['aarav.sharma.1996@gmail.com', 'Customer@123'],
  ['priya.patel.official@gmail.com', 'Customer@123'],
  ['rohan.mehta24@yahoo.com', 'Customer@123'],
  ['ananya.iyer.cs@outlook.com', 'Customer@123'],
  ['vikram.singh.89@gmail.com', 'Customer@123'],
  ['sneha.reddy.hyd@gmail.com', 'Customer@123'],
  ['karan.malhotra@rediffmail.com', 'Customer@123'],
  ['ishita.bose.kol@gmail.com', 'Customer@123'],
  ['arjun.nair.kochi@gmail.com', 'Customer@123'],
  ['meera.kapoor22@gmail.com', 'Customer@123'],
]
const BF_IPS = ['45.148.16.230', '185.220.106.13', '89.248.171.135', '91.219.240.22', '5.188.210.134', '195.133.22.28']
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
]

let cookie = ''
async function admin(path) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie } })
  return r.json().catch(() => null)
}

async function main() {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@securemart.in', password: 'AdminPass#2026' }),
  })
  cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')

  const products = (await (await fetch(BASE + '/api/products')).json()).products
  console.log('final round: 10 customers × 3 home-IP windows (label 0) + 6 slow brute-force IPs')

  const attacks = (async () => {
    await sleep(25_000)
    await Promise.all(BF_IPS.map(async (ip, i) => {
      const ua = 'python-requests/2.31.0'
      const target = CUSTOMERS[i % CUSTOMERS.length][0]
      for (let k = 0; k < 9; k++) {
        await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': ua }, body: JSON.stringify({ email: k % 2 ? target : `bf${rand(1000, 9999)}@mail.com`, password: `brute${rand(10000, 99999)}!` }) })
        await sleep(rand(1800, 3000))
      }
    }))
  })()

  const sessions = Promise.all(CUSTOMERS.map(async ([email, password], ci) => {
    const ip = CUSTOMER_IPS[ci]
    const ua = UAS[ci % UAS.length]
    const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': ua }, body: JSON.stringify({ email, password }) })
    if (!r.ok) { console.log(`  ! login failed ${email}`); return }
    for (let w = 0; w < 3; w++) {
      for (let k = 0; k < 13; k++) {
        await fetch(BASE + pick(['/api/products', '/api/products?sort=rating', '/api/me', `/api/products?q=${encodeURIComponent(pick(products).brand)}`]), { headers: { 'x-forwarded-for': ip, 'user-agent': ua } })
        await sleep(rand(400, 900))
      }
      if (w < 2) await sleep(42_000)
    }
  }))

  await Promise.all([sessions, attacks])
  await sleep(12_000)
  const re = await admin('/api/admin/models/retrain')
  console.log('retrain:', JSON.stringify(re)?.slice(0, 160))
  const rows = await p.trainingSample.groupBy({ by: ['label'], _count: { _all: true } })
  const get = (l) => rows.find((r) => r.label === l)?._count._all ?? 0
  console.log(`corpus: attack ${get(1)}, normal ${get(0)}, total ${await p.trainingSample.count()}`)
  const arts = await p.modelArtifact.findMany({ where: { active: true }, select: { kind: true, version: true, metrics: true } })
  for (const a of arts) console.log(`${a.kind} v${a.version}:`, JSON.stringify(a.metrics).slice(0, 400))
  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
