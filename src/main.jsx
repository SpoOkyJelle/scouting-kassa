import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import KlantenschermDisplay from './components/KlantenschermDisplay'
import WaiterScreen from './components/WaiterScreen'
import KitchenScreen from './components/KitchenScreen'
import './styles.css'

const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/display' ? <KlantenschermDisplay />
     : path === '/waiter'  ? <WaiterScreen />
     : path === '/kitchen' ? <KitchenScreen />
     : <App />}
  </React.StrictMode>
)
