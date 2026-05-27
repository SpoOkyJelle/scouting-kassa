import { useState, useEffect } from 'react';
import { api } from '../api.js';

const euro = (n) => `€ ${(n || 0).toFixed(2).replace('.', ',')}`;

export default function Overzicht({ className, reloadKey, toast }) {
  const [bonnen, setBonnen] = useState([]);

  useEffect(() => {
    api.getBonnen()
      .then(setBonnen)
      .catch(() => toast('Kon overzicht niet laden'));
  }, [reloadKey]);

  const total = bonnen.length;
  const open  = bonnen.filter(b => !b.betaald).length;
  const paid  = bonnen.filter(b =>  b.betaald).length;

  const omzetTotaal = bonnen.reduce((s, b) => s + (b.totaal_prijs || 0), 0);
  const omzetOpen   = bonnen.filter(b => !b.betaald).reduce((s, b) => s + (b.totaal_prijs || 0), 0);
  const omzetPaid   = bonnen.filter(b =>  b.betaald).reduce((s, b) => s + (b.totaal_prijs || 0), 0);

  /* Breakdown per soort: qty + omzet */
  const breakdown = {};
  bonnen.forEach(b => b.items.forEach(i => {
    if (!breakdown[i.type]) breakdown[i.type] = { qty: 0, omzet: 0 };
    breakdown[i.type].qty   += i.qty;
    breakdown[i.type].omzet += i.qty * (i.prijs || 0);
  }));

  const grandTotal = Object.values(breakdown).reduce((a, v) => a + v.qty, 0);
  const rows = Object.entries(breakdown).sort(([a], [b]) => a.localeCompare(b));
  const hasOmzet = omzetTotaal > 0;

  return (
    <div className={className}>

      {/* Bon-statistieken */}
      <div className="stats-grid">
        <div className="stat-box s-total">
          <div className="stat-num">{total}</div>
          <div className="stat-label">Bonnen</div>
        </div>
        <div className="stat-box s-open">
          <div className="stat-num">{open}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-box s-paid">
          <div className="stat-num">{paid}</div>
          <div className="stat-label">Betaald</div>
        </div>
      </div>

      {/* Omzet-statistieken */}
      {hasOmzet && (
        <div className="stats-grid">
          <div className="stat-box s-rev-total">
            <div className="stat-num stat-num-sm">{euro(omzetTotaal)}</div>
            <div className="stat-label">Omzet</div>
          </div>
          <div className="stat-box s-rev-open">
            <div className="stat-num stat-num-sm">{euro(omzetOpen)}</div>
            <div className="stat-label">Nog open</div>
          </div>
          <div className="stat-box s-rev-paid">
            <div className="stat-num stat-num-sm">{euro(omzetPaid)}</div>
            <div className="stat-label">Ontvangen</div>
          </div>
        </div>
      )}

      {/* Per soort */}
      <div className="card">
        <div className="card-title">Pannenkoeken per soort</div>
        {rows.length === 0 ? (
          <div className="products-empty">Nog geen bestellingen.</div>
        ) : (
          rows.map(([type, { qty, omzet }]) => (
            <div key={type} className="breakdown-row">
              <span className="breakdown-name">{type}</span>
              <span className="breakdown-count">{qty}</span>
              {omzet > 0 && <span className="breakdown-price">{euro(omzet)}</span>}
            </div>
          ))
        )}
      </div>

      {/* Totaal */}
      <div className="total-bar">
        <span className="total-bar-label">Totaal pannenkoeken</span>
        <span className="total-bar-num">{grandTotal}</span>
      </div>

    </div>
  );
}
