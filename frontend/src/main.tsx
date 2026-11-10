import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/routes'
import '@/index.css'

const racine = document.getElementById('root')
if (!racine) {
  throw new Error('Élément #root introuvable dans index.html')
}

createRoot(racine).render(
  <StrictMode>
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </StrictMode>,
)
