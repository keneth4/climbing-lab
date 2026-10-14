import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api':
        mode === 'demo' ? 'http://127.0.0.1:8789' : 'http://127.0.0.1:8787',
    },
  },
}));
