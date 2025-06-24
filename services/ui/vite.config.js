import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/search': {
        target: 'http://api:3001',
        changeOrigin: true
      }
    }
  }
}) 