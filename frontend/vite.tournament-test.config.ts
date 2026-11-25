import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.ts';

// Dedicated test backend/database; never proxy the live tournament test to the dev server.
export default mergeConfig(baseConfig, defineConfig({ server: {
  proxy: {
    '/api': { target: 'http://localhost:3193', changeOrigin: true, ws: true },
    '/uploads': { target: 'http://localhost:3193', changeOrigin: true },
  },
} }));
