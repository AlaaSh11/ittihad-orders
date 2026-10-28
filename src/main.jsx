import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// One-time unregistration of legacy Version 1 Service Workers and obsolete caches
const SW_CLEANED_FLAG = 'ittihad_sw_purged_v2';
if (!localStorage.getItem(SW_CLEANED_FLAG)) {
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
  localStorage.setItem(SW_CLEANED_FLAG, 'true');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
