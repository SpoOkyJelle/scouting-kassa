// Koppelt een SumUp-lezer aan je merchant-account voor de Cloud/Readers-API.
// Je hebt een PAIRING-CODE nodig die je op de lezer zelf opvraagt:
//   Solo → Instellingen → Verbindingen / Integraties → pairing-code (±8-9 tekens)
//
// Gebruik (PowerShell):
//   $env:SUMUP_API_KEY = "sup_sk_PLAK_HIER_JE_TOKEN"
//   node scripts/pair-sumup-reader.mjs <PAIRING_CODE> "Kassa voor"
//
// Draai daarna list-sumup-readers.mjs om het reader_id op te halen.

const SUMUP_API = 'https://api.sumup.com'

const API_KEY = process.env.SUMUP_API_KEY
const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE || 'MARMZ18X'
const pairingCode = process.argv[2]
const name = process.argv[3] || 'Kassa'

if (!API_KEY) {
  console.error('❌ Zet eerst je token: $env:SUMUP_API_KEY = "sup_sk_..."')
  process.exit(1)
}
if (!pairingCode) {
  console.error('❌ Geef de pairing-code mee: node scripts/pair-sumup-reader.mjs <PAIRING_CODE> "Naam"')
  process.exit(1)
}

const url = `${SUMUP_API}/v0.1/merchants/${encodeURIComponent(MERCHANT_CODE)}/readers`

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ pairing_code: pairingCode, name }),
})

const body = await res.json().catch(() => ({}))

if (!res.ok) {
  console.error(`❌ SumUp gaf status ${res.status}:`)
  console.error(JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log('✅ Lezer gekoppeld!')
console.log(`   reader_id : ${body.id}`)
console.log(`   naam      : ${body.name}`)
console.log(`   status    : ${body.status}`)
console.log('\nVul dit reader_id in bij je kassa-instellingen.')
