import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, forward photo API calls to a local `wrangler dev`
    // instance (http://localhost:8787) so uploads work without a deploy.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
