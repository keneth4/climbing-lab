import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  // The manual demo and development/e2e server must not overwrite each other's optimizer cache.
  cacheDir: `node_modules/.vite/${mode}`,
  server: {
    // Worker persistence changes on reads too; it is runtime data, never HMR input.
    watch: { ignored: ['**/.wrangler/**'] },
    proxy: {
      '/api':
        mode === 'demo' ? 'http://127.0.0.1:8789' : 'http://127.0.0.1:8787',
    },
  },
}));
