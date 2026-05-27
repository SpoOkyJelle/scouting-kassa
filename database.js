import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, 'scouting.db'));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    naam     TEXT    NOT NULL UNIQUE,
    volgorde INTEGER NOT NULL DEFAULT 0,
    prijs    REAL    NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bonnen (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nr           INTEGER NOT NULL UNIQUE,
    naam         TEXT    NOT NULL,
    opmerking    TEXT    NOT NULL DEFAULT '',
    tijdstip     TEXT    NOT NULL,
    betaald      INTEGER NOT NULL DEFAULT 0,
    totaal       INTEGER NOT NULL DEFAULT 0,
    totaal_prijs REAL    NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bon_items (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    bon_id INTEGER NOT NULL REFERENCES bonnen(id) ON DELETE CASCADE,
    type   TEXT    NOT NULL,
    qty    INTEGER NOT NULL DEFAULT 1,
    prijs  REAL    NOT NULL DEFAULT 0
  );
`);

/* Migraties voor bestaande databases (kolom bestaat al → silently ignore) */
for (const sql of [
  'ALTER TABLE products  ADD COLUMN prijs        REAL NOT NULL DEFAULT 0',
  'ALTER TABLE bonnen    ADD COLUMN totaal_prijs REAL NOT NULL DEFAULT 0',
  'ALTER TABLE bon_items ADD COLUMN prijs        REAL NOT NULL DEFAULT 0',
]) {
  try { db.exec(sql); } catch { /* kolom bestaat al */ }
}

/* Standaard producten als de tabel leeg is */
const { c } = db.prepare('SELECT COUNT(*) AS c FROM products').get();
if (c === 0) {
  const ins = db.prepare('INSERT INTO products (naam, volgorde, prijs) VALUES (?,?,?)');
  [
    ['Naturel',    0, 2.50],
    ['Stroop',     1, 2.75],
    ['Kaas',       2, 3.00],
    ['Spek',       3, 3.00],
    ['Spek & kaas',4, 3.50],
    ['Suiker',     5, 2.50],
  ].forEach(([naam, v, p]) => ins.run(naam, v, p));
}

/* Transactie-helper */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

export default db;
