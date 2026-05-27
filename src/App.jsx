import { useState, useEffect } from 'react';
import NieuweBon  from './components/NieuweBon.jsx';
import Bonnen     from './components/Bonnen.jsx';
import Overzicht  from './components/Overzicht.jsx';
import Producten  from './components/Producten.jsx';
import { api }    from './api.js';
import { useToast } from './useToast.js';

const TABS = [
  { id: 'nieuw',     label: 'Nieuwe bon' },
  { id: 'bonnen',    label: 'Bonnen'     },
  { id: 'overzicht', label: 'Overzicht'  },
  { id: 'producten', label: 'Producten'  },
];

export default function App() {
  const [activePage,  setActivePage]  = useState('nieuw');
  const [products,    setProducts]    = useState([]);
  const [editingBon,  setEditingBon]  = useState(null);
  const [bonReload,   setBonReload]   = useState(0);
  const { toast, toastMsg, toastVisible } = useToast();

  /* Producten laden */
  useEffect(() => {
    api.getProducten()
      .then(setProducts)
      .catch(() => toast('Kon producten niet laden'));
  }, []);

  const handleBonSaved    = ()    => setBonReload(k => k + 1);
  const handleEditBon     = (bon) => { setEditingBon(bon); setActivePage('nieuw'); };
  const handleCancelEdit  = ()    => setEditingBon(null);
  const handleProductsChange = (ps) => setProducts(ps);

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <span className="header-label">Scouting</span>
          <h1>Pannenkoekenactie</h1>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${activePage === t.id ? 'active' : ''}`}
            onClick={() => setActivePage(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Pagina's */}
      <NieuweBon
        className={`page ${activePage === 'nieuw'     ? 'active' : ''}`}
        products={products}
        editingBon={editingBon}
        onBonSaved={handleBonSaved}
        onCancelEdit={handleCancelEdit}
        toast={toast}
      />
      <Bonnen
        className={`page ${activePage === 'bonnen'    ? 'active' : ''}`}
        reloadKey={bonReload}
        onEditBon={handleEditBon}
        toast={toast}
      />
      <Overzicht
        className={`page ${activePage === 'overzicht' ? 'active' : ''}`}
        reloadKey={bonReload}
        toast={toast}
      />
      <Producten
        className={`page ${activePage === 'producten' ? 'active' : ''}`}
        products={products}
        onProductsChange={handleProductsChange}
        toast={toast}
      />

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toastMsg}</div>
    </>
  );
}
