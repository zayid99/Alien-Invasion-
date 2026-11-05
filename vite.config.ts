import { defineConfig } from 'vite';

// `npm run build` makes a normal web build; `npm run build:crazygames` turns on the CrazyGames SDK.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __PLATFORM__: JSON.stringify(mode === 'crazygames' ? 'crazygames' : 'web') },
  build: { target: 'es2020', outDir: 'dist', assetsDir: 'bundle', assetsInlineLimit: 0, chunkSizeWarningLimit: 2500 },
  server: { host: true },
}));
