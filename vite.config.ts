import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal typing for the one env var read below; avoids adding @types/node.
declare const process: { env: Record<string, string | undefined> }

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /aquira-valentine-week/, while
  // Cloudflare Workers serves it from /. GitHub Actions sets
  // GITHUB_ACTIONS=true, so use the repo subpath only there and keep '/'
  // everywhere else (local dev, Cloudflare builds).
  base:
    process.env.GITHUB_ACTIONS === 'true' ? '/aquira-valentine-week/' : '/',
  plugins: [react()],
  server: {
    // During `npm run dev`, forward photo API calls to a local `wrangler dev`
    // instance (http://localhost:8787) so uploads work without a deploy.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
