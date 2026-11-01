import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serveert de app onder https://vonstruct.github.io/app/
export default defineConfig({
  plugins: [react()],
  base: '/app/',
})
