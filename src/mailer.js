// Minimal, provider-agnostic mailer. Sends real email ONLY when a provider is
// configured via env (RESEND_API_KEY + MAIL_FROM); otherwise it logs the link so
// invitations still work in dev / before a provider is set up. Never throws — a
// mail failure must not break the surrounding request; callers always also return
// the invite link so the admin can share it manually.

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const MAIL_FROM      = process.env.MAIL_FROM || ''

export function mailerConfigured() {
  return Boolean(RESEND_API_KEY && MAIL_FROM)
}

async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function sendInviteEmail({ to, link, orgName, role, inviterName }) {
  const roleLabel = role === 'admin' ? 'beheerder' : 'kassamedewerker'
  const subject = `Uitnodiging voor ${orgName}`
  const intro   = inviterName ? `${inviterName} nodigt je uit` : 'Je bent uitgenodigd'
  const text =
    `${intro} om als ${roleLabel} deel te nemen aan "${orgName}".\n\n` +
    `Accepteer je uitnodiging via onderstaande link:\n${link}\n\n` +
    `Deze link verloopt over 14 dagen.`
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1a1a1a">` +
    `<p>${intro} om als <strong>${roleLabel}</strong> deel te nemen aan <strong>${orgName}</strong>.</p>` +
    `<p><a href="${link}" style="display:inline-block;background:#2E6B4E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Uitnodiging accepteren</a></p>` +
    `<p style="font-size:13px;color:#666">Of kopieer deze link: <br>${link}</p>` +
    `<p style="font-size:12px;color:#999">Deze link verloopt over 14 dagen.</p></div>`

  if (!mailerConfigured()) {
    console.log(`✉️  [mailer niet geconfigureerd] uitnodiging voor ${to}: ${link}`)
    return { sent: false }
  }
  try {
    await sendViaResend({ to, subject, html, text })
    return { sent: true }
  } catch (err) {
    console.error('✉️  verzenden uitnodiging mislukt:', err.message)
    return { sent: false, error: err.message }
  }
}
