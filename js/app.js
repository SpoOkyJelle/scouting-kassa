/* ═══════════════════════════════════════════════
   Scouting Pannenkoekenactie — App Logic
   ═══════════════════════════════════════════════ */

/* ─── STATE ──────────────────────────────────── */
let types        = ['Naturel', 'Stroop', 'Kaas', 'Spek', 'Spek & kaas', 'Suiker'];
let bonnen       = [];
let currentBon   = [];   // [ { type, qty } ]
let activeFilter = 'open';
let nextNr       = 1;
let editingNr    = null;

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
  if (name === 'producten') renderProducten();
}

/* ═══════════════════════════════════════════════
   PAGINA 1 · NIEUWE BON
═══════════════════════════════════════════════ */

function renderTypeBtns() {
  const grid     = document.getElementById('types-grid');
  const hintEl   = document.getElementById('types-hint');

  if (!types.length) {
    grid.innerHTML        = '';
    hintEl.style.display  = 'block';
    return;
  }
  hintEl.style.display = 'none';

  grid.innerHTML = types.map(t => {
    const item = currentBon.find(i => i.type === t);
    const qty  = item ? item.qty : 0;
    return `
      <button class="type-btn ${qty > 0 ? 'has-items' : ''}" data-type="${escHtml(t)}">
        ${escHtml(t)}
        ${qty > 0 ? `<span class="type-count">${qty}</span>` : ''}
      </button>`;
  }).join('');

  grid.onclick = e => {
    const btn = e.target.closest('.type-btn');
    if (btn) addItem(btn.dataset.type);
  };
}

function addItem(type) {
  const existing = currentBon.find(i => i.type === type);
  if (existing) {
    existing.qty += 1;
  } else {
    currentBon.push({ type, qty: 1 });
  }
  renderTypeBtns();
  renderCurrentBon();
}

function decrementItem(type) {
  const item = currentBon.find(i => i.type === type);
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) currentBon = currentBon.filter(i => i.type !== type);
  renderTypeBtns();
  renderCurrentBon();
}

function removeItem(type) {
  currentBon = currentBon.filter(i => i.type !== type);
  renderTypeBtns();
  renderCurrentBon();
}

function renderCurrentBon() {
  const bonCard = document.getElementById('bon-card');
  const itemsEl = document.getElementById('current-items');

  if (!currentBon.length) {
    bonCard.style.display = 'none';
    return;
  }

  bonCard.style.display = 'block';
  const total = currentBon.reduce((sum, i) => sum + i.qty, 0);

  itemsEl.innerHTML = currentBon.map(i => `
    <div class="order-item">
      <div class="order-item-name">${escHtml(i.type)}</div>
      <div class="order-item-controls">
        <button class="btn-decrement" data-type="${escHtml(i.type)}" title="Eén minder">−</button>
        <span class="order-item-count">${i.qty}</span>
        <button class="btn-remove" data-type="${escHtml(i.type)}" title="Verwijder">&#x2715;</button>
      </div>
    </div>
  `).join('');

  itemsEl.onclick = e => {
    const dec = e.target.closest('.btn-decrement');
    const rem = e.target.closest('.btn-remove');
    if (dec) decrementItem(dec.dataset.type);
    if (rem) removeItem(rem.dataset.type);
  };

  document.getElementById('bon-subtotal').textContent = total;
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

  if (editingNr !== null) {
    const bon = bonnen.find(b => b.nr === editingNr);
    if (bon) {
      bon.naam      = naam;
      bon.opmerking = document.getElementById('inp-opmerking').value.trim();
      bon.items     = [...currentBon];
      bon.totaal    = currentBon.reduce((sum, i) => sum + i.qty, 0);
    }
    const nr = editingNr;
    resetEditState();
    toast(`Bon #${nr} bijgewerkt`);
  } else {
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
    resetEditState();
    toast(`Bon #${bon.nr} opgeslagen`);
  }
}

function editBon(nr) {
  const bon = bonnen.find(b => b.nr === nr);
  if (!bon) return;

  editingNr  = nr;
  currentBon = bon.items.map(i => ({ ...i }));

  document.getElementById('inp-naam').value      = bon.naam;
  document.getElementById('inp-opmerking').value = bon.opmerking || '';
  document.getElementById('edit-banner').style.display      = 'flex';
  document.getElementById('edit-banner-text').textContent   = `Bon #${nr} bewerken`;
  document.getElementById('btn-save').textContent           = 'Wijzigingen opslaan';
  document.getElementById('btn-save').classList.add('editing');

  renderTypeBtns();
  renderCurrentBon();
  showPage('nieuw');
}

function cancelEdit() {
  resetEditState();
  toast('Bewerking geannuleerd');
}

function resetEditState() {
  editingNr  = null;
  currentBon = [];
  document.getElementById('inp-naam').value      = '';
  document.getElementById('inp-opmerking').value = '';
  document.getElementById('edit-banner').style.display = 'none';
  document.getElementById('btn-save').textContent      = 'Bon opslaan';
  document.getElementById('btn-save').classList.remove('editing');
  renderTypeBtns();
  renderCurrentBon();
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
        <span>${escHtml(i.type)}</span>
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
          <div class="bon-footer-actions">
            <button class="btn-edit" onclick="editBon(${b.nr})">Bewerk</button>
            <button class="btn-pay ${btnClass}" onclick="toggleBetaald(${b.nr})">${btnText}</button>
          </div>
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

  // Tel alle unieke soorten over alle bonnen (ook verwijderde producten)
  const allTypes = [...new Set([
    ...types,
    ...bonnen.flatMap(b => b.items.map(i => i.type))
  ])];

  const counts = Object.fromEntries(allTypes.map(t => [t, 0]));
  bonnen.forEach(b => b.items.forEach(i => { counts[i.type] += i.qty; }));

  document.getElementById('breakdown-list').innerHTML = allTypes
    .filter(t => counts[t] > 0 || types.includes(t))
    .map(t => `
      <div class="breakdown-row ${counts[t] === 0 ? 'zero' : ''}">
        <span class="breakdown-name">${escHtml(t)}</span>
        <span class="breakdown-count">${counts[t]}</span>
      </div>
    `).join('');

  const grandTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  document.getElementById('grand-total').textContent = grandTotal;
}

/* ═══════════════════════════════════════════════
   PAGINA 4 · PRODUCTEN
═══════════════════════════════════════════════ */

function renderProducten() {
  const listEl = document.getElementById('producten-list');

  if (!types.length) {
    listEl.innerHTML = `<div class="products-empty">Nog geen producten toegevoegd.</div>`;
    return;
  }

  // Tel gebruik in opgeslagen bonnen per product
  const usageCount = Object.fromEntries(types.map(t => [t, 0]));
  bonnen.forEach(b => b.items.forEach(i => {
    if (i.type in usageCount) usageCount[i.type] += i.qty;
  }));

  listEl.innerHTML = types.map(t => {
    const used = usageCount[t] || 0;
    return `
      <div class="product-item">
        <div class="product-item-left">
          <span class="product-name">${escHtml(t)}</span>
          ${used > 0 ? `<span class="product-in-use">${used}x besteld</span>` : ''}
        </div>
        <button class="btn-product-delete" data-type="${escHtml(t)}" title="Verwijder product">
          &#x2715;
        </button>
      </div>
    `;
  }).join('');

  listEl.onclick = e => {
    const btn = e.target.closest('.btn-product-delete');
    if (btn) deleteProduct(btn.dataset.type);
  };
}

function addProduct() {
  const inp  = document.getElementById('inp-product');
  const naam = inp.value.trim();

  if (!naam) {
    inp.focus();
    toast('Vul een productnaam in');
    return;
  }

  // Duplicaat check (hoofdletterongevoelig)
  if (types.some(t => t.toLowerCase() === naam.toLowerCase())) {
    toast('Dit product bestaat al');
    inp.select();
    return;
  }

  types.push(naam);
  inp.value = '';
  inp.focus();
  renderProducten();
  renderTypeBtns(); // type-grid op nieuwe bon bijwerken
  toast(`"${naam}" toegevoegd`);
}

function deleteProduct(naam) {
  // Verwijder ook uit huidige bon als aanwezig
  const inCurrentBon = currentBon.some(i => i.type === naam);
  types      = types.filter(t => t !== naam);
  currentBon = currentBon.filter(i => i.type !== naam);

  renderProducten();
  renderTypeBtns();
  renderCurrentBon();

  toast(inCurrentBon
    ? `"${naam}" verwijderd (ook van huidige bon)`
    : `"${naam}" verwijderd`
  );
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
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
renderProducten();
