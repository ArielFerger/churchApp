import React from 'react'
import ReactDOM from 'react-dom/client'
// Fuentes empaquetadas: sin internet y con el mismo aspecto en Windows y Linux.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/source-serif-4'
import App from './App'
import '@/styles/globals.css'
import '@/styles/control.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
