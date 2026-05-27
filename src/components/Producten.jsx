import { useState } from 'react';
import { api } from '../api.js';

export default function Producten({ className, products, onProductsChange, toast }) {
  const [newNaam,   setNewNaam]   = useState('');
  const [newPrijs,  setNewPrijs]  = useState('');
  const [priceEdit, setPriceEdit] = useState({});   // { [id]: string }

  const handleAdd = async () => {
    const naam = newNaam.trim();
    if (!naam) { toast('Vul een productnaam in'); return; }
    const prijs = parseFloat(String(newPrijs).replace(',', '.')) || 0;

    try {
      const product = await api.addProduct(naam, prijs);
      onProductsChange([...products, product]);
      setNewNaam('');
      setNewPrijs('');
      toast(`"${naam}" toegevoegd`);
    } catch (e) {
      toast(e.message);
    }
  };

  const handleDelete = async (product) => {
    try {
      await api.deleteProduct(product.id);
      onProductsChange(products.filter(p => p.id !== product.id));
      setPriceEdit(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      toast(`"${product.naam}" verwijderd`);
    } catch (e) {
      toast(e.message);
    }
  };

  const handlePriceChange = (id, value) => {
    setPriceEdit(prev => ({ ...prev, [id]: value }));
  };

  const handlePriceSave = async (p) => {
    const raw = priceEdit[p.id];
    if (raw === undefined) return;
    const prijs = parseFloat(String(raw).replace(',', '.')) || 0;
    // clear draft first
    setPriceEdit(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    if (Math.abs(prijs - p.prijs) < 0.001) return; // no meaningful change
    try {
      const updated = await api.updateProduct(p.id, { naam: p.naam, prijs });
      onProductsChange(products.map(q => q.id === p.id ? updated : q));
      toast(`Prijs van "${p.naam}" bijgewerkt naar € ${prijs.toFixed(2).replace('.', ',')}`);
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className={className}>

      {/* Nieuw product */}
      <div className="card">
        <div className="card-title">Nieuw product toevoegen</div>
        <div className="product-add-form">
          <input
            type="text"
            placeholder="Productnaam (bijv. Bacon &amp; kaas)"
            maxLength={40}
            value={newNaam}
            onChange={e => setNewNaam(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="product-add-bottom">
            <div className="product-price-field">
              <span className="product-price-prefix">€</span>
              <input
                type="number"
                className="product-price-input"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={newPrijs}
                onChange={e => setNewPrijs(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button className="btn-product-add" onClick={handleAdd}>Toevoegen</button>
          </div>
        </div>
      </div>

      {/* Lijst */}
      <div className="card">
        <div className="card-title">Huidige producten — klik prijs om te wijzigen</div>
        {products.length === 0 ? (
          <div className="products-empty">Nog geen producten toegevoegd.</div>
        ) : (
          products.map(p => (
            <div key={p.id} className="product-item">
              <span className="product-name">{p.naam}</span>
              <div className="product-item-right">
                <div className="product-price-field">
                  <span className="product-price-prefix">€</span>
                  <input
                    type="number"
                    className="product-price-input"
                    step="0.01"
                    min="0"
                    value={priceEdit[p.id] !== undefined ? priceEdit[p.id] : p.prijs.toFixed(2)}
                    onChange={e => handlePriceChange(p.id, e.target.value)}
                    onBlur={() => handlePriceSave(p)}
                    onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                    title="Prijs wijzigen — druk Enter om op te slaan"
                  />
                </div>
                <button
                  className="btn-product-delete"
                  title="Verwijder product"
                  onClick={() => handleDelete(p)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
