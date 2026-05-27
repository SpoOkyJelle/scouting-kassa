import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import db, { transaction } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3001;
const PROD = existsSync(join(__dirname, 'dist'));

app.use(express.json());

if (PROD) {
  app.use(express.static(join(__dirname, 'dist')));
}

/* ── Hulpfuncties ─────────────────────────── */
function withItems(bon) {
  const items = db.prepare('SELECT type, qty, prijs FROM bon_items WHERE bon_id = ?').all(bon.id);
  return { ...bon, betaald: bon.betaald === 1, items };
}

function getPriceMap() {
  const products = db.prepare('SELECT naam, prijs FROM products').all();
  return Object.fromEntries(products.map(p => [p.naam, p.prijs ?? 0]));
}

/* ════════════════════════════════════════════
   PRODUCTEN
════════════════════════════════════════════ */
app.get('/api/producten', (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY volgorde, id').all());
});

app.post('/api/producten', (req, res) => {
  const naam  = req.body.naam?.trim();
  const prijs = Number(req.body.prijs ?? 0);
  if (!naam) return res.status(400).json({ error: 'Naam is verplicht' });

  try {
    const { m } = db.prepare('SELECT MAX(volgorde) AS m FROM products').get();
    const result = db.prepare('INSERT INTO products (naam, volgorde, prijs) VALUES (?, ?, ?)').run(naam, (m ?? -1) + 1, prijs);
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Product bestaat al' });
    throw e;
  }
});

app.put('/api/producten/:id', (req, res) => {
  const id    = Number(req.params.id);
  const naam  = req.body.naam?.trim();
  const prijs = Number(req.body.prijs ?? 0);
  if (!naam) return res.status(400).json({ error: 'Naam is verplicht' });

  try {
    db.prepare('UPDATE products SET naam=?, prijs=? WHERE id=?').run(naam, prijs, id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Product niet gevonden' });
    res.json(product);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Product bestaat al' });
    throw e;
  }
});

app.delete('/api/producten/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

/* ════════════════════════════════════════════
   BONNEN
════════════════════════════════════════════ */
app.get('/api/bonnen', (_req, res) => {
  const bonnen = db.prepare('SELECT * FROM bonnen ORDER BY nr DESC').all();
  res.json(bonnen.map(withItems));
});

app.post('/api/bonnen', (req, res) => {
  const { naam, opmerking = '', items = [] } = req.body;
  if (!naam?.trim())  return res.status(400).json({ error: 'Naam is verplicht' });
  if (!items.length)  return res.status(400).json({ error: 'Minimaal één item vereist' });

  const priceMap    = getPriceMap();
  const now         = new Date();
  const tijdstip    = now.toLocaleString('nl-NL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const totaal      = items.reduce((s, i) => s + i.qty, 0);
  const totaalPrijs = items.reduce((s, i) => s + i.qty * (priceMap[i.type] ?? 0), 0);
  const { m }       = db.prepare('SELECT MAX(nr) AS m FROM bonnen').get();
  const nr          = (m ?? 0) + 1;

  const bon = transaction(() => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO bonnen (nr, naam, opmerking, tijdstip, totaal, totaal_prijs) VALUES (?,?,?,?,?,?)'
    ).run(nr, naam.trim(), opmerking, tijdstip, totaal, totaalPrijs);

    const ins = db.prepare('INSERT INTO bon_items (bon_id, type, qty, prijs) VALUES (?,?,?,?)');
    items.forEach(i => ins.run(lastInsertRowid, i.type, i.qty, priceMap[i.type] ?? 0));

    return db.prepare('SELECT * FROM bonnen WHERE id = ?').get(lastInsertRowid);
  });

  res.status(201).json(withItems(bon));
});

app.put('/api/bonnen/:id', (req, res) => {
  const { naam, opmerking = '', items = [] } = req.body;
  const id          = Number(req.params.id);
  if (!naam?.trim()) return res.status(400).json({ error: 'Naam is verplicht' });

  const priceMap    = getPriceMap();
  const totaal      = items.reduce((s, i) => s + i.qty, 0);
  const totaalPrijs = items.reduce((s, i) => s + i.qty * (priceMap[i.type] ?? 0), 0);

  const bon = transaction(() => {
    db.prepare('UPDATE bonnen SET naam=?, opmerking=?, totaal=?, totaal_prijs=? WHERE id=?')
      .run(naam.trim(), opmerking, totaal, totaalPrijs, id);
    db.prepare('DELETE FROM bon_items WHERE bon_id=?').run(id);
    const ins = db.prepare('INSERT INTO bon_items (bon_id, type, qty, prijs) VALUES (?,?,?,?)');
    items.forEach(i => ins.run(id, i.type, i.qty, priceMap[i.type] ?? 0));
    return db.prepare('SELECT * FROM bonnen WHERE id=?').get(id);
  });

  if (!bon) return res.status(404).json({ error: 'Bon niet gevonden' });
  res.json(withItems(bon));
});

app.patch('/api/bonnen/:id/betaald', (req, res) => {
  const bon = db.prepare('SELECT * FROM bonnen WHERE id=?').get(Number(req.params.id));
  if (!bon) return res.status(404).json({ error: 'Bon niet gevonden' });

  const nieuw = bon.betaald ? 0 : 1;
  db.prepare('UPDATE bonnen SET betaald=? WHERE id=?').run(nieuw, bon.id);
  res.json(withItems({ ...bon, betaald: nieuw }));
});

/* ── SPA-fallback (productie) ─────────────── */
if (PROD) {
  app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n  Server: http://localhost:${PORT}`);
  if (!PROD) console.log('  Start ook "npm run dev" of open vite apart\n');
});
