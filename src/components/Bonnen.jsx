import { useState, useEffect } from 'react';
import { api } from '../api.js';

const euro = (n) => `€ ${(n || 0).toFixed(2).replace('.', ',')}`;

export default function Bonnen({ className, reloadKey, onEditBon, toast }) {
  const [bonnen,  setBonnen]  = useState([]);
  const [filter,  setFilter]  = useState('open');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getBonnen()
      .then(setBonnen)
      .catch(() => toast('Kon bonnen niet laden'))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const handleToggle = async (id) => {
    try {
      const updated = await api.toggleBetaald(id);
      setBonnen(bs => bs.map(b => b.id === updated.id ? updated : b));
      toast(updated.betaald ? `Bon #${updated.nr} betaald` : `Bon #${updated.nr} terug op open`);
    } catch (e) {
      toast(e.message);
    }
  };

  const filtered = bonnen.filter(b => {
    const matchF = filter === 'alle' ? true : filter === 'open' ? !b.betaald : b.betaald;
    const matchS = !search || b.naam.toLowerCase().includes(search.toLowerCase());
    return matchF && matchS;
  });

  return (
    <div className={className}>

      {/* Zoekbalk */}
      <div className="search-row">
        <input
          className="search-input" type="text"
          placeholder="Zoek op naam…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter */}
      <div className="filter-row">
        {['alle', 'open', 'betaald'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Lijst */}
      {loading ? (
        <div className="empty-bonnen">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-bonnen">
          <span className="empty-bonnen-icon" />
          {bonnen.length ? 'Geen bonnen gevonden' : 'Nog geen bonnen opgeslagen'}
        </div>
      ) : (
        filtered.map(b => <BonCard key={b.id} bon={b} onToggle={handleToggle} onEdit={onEditBon} />)
      )}

    </div>
  );
}

function BonCard({ bon, onToggle, onEdit }) {
  const isOpen = !bon.betaald;
  return (
    <div className={`bon-card ${bon.betaald ? 'betaald' : 'open'}`}>

      <div className="bon-top">
        <div className="bon-meta">
          <div className="bon-name">{bon.naam}</div>
          <div className="bon-sub">Bon #{bon.nr} &middot; {bon.tijdstip}</div>
          {bon.opmerking && <div className="bon-remark">{bon.opmerking}</div>}
        </div>
        <span className={`badge ${bon.betaald ? 'badge-betaald' : 'badge-open'}`}>
          {bon.betaald ? 'Betaald' : 'Open'}
        </span>
      </div>

      <div className="bon-items">
        {bon.items.map(i => (
          <div key={i.type} className="bon-item-line">
            <span>{i.type}</span>
            <span>{i.qty}×</span>
          </div>
        ))}
      </div>

      <div className="bon-footer">
        <div className="bon-footer-total">
          <strong>{bon.totaal} pannenkoek{bon.totaal !== 1 ? 'en' : ''}</strong>
          {bon.totaal_prijs > 0 && (
            <span className="bon-price-tag">{euro(bon.totaal_prijs)}</span>
          )}
        </div>
        <div className="bon-footer-actions">
          <button className="btn-edit" onClick={() => onEdit(bon)}>Bewerk</button>
          <button
            className={`btn-pay ${isOpen ? 'mark-paid' : 'mark-open'}`}
            onClick={() => onToggle(bon.id)}
          >
            {isOpen ? 'Markeer betaald' : 'Zet op open'}
          </button>
        </div>
      </div>

    </div>
  );
}
