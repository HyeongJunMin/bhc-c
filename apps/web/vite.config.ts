import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };
const webPort = Number(process.env.WEB_PORT ?? 9901);

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [react()],
  server: {
    port: webPort,
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
    proxy: {
      '/auth': 'http://localhost:9900',
      '/api/lobby': 'http://localhost:9900',
      '/simulate': 'http://localhost:9900',
      '/v1/systems': 'http://localhost:9900',
      '/djemals': 'http://localhost:9900',
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
