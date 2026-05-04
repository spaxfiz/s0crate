import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1422,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8421',
        timeout: 300_000,
        proxyTimeout: 300_000,
      },
    },
  },
})
