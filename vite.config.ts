import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['process', 'buffer', 'events'],
      globals: { process: true, Buffer: true, global: true },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.local'],
  },
  preview: {
    allowedHosts: ['.local'],
  },
  resolve: {
    alias: {
      '@games/shared': resolve(__dirname, 'packages/shared/src'),
      '@games/lobby': resolve(__dirname, 'packages/lobby/src'),
      '@games/game-a': resolve(__dirname, 'packages/game-a/src'),
      '@games/game-b': resolve(__dirname, 'packages/game-b/src'),
      '@games/number-detective': resolve(__dirname, 'packages/number-detective/src'),
      '@games/who-drinks': resolve(__dirname, 'packages/who-drinks/src'),
    },
  },
})
