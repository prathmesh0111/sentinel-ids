// Extract the first successful image URL per product from search JSONs → products-images.json
import fs from 'node:fs'
import path from 'node:path'

const dir = '/home/z/my-project/ml/img'
const out = {}
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue
  const key = f.replace('.json', '')
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (j.success && j.results && j.results.length > 0) {
      out[key] = j.results.map(r => r.original_url)
    } else {
      out[key] = []
    }
  } catch (e) { out[key] = [] }
}
fs.writeFileSync('/home/z/my-project/ml/products-images.json', JSON.stringify(out, null, 2))
const missing = Object.entries(out).filter(([, v]) => v.length === 0)
console.log('products with images:', Object.keys(out).length, '| missing:', missing.map(([k]) => k).join(',') || 'none')
