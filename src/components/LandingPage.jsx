import { useState, useEffect, useRef } from 'react'
import {
  Check, ArrowRight, Monitor, Percent, BarChart3, Users, Grid3x3, WifiOff,
} from 'lucide-react'
import { PLANS } from '../plans'
import '../landing.css'

/* Marketing copy lives here (bilingual) so it stays out of the app's i18n
   dictionaries — same convention as plans.js. */
const COPY = {
  nl: {
    nav:        ['Functies', 'Zo begin je', 'Prijzen'],
    login:      'Inloggen',
    start:      'Gratis beginnen',
    kicker:     'De kassa voor verenigingen',
    h1a:        'Een kassa die klaarstaat',
    h1b:        'voor de club.',
    lead:       'Tappy is de kassa voor pannenkoekenacties, clubavonden en kampvuren. Richt ’m in een paar minuten in, reken af op de telefoon die je al hebt, en zie precies wat de actie opbracht.',
    ctaStart:   'Gratis beginnen',
    ctaLogin:   'Ik heb al een account',
    ticks:      ['Gratis te proberen', 'Geen pinautomaat nodig', 'Werkt op telefoon en tablet'],
    bon: {
      org: 'Scouting St. Martinus', sub: 'Pannenkoekenactie 2026',
      rows: [
        { q: '5×', nm: 'Pannenkoek', amt: '€ 12,50' },
        { q: '',   nm: 'Elke 5e gratis', amt: '− € 2,50', promo: true },
        { q: '3×', nm: 'Limonade',   amt: '€ 4,50' },
        { q: '2×', nm: 'Koffie',     amt: '€ 4,00' },
      ],
      total: 'Totaal', totalAmt: '€ 18,50', foot: 'Bedankt — tot de volgende keer!', stamp: 'Betaald',
    },
    featEyebrow: 'Wat Tappy doet',
    featH2:      'Alles wat je achter de kraam nodig hebt.',
    featSub:     'Geen handleiding nodig. De knoppen zijn groot, de bonnen kloppen, en aan het eind van de dag weet je precies hoeveel er in de kas zit.',
    features: [
      { Icon: Monitor, h: 'Reken af op elk scherm', p: 'Telefoon, tablet of laptop. Zet er een klantenscherm bij zodat gasten meekijken.' },
      { Icon: Percent, h: 'Acties die vanzelf kloppen', p: '“Elke 5e gratis”, combodeals en kortingen rekent Tappy automatisch door op de bon.' },
      { Icon: BarChart3, h: 'Zie de opbrengst live', p: 'Per categorie en per dag, met een nette kasafsluiting als de kraam dichtgaat.' },
      { Icon: Users, h: 'Samen achter de kraam', p: 'Nodig je team uit. Iedereen rekent af met een eigen pincode, jij houdt overzicht.' },
      { Icon: Grid3x3, h: 'Eigen producten en knoppen', p: 'Van pannenkoek tot polsbandje — jij bepaalt de categorieën, prijzen en kleuren.' },
      { Icon: WifiOff, h: 'Hapert de wifi? Geen punt', p: 'Tappy blijft gewoon doorgaan als het netwerk op het terrein even wegvalt.' },
    ],
    stepEyebrow: 'Zo begin je',
    stepH2:      'Van aanmelden tot afrekenen in een paar minuten.',
    steps: [
      { h: 'Maak een gratis account', p: 'Alleen een e-mailadres en de naam van je vereniging. Klaar.' },
      { h: 'Richt je kassa in', p: 'De setup-wizard helpt je met categorieën en producten voor jouw actie.' },
      { h: 'Open de kraam', p: 'Deel een pincode uit aan je team en begin met afrekenen.' },
    ],
    priceEyebrow: 'Prijzen',
    priceH2:      'Begin gratis. Groei mee als je vaker verkoopt.',
    priceCta:     'Kies dit plan',
    priceCtaFree: 'Gratis beginnen',
    priceNote:    'Je start altijd gratis en zit nergens aan vast. Betaalde plannen zijn in de maak — de prijzen hier zijn indicatief.',
    ctaH2:        'Klaar voor de volgende actie?',
    ctaLead:      'Maak vandaag een gratis account en zet je kassa klaar voor het volgende evenement.',
    ctaBtn:       'Gratis account maken',
    footFine:     'Gemaakt voor verenigingen in Nederland.',
  },
  en: {
    nav:        ['Features', 'How to start', 'Pricing'],
    login:      'Log in',
    start:      'Start for free',
    kicker:     'The till for clubs & volunteers',
    h1a:        'A till that’s ready',
    h1b:        'when the club is.',
    lead:       'Tappy is the till for bake sales, club nights and camp fires. Set it up in a few minutes, take payment on the phone you already have, and see exactly what the event brought in.',
    ctaStart:   'Start for free',
    ctaLogin:   'I already have an account',
    ticks:      ['Free to try', 'No card terminal needed', 'Works on phone and tablet'],
    bon: {
      org: 'Scouting St. Martinus', sub: 'Pancake fundraiser 2026',
      rows: [
        { q: '5×', nm: 'Pancake',   amt: '€ 12.50' },
        { q: '',   nm: 'Every 5th free', amt: '− € 2.50', promo: true },
        { q: '3×', nm: 'Lemonade',  amt: '€ 4.50' },
        { q: '2×', nm: 'Coffee',    amt: '€ 4.00' },
      ],
      total: 'Total', totalAmt: '€ 18.50', foot: 'Thanks — see you next time!', stamp: 'Paid',
    },
    featEyebrow: 'What Tappy does',
    featH2:      'Everything you need behind the stall.',
    featSub:     'No manual required. The buttons are big, the receipts add up, and at the end of the day you know exactly what’s in the till.',
    features: [
      { Icon: Monitor, h: 'Ring up on any screen', p: 'Phone, tablet or laptop. Add a customer display so guests can follow along.' },
      { Icon: Percent, h: 'Promotions that just add up', p: '“Every 5th free”, combo deals and discounts are applied to the receipt automatically.' },
      { Icon: BarChart3, h: 'See takings live', p: 'By category and by day, with a tidy cash-up when the stall closes.' },
      { Icon: Users, h: 'Run it together', p: 'Invite your team. Everyone rings up with their own PIN, you keep the overview.' },
      { Icon: Grid3x3, h: 'Your products, your buttons', p: 'From pancakes to wristbands — you set the categories, prices and colours.' },
      { Icon: WifiOff, h: 'Wi-Fi drops out? No problem', p: 'Tappy keeps going when the network on the field cuts out for a moment.' },
    ],
    stepEyebrow: 'How to start',
    stepH2:      'From sign-up to first sale in a few minutes.',
    steps: [
      { h: 'Create a free account', p: 'Just an email and your club’s name. That’s it.' },
      { h: 'Set up your till', p: 'The setup wizard walks you through categories and products for your event.' },
      { h: 'Open the stall', p: 'Hand your team a PIN and start ringing up sales.' },
    ],
    priceEyebrow: 'Pricing',
    priceH2:      'Start free. Grow with us when you sell more often.',
    priceCta:     'Choose this plan',
    priceCtaFree: 'Start for free',
    priceNote:    'You always start free with no strings attached. Paid plans are on the way — the prices here are indicative.',
    ctaH2:        'Ready for the next event?',
    ctaLead:      'Create a free account today and get your till ready for the next event.',
    ctaBtn:       'Create a free account',
    footFine:     'Made for clubs and volunteers.',
  },
}

const REGISTER_URL = '/app?register=1'
const LOGIN_URL = '/app?login=1'

export default function LandingPage() {
  const [lang, setLang] = useState(() => (localStorage.getItem('kassa_lang') === 'en' ? 'en' : 'nl'))
  const c = COPY[lang]
  const navHrefs = ['#functies', '#starten', '#prijzen']
  const rootRef = useRef(null)

  function pick(l) { setLang(l); localStorage.setItem('kassa_lang', l) }

  // Reveal elements as they scroll into view — once each, then stop observing.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll('.lp-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(el => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lp" ref={rootRef}>
      {/* ── Header ── */}
      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a href="#top" aria-label="Tappy"><img className="lp-logo" src="/tappy-pos.png" alt="Tappy" /></a>
          <nav className="lp-nav">
            <div className="lp-nav-links">
              {c.nav.map((label, i) => <a key={label} href={navHrefs[i]}>{label}</a>)}
            </div>
            <div className="lp-langswitch" role="group" aria-label="Language">
              <button className={lang === 'nl' ? 'on' : ''} onClick={() => pick('nl')}>NL</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => pick('en')}>EN</button>
            </div>
            <a href={LOGIN_URL} className="lp-btn lp-btn-ghost lp-btn-sm">{c.login}</a>
            <a href={REGISTER_URL} className="lp-btn lp-btn-pine lp-btn-sm">{c.start}</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero" id="top">
        <div className="lp-wrap lp-hero-in">
          <div>
            <span className="lp-kicker lp-anim lp-anim-1">🏕️ {c.kicker}</span>
            <h1 className="lp-h1 lp-anim lp-anim-1">{c.h1a}<br /><span className="soft">{c.h1b}</span></h1>
            <p className="lp-lead lp-anim lp-anim-2">{c.lead}</p>
            <div className="lp-cta-row lp-anim lp-anim-2">
              <a href={REGISTER_URL} className="lp-btn lp-btn-primary">{c.ctaStart} <ArrowRight size={18} /></a>
              <a href={LOGIN_URL} className="lp-btn lp-btn-onpine">{c.ctaLogin}</a>
            </div>
            <div className="lp-ticks lp-anim lp-anim-3">
              {c.ticks.map(t => <span key={t} className="lp-tick"><Check size={16} /> {t}</span>)}
            </div>
          </div>

          <div className="lp-bon-stage">
            <div className="lp-bon" role="img" aria-label={`${c.bon.org} — ${c.bon.total} ${c.bon.totalAmt}`}>
              <div className="lp-bon-head">
                <div className="lp-bon-org">{c.bon.org}</div>
                <div className="lp-bon-sub">{c.bon.sub}</div>
              </div>
              {c.bon.rows.map((r, i) => (
                <div className={`lp-bon-row${r.promo ? ' lp-bon-promo' : ''}`} key={i} style={{ '--line': i + 1 }}>
                  <span className="q">{r.q}</span>
                  <span className="nm">{r.nm}</span>
                  <span className="amt">{r.amt}</span>
                </div>
              ))}
              <hr className="lp-bon-rule" />
              <div className="lp-bon-total">
                <span className="lab">{c.bon.total}</span>
                <span className="val">{c.bon.totalAmt}</span>
              </div>
              <div className="lp-bon-foot">{c.bon.foot}</div>
              <span className="lp-stamp">{c.bon.stamp}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="functies">
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <p className="lp-eyebrow">{c.featEyebrow}</p>
            <h2 className="lp-h2">{c.featH2}</h2>
            <p className="lp-h2-sub">{c.featSub}</p>
          </div>
          <div className="lp-features">
            {c.features.map(({ Icon, h, p }, i) => (
              <div className="lp-feat lp-reveal" key={h} style={{ '--i': i % 2 }}>
                <span className="lp-feat-ico"><Icon size={22} strokeWidth={1.9} /></span>
                <div>
                  <h3 className="lp-feat-h">{h}</h3>
                  <p className="lp-feat-p">{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Steps ── */}
      <section className="lp-steps-band lp-section" id="starten">
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <p className="lp-eyebrow">{c.stepEyebrow}</p>
            <h2 className="lp-h2">{c.stepH2}</h2>
          </div>
          <div className="lp-steps">
            {c.steps.map((s, i) => (
              <div className="lp-step lp-reveal" key={s.h} style={{ '--i': i }}>
                <span className="lp-step-n">{i + 1}</span>
                <h3 className="lp-step-h">{s.h}</h3>
                <p className="lp-step-p">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section" id="prijzen">
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <p className="lp-eyebrow">{c.priceEyebrow}</p>
            <h2 className="lp-h2">{c.priceH2}</h2>
          </div>
          <div className="lp-prices lp-reveal">
            {PLANS.map((plan) => {
              const hot = plan.highlight
              return (
                <div className={`lp-price${hot ? ' lp-price-hot' : ''}`} key={plan.id}>
                  {hot && <span className="lp-price-tag">{lang === 'nl' ? 'Populair' : 'Popular'}</span>}
                  <div className="lp-price-name">{plan.name[lang]}</div>
                  <p className="lp-price-tagline">{plan.tagline[lang]}</p>
                  <div className="lp-price-amt">
                    <span className="n">{plan.price[lang]}</span>
                    <span className="per">{plan.period[lang]}</span>
                  </div>
                  <ul>
                    {plan.features[lang].map(f => (
                      <li key={f}><Check size={17} /> <span>{f}</span></li>
                    ))}
                  </ul>
                  <a href={REGISTER_URL} className={`lp-btn ${hot ? 'lp-btn-primary' : 'lp-btn-ghost'}`}>
                    {plan.id === 'free' ? c.priceCtaFree : c.priceCta}
                  </a>
                </div>
              )
            })}
          </div>
          <p className="lp-price-note lp-reveal">{c.priceNote}</p>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="lp-cta lp-section-tight">
        <div className="lp-wrap lp-reveal">
          <h2 className="lp-h2">{c.ctaH2}</h2>
          <p className="lp-cta-lead">{c.ctaLead}</p>
          <a href={REGISTER_URL} className="lp-btn lp-btn-primary">{c.ctaBtn} <ArrowRight size={18} /></a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <img className="lp-logo" src="/tappy-pos.png" alt="Tappy" style={{ height: 26, filter: 'brightness(0) invert(1)', opacity: .9 }} />
          <div className="lp-footer-links">
            <a href="#functies">{c.nav[0]}</a>
            <a href="#prijzen">{c.nav[2]}</a>
            <a href={LOGIN_URL}>{c.login}</a>
            <a href={REGISTER_URL}>{c.start}</a>
          </div>
          <span className="lp-footer-fine">© {new Date().getFullYear()} Tappy — {c.footFine}</span>
        </div>
      </footer>
    </div>
  )
}
