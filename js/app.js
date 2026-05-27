/* ═══════════════════════════════════════════════
   Scouting Pannenkoekenactie — App Logic
   ═══════════════════════════════════════════════ */

/* ─── CONSTANTEN ─────────────────────────────── */
const TYPES = ['Naturel', 'Stroop', 'Kaas', 'Spek', 'Spek & kaas', 'Suiker'];

/* ─── STATE ──────────────────────────────────── */
let bonnen       = [];
let currentBon   = [];   // [ { type, qty } ]
let selType      = null;
let selQty       = 1;
let activeFilter = 'alle';
let nextNr       = 1;

/* ═══════════════════════════════════════════════
   NAVIGATIE
═══════════════════════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-btn-' + name).classList.add('active');

  if (name === 'bonnen')    renderBonnen();
  if (name === 'overzicht') renderOverzicht();
}

/* ═══════════════════════════════════════════════
   PAGINA 1 · NIEUWE BON
═══════════════════════════════════════════════ */

function renderTypeBtns() {
  document.getElementById('types-grid').innerHTML = TYPES.map(t => `
    <button class="type-btn ${selType === t ? 'active' : ''}" data-type="${escHtml(t)}">
      ${t}
    </button>
  `).join('');

  document.getElementById('types-grid').onclick = e => {
    const btn = e.target.closest('.type-btn');
    if (btn) selectType(btn.dataset.type);
  };
}

function selectType(t) {
  selType = t;
  selQty  = 1;
  document.getElementById('qty-label').textContent  = t;
  document.getElementById('qty-display').textContent = 1;
  document.getElementById('btn-minus').disabled      = true;
  document.getElementById('btn-add-item').disabled   = false;
  renderTypeBtns();
}

function changeQty(delta) {
  selQty = Math.max(1, selQty + delta);
  document.getElementById('qty-display').textContent = selQty;
  document.getElementById('btn-minus').disabled      = selQty <= 1;
}

function addItem() {
  if (!selType) return;

  const type = selType;
  const qty  = selQty;

  const existing = currentBon.find(i => i.type === type);
  if (existing) {
    existing.qty += qty;
  } else {
    currentBon.push({ type, qty });
  }

  selType = null;
  selQty  = 1;
  document.getElementById('qty-label').textContent  = 'Selecteer een soort';
  document.getElementById('qty-display').textContent = 1;
  document.getElementById('btn-minus').disabled      = true;
  document.getElementById('btn-add-item').disabled   = true;

  renderTypeBtns();
  renderCurrentBon();
  toast(`${type} x${qty} toegevoegd`);
}

function removeItem(type) {
  currentBon = currentBon.filter(i => i.type !== type);
  renderCurrentBon();
}

function renderCurrentBon() {
  const itemsEl = document.getElementById('current-items');
  const saveEl  = document.getElementById('save-section');

  if (!currentBon.length) {
    itemsEl.innerHTML = `
      <div class="order-empty">
        <span class="order-empty-line"></span>
        Nog geen items toegevoegd
      </div>`;
    saveEl.style.display = 'none';
    return;
  }

  const total = currentBon.reduce((sum, i) => sum + i.qty, 0);

  itemsEl.innerHTML = currentBon.map(i => `
    <div class="order-item">
      <div class="order-item-name">${i.type}</div>
      <div class="order-item-right">
        <span class="order-item-count">${i.qty}x</span>
        <button class="btn-remove" data-type="${escHtml(i.type)}" title="Verwijder">&#x2715;</button>
      </div>
    </div>
  `).join('');

  itemsEl.onclick = e => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removeItem(btn.dataset.type);
  };

  document.getElementById('bon-subtotal').textContent = total;
  saveEl.style.display = 'block';
}

function saveBon() {
  const naam = document.getElementById('inp-naam').value.trim();

  if (!naam) {
    document.getElementById('inp-naam').focus();
    toast('Vul eerst een naam in');
    return;
  }
  if (!currentBon.length) {
    toast('Voeg eerst pannenkoeken toe');
    return;
  }

  const now      = new Date();
  const tijdstip = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const datum    = now.toLocaleDateString('nl-NL',  { day: '2-digit', month: 'short' });

  const bon = {
    nr:        nextNr++,
    naam,
    opmerking: document.getElementById('inp-opmerking').value.trim(),
    items:     [...currentBon],
    tijdstip:  `${datum} ${tijdstip}`,
    betaald:   false,
    totaal:    currentBon.reduce((sum, i) => sum + i.qty, 0),
  };

  bonnen.unshift(bon);

  currentBon = [];
  document.getElementById('inp-naam').value      = '';
  document.getElementById('inp-opmerking').value = '';
  renderCurrentBon();
  toast(`Bon #${bon.nr} opgeslagen`);
}

/* ═══════════════════════════════════════════════
   PAGINA 2 · BONNEN
═══════════════════════════════════════════════ */

function setFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.f === f)
  );
  renderBonnen();
}

function renderBonnen() {
  const query  = (document.getElementById('inp-search')?.value || '').trim().toLowerCase();
  const listEl = document.getElementById('bonnen-list');

  const filtered = bonnen.filter(b => {
    const matchFilter =
      activeFilter === 'alle'    ? true :
      activeFilter === 'open'    ? !b.betaald :
      activeFilter === 'betaald' ?  b.betaald : true;
    const matchSearch = !query || b.naam.toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-bonnen">
        <span class="empty-bonnen-icon"></span>
        ${bonnen.length ? 'Geen bonnen gevonden' : 'Nog geen bonnen opgeslagen'}
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(b => {
    const statusClass = b.betaald ? 'betaald'      : 'open';
    const badgeClass  = b.betaald ? 'badge-betaald' : 'badge-open';
    const badgeText   = b.betaald ? 'Betaald'       : 'Open';
    const btnClass    = b.betaald ? 'mark-open'      : 'mark-paid';
    const btnText     = b.betaald ? 'Zet op open'    : 'Markeer betaald';

    const itemLines = b.items.map(i => `
      <div class="bon-item-line">
        <span>${i.type}</span>
        <span>${i.qty}x</span>
      </div>
    `).join('');

    return `
      <div class="bon-card ${statusClass}">
        <div class="bon-top">
          <div class="bon-meta">
            <div class="bon-name">${escHtml(b.naam)}</div>
            <div class="bon-sub">Bon #${b.nr} &middot; ${b.tijdstip}</div>
            ${b.opmerking ? `<div class="bon-remark">${escHtml(b.opmerking)}</div>` : ''}
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="bon-items">${itemLines}</div>
        <div class="bon-footer">
          <div class="bon-footer-total">
            <strong>${b.totaal} pannenkoek${b.totaal !== 1 ? 'en' : ''}</strong>
          </div>
          <button class="btn-pay ${btnClass}" onclick="toggleBetaald(${b.nr})">${btnText}</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleBetaald(nr) {
  const bon = bonnen.find(b => b.nr === nr);
  if (!bon) return;

  bon.betaald = !bon.betaald;
  renderBonnen();

  if (document.getElementById('page-overzicht').classList.contains('active')) {
    renderOverzicht();
  }

  toast(bon.betaald ? `Bon #${nr} betaald` : `Bon #${nr} terug op open`);
}

/* ═══════════════════════════════════════════════
   PAGINA 3 · OVERZICHT
═══════════════════════════════════════════════ */
function renderOverzicht() {
  const total = bonnen.length;
  const open  = bonnen.filter(b => !b.betaald).length;
  const paid  = bonnen.filter(b =>  b.betaald).length;

  document.getElementById('s-total').textContent = total;
  document.getElementById('s-open').textContent  = open;
  document.getElementById('s-paid').textContent  = paid;

  const counts = Object.fromEntries(TYPES.map(t => [t, 0]));
  bonnen.forEach(b => b.items.forEach(i => { counts[i.type] += i.qty; }));

  document.getElementById('breakdown-list').innerHTML = TYPES.map(t => `
    <div class="breakdown-row ${counts[t] === 0 ? 'zero' : ''}">
      <span class="breakdown-name">${t}</span>
      <span class="breakdown-count">${counts[t]}</span>
    </div>
  `).join('');

  const grandTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  document.getElementById('grand-total').textContent = grandTotal;
}

/* ═══════════════════════════════════════════════
   HULPFUNCTIES
═══════════════════════════════════════════════ */

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════
   OPSTARTEN
═══════════════════════════════════════════════ */
renderTypeBtns();
renderCurrentBon();
renderBonnen();
renderOverzicht();
