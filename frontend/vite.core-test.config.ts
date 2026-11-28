import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.ts';

export default mergeConfig(baseConfig, defineConfig({ server: {
  proxy: {
    '/api': { target: 'http://localhost:3195', changeOrigin: true, ws: true },
    '/uploads': { target: 'http://localhost:3195', changeOrigin: true },
  },
} }));
