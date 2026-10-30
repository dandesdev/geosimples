import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preloadDialogs } from './components/dialogs/lazy'
import { activePrefs, applyPrefsToSession } from './store/prefsStore'

// Start from the active profile's view and export defaults.
applyPrefsToSession(activePrefs())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

preloadDialogs()
