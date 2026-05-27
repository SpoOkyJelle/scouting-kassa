const BASE = '/api';

async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  /* Producten */
  getProducten:  ()            => fetch(`${BASE}/producten`).then(handle),
  addProduct:    (naam, prijs) => fetch(`${BASE}/producten`, json('POST', { naam, prijs })).then(handle),
  updateProduct: (id, data)    => fetch(`${BASE}/producten/${id}`, json('PUT', data)).then(handle),
  deleteProduct: (id)          => fetch(`${BASE}/producten/${id}`, { method: 'DELETE' }).then(handle),

  /* Bonnen */
  getBonnen:     ()         => fetch(`${BASE}/bonnen`).then(handle),
  createBon:     (data)     => fetch(`${BASE}/bonnen`, json('POST', data)).then(handle),
  updateBon:     (id, data) => fetch(`${BASE}/bonnen/${id}`, json('PUT', data)).then(handle),
  toggleBetaald: (id)       => fetch(`${BASE}/bonnen/${id}/betaald`, { method: 'PATCH' }).then(handle),
};
