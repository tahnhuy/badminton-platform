import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.ts';

// Dedicated test ports keep live Profile tests away from developer servers/databases.
export default mergeConfig(baseConfig, defineConfig({ server: {
  proxy: {
    '/api': { target: 'http://localhost:3192', changeOrigin: true },
    '/uploads': { target: 'http://localhost:3192', changeOrigin: true },
  },
} }));
