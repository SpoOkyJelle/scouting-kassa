// Haalt alle kaartlezers (readers) op die aan je SumUp-merchant gekoppeld zijn,
// zodat je het reader_id (rdr_...) kunt vinden voor de kassa-configuratie.
//
// Gebruik (PowerShell):
//   $env:SUMUP_API_KEY = "sup_sk_PLAK_HIER_JE_TOKEN"
//   node scripts/list-sumup-readers.mjs
//
// Of in één regel:
//   $env:SUMUP_API_KEY="..."; node scripts/list-sumup-readers.mjs

const SUMUP_API = 'https://api.sumup.com'

const API_KEY = process.env.SUMUP_API_KEY
const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE || 'MARMZ18X'

if (!API_KEY) {
  console.error('❌ Zet eerst je token: $env:SUMUP_API_KEY = "sup_sk_..."')
  process.exit(1)
}

const url = `${SUMUP_API}/v0.1/merchants/${encodeURIComponent(MERCHANT_CODE)}/readers`

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${API_KEY}` },
})

const body = await res.json().catch(() => ({}))

if (!res.ok) {
  console.error(`❌ SumUp gaf status ${res.status}:`, body?.message || body?.error_message || body)
  process.exit(1)
}

// SumUp geeft { items: [...] } of een array terug, afhankelijk van de versie.
const readers = Array.isArray(body) ? body : (body.items || body.data || [])

if (!readers.length) {
  console.log('⚠️  Geen readers uit het verwachte veld gehaald.')
  console.log('── Ruwe respons van SumUp: ──')
  console.log(JSON.stringify(body, null, 2))
  process.exit(0)
}

console.log(`\n✅ ${readers.length} reader(s) gevonden voor merchant ${MERCHANT_CODE}:\n`)
for (const r of readers) {
  console.log(`  reader_id : ${r.id}`)
  console.log(`  naam      : ${r.name || '(geen naam)'}`)
  console.log(`  status    : ${r.status || '-'}`)
  console.log(`  device    : ${r.device?.model || r.meta?.model || '-'}`)
  console.log('  ' + '─'.repeat(40))
}
