// ─── SumUp Cloud (Terminal / Readers API) ──────────────────────────────────────
// Thin wrapper around SumUp's "Create a Reader Checkout" endpoint. This pushes an
// amount to a physical SumUp card reader that is paired to the merchant account,
// so the customer can tap/insert their card. The call only *starts* the payment:
// SumUp accepts it (HTTP 2xx) and returns a client_transaction_id. Confirmation of
// the actual card payment happens on the reader and via SumUp's webhooks/polling —
// here the cashier confirms completion in the UI once the reader shows success.
//
// Docs: https://developer.sumup.com/api/readers/create-checkout
//       https://developer.sumup.com/terminal-payments/cloud-api/

const SUMUP_API = 'https://api.sumup.com'

// Push a checkout to a reader. Amount is in euros (major units); we convert to the
// minor-unit integer SumUp expects. Throws an Error with a readable message on
// failure so the route can surface it to the cashier.
export async function createReaderCheckout({ apiKey, merchantCode, readerId, amount, currency = 'EUR', description }) {
  if (!apiKey || !merchantCode || !readerId) {
    throw new Error('SumUp is niet volledig geconfigureerd')
  }
  const value = Math.round(Number(amount) * 100)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Ongeldig bedrag voor pinbetaling')
  }

  const url = `${SUMUP_API}/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(readerId)}/checkout`

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        total_amount: { currency, minor_unit: 2, value },
        ...(description ? { description } : {}),
      }),
    })
  } catch (err) {
    throw new Error(`Kan SumUp niet bereiken: ${err.message}`)
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.message || body?.error_message || body?.error || `SumUp gaf status ${res.status}`
    throw new Error(msg)
  }

  // SumUp returns { data: { client_transaction_id } } on success.
  return {
    clientTransactionId: body?.data?.client_transaction_id || body?.client_transaction_id || null,
    raw: body,
  }
}
