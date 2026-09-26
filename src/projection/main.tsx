import React from 'react'
import ReactDOM from 'react-dom/client'
// La letra proyectada tiene que verse igual en Windows y en Linux: Inter va
// empaquetada en vez de confiar en las fuentes del sistema.
import '@fontsource-variable/inter'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import '@/styles/globals.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
