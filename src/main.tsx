import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { installEuropeanDates } from './core/dates'

// alle datums als DD/MM/YYYY (core/dates.ts)
installEuropeanDates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
