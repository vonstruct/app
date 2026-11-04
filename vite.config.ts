import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serveert de app onder https://vonstruct.github.io/app/
export default defineConfig({
  plugins: [react()],
  base: './', // werkt op app.vonstruct.com én vonstruct.github.io/app
  // versie = tijdstip van de build (Brusselse tijd), zichtbaar in het menu onder OV
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('nl-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) },
})
