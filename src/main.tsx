import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { ConfirmProvider } from '@/components/confirm-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ConfirmProvider>
          <App />
          <Toaster position="bottom-center" richColors />
        </ConfirmProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
