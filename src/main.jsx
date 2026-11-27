import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/bricolage-grotesque/500.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import KlantenschermDisplay from './components/KlantenschermDisplay'
import AcceptInvite from './components/AcceptInvite'
import LandingPage from './components/LandingPage'
import './styles.css'

const path = window.location.pathname
const route = path === '/display' ? <KlantenschermDisplay />
            : path === '/invite'  ? <AcceptInvite />
            : path === '/app'     ? <App />
            : <LandingPage />   // '/' and anything else → the public welcome page

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {route}
  </React.StrictMode>
)
