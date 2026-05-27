import { useState, useEffect } from 'react';
import { api } from '../api.js';

const euro = (n) => `€ ${(n || 0).toFixed(2).replace('.', ',')}`;

export default function NieuweBon({ className, products, editingBon, onBonSaved, onCancelEdit, toast }) {
  const [naam,       setNaam]       = useState('');
  const [opmerking,  setOpmerking]  = useState('');
  const [currentBon, setCurrentBon] = useState([]);

  /* Formulier vullen bij bewerken */
  useEffect(() => {
    if (editingBon) {
      setNaam(editingBon.naam);
      setOpmerking(editingBon.opmerking || '');
      setCurrentBon(editingBon.items.map(i => ({ ...i })));
    }
  }, [editingBon]);

  /* Prijzen op basis van huidige producten */
  const priceMap = Object.fromEntries(products.map(p => [p.naam, p.prijs ?? 0]));

  /* Helpers huidige bon */
  const addItem = (type) => {
    setCurrentBon(prev => {
      const ex = prev.find(i => i.type === type);
      if (ex) return prev.map(i => i.type === type ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { type, qty: 1 }];
    });
  };

  const decrementItem = (type) => {
    setCurrentBon(prev =>
      prev.flatMap(i => {
        if (i.type !== type) return [i];
        return i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : [];
      })
    );
  };

  const removeItem = (type) => setCurrentBon(prev => prev.filter(i => i.type !== type));

  const total      = currentBon.reduce((s, i) => s + i.qty, 0);
  const totalPrijs = currentBon.reduce((s, i) => s + i.qty * (priceMap[i.type] ?? 0), 0);

  /* Opslaan */
  const handleSave = async () => {
    if (!naam.trim()) { toast('Vul eerst een naam in'); return; }
    if (!currentBon.length) { toast('Voeg eerst pannenkoeken toe'); return; }

    try {
      if (editingBon) {
        await api.updateBon(editingBon.id, { naam, opmerking, items: currentBon });
        toast(`Bon #${editingBon.nr} bijgewerkt`);
      } else {
        const bon = await api.createBon({ naam, opmerking, items: currentBon });
        toast(`Bon #${bon.nr} opgeslagen`);
      }
      reset();
      onBonSaved();
    } catch (e) {
      toast(e.message);
    }
  };

  const reset = () => {
    setNaam(''); setOpmerking(''); setCurrentBon([]);
  };

  const handleCancel = () => {
    reset();
    onCancelEdit();
    toast('Bewerking geannuleerd');
  };

  return (
    <div className={className}>

      {/* Edit-banner */}
      {editingBon && (
        <div className="edit-banner">
          <div className="edit-banner-left">
            <span className="edit-banner-dot" />
            <span>Bon #{editingBon.nr} bewerken</span>
          </div>
          <button className="edit-banner-cancel" onClick={handleCancel}>Annuleer</button>
        </div>
      )}

      {/* Klantgegevens */}
      <div className="card">
        <div className="card-title">Klantgegevens</div>
        <div className="field">
          <label htmlFor="inp-naam">Naam of omschrijving</label>
          <input
            id="inp-naam" type="text"
            placeholder="Bijv. Tafel 3 of Jan de Vries"
            value={naam}
            onChange={e => setNaam(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="inp-opmerking">
            Opmerking <span className="optional">(optioneel)</span>
          </label>
          <textarea
            id="inp-opmerking"
            placeholder="Bijv. geen suiker, extra knapperig…"
            value={opmerking}
            onChange={e => setOpmerking(e.target.value)}
          />
        </div>
      </div>

      {/* Type-knoppen */}
      <div className="card">
        <div className="card-title">Tik om toe te voegen</div>
        {products.length === 0 ? (
          <p className="types-hint">
            Nog geen producten. Voeg ze toe via het tabblad <strong>Producten</strong>.
          </p>
        ) : (
          <div className="types-grid">
            {products.map(p => {
              const qty = currentBon.find(i => i.type === p.naam)?.qty ?? 0;
              return (
                <button
                  key={p.id}
                  className={`type-btn ${qty > 0 ? 'has-items' : ''}`}
                  onClick={() => addItem(p.naam)}
                >
                  <span className="type-btn-name">{p.naam}</span>
                  {p.prijs > 0 && <span className="type-btn-price">{euro(p.prijs)}</span>}
                  {qty > 0 && <span className="type-count">{qty}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Huidige bon */}
      {currentBon.length > 0 && (
        <div className="card">
          <div className="card-title">Huidige bon</div>
          {currentBon.map(i => {
            const lineTotal = (priceMap[i.type] ?? 0) * i.qty;
            return (
              <div key={i.type} className="order-item">
                <div className="order-item-name">{i.type}</div>
                {lineTotal > 0 && (
                  <div className="order-item-price">{euro(lineTotal)}</div>
                )}
                <div className="order-item-controls">
                  <button className="btn-decrement" onClick={() => decrementItem(i.type)}>−</button>
                  <span className="order-item-count">{i.qty}</span>
                  <button className="btn-remove" onClick={() => removeItem(i.type)}>✕</button>
                </div>
              </div>
            );
          })}
          <div className="divider" />
          <div className="bon-total-row">
            <span className="bon-total-label">Totaal</span>
            <div className="bon-total-right">
              <span className="bon-total-count">{total} stuks</span>
              {totalPrijs > 0 && <span className="bon-total-price">{euro(totalPrijs)}</span>}
            </div>
          </div>
          <button
            className={`btn-save ${editingBon ? 'editing' : ''}`}
            onClick={handleSave}
          >
            {editingBon ? 'Wijzigingen opslaan' : 'Bon opslaan'}
          </button>
        </div>
      )}

    </div>
  );
}
