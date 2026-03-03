import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const webPort = Number(process.env.WEB_PORT ?? 9900);
const apiServerUrl = process.env.API_SERVER_URL ?? 'http://localhost:9900';

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
    proxy: {
      '/api': {
        target: apiServerUrl,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['ammo.js'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
})
