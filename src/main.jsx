import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Unregister any legacy Service Workers (from Version 1) and clear cached legacy code
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then((names) => {
    for (let name of names) {
      if (name.includes('ittihad') || name.includes('v1')) {
        caches.delete(name);
      }
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
