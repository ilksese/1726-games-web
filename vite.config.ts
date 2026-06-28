import { resolve } from 'path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@games/shared': resolve(__dirname, 'packages/shared/src'),
      events: resolve(__dirname, 'node_modules/events'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        lobby: resolve(__dirname, 'index.html'),
        'game-a': resolve(__dirname, 'game-a.html'),
        'game-b': resolve(__dirname, 'game-b.html'),
        'number-detective': resolve(__dirname, 'number-detective.html'),
      },
    },
  },
})
