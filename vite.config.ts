import { resolve } from 'path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss()],
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
      },
    },
  },
})
