import { resolve } from 'path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  root: __dirname,
  plugins: [
    tailwindcss(),
    nodePolyfills({
      include: ['process', 'buffer', 'events'],
      globals: { process: true, Buffer: true, global: true },
    }),
  ],
  resolve: {
    alias: {
      '@games/shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        lobby: resolve(__dirname, 'index.html'),
        'game-a': resolve(__dirname, 'game-a.html'),
        'game-b': resolve(__dirname, 'game-b.html'),
        'number-detective': resolve(__dirname, 'number-detective.html'),
        'who-drinks': resolve(__dirname, 'who-drinks.html'),
      },
    },
  },
})
