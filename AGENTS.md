# 1726 Games Web

pnpm workspace monorepo with Vite 6 multi-entry, PixiJS v8, Tailwind CSS v4, vanilla JS.

## Commands

```sh
pnpm dev       # Vite dev server at localhost:5173
pnpm build     # Build to dist/ (all 3 entries)
pnpm preview   # Preview dist/
```

## Architecture

- HTML entry files at project root: `index.html`, `game-a.html`, `game-b.html`
- Source in `packages/*/src/` — URL paths never include `packages/`
- `@games/shared` resolved via **both** `workspace:*` in package.json AND `resolve.alias` in vite.config.ts

### Packages

| Package | Role |
|---------|------|
| `@games/shared` | Game registry + localStorage utilities (prefix `@games/`, zero deps) |
| `@games/lobby` | Lobby page: search, tag filter, favorites, recent plays |
| `@games/game-a` | PixiJS v8 placeholder (indigo bg `#1e1b4b`) |
| `@games/game-b` | PixiJS v8 placeholder (dark purple bg `#1b1b3a`) |

### Lobby

- Vanilla JS + native DOM API (no framework)
- Tailwind v4: `@import "tailwindcss"` in CSS, `@theme` for custom colors, `@tailwindcss/vite` plugin (no postcss config needed)
- Game card tag colors use Tailwind arbitrary value syntax: `bg-[${game.color}]/10`
- Components: card.js (imports `recordPlay`), search.js (200ms debounce), filter.js

### Games

- PixiJS v8: `new Application()` + `await app.init({...})`, then `app.canvas` (not `app.view`), `app.screen` for dimensions
- `init().catch(err => { ... show fallback ... })` with DOM error message
- Demo interaction: click canvas to save score, updates title text

### Shared Library

- `registry.js`: `games[]`, `getGame()`, `getGamesByTag()`, `getAllTags()`
- `storage.js`: `saveScore/getScore`, `toggleFavorite/isFavorite/getFavorites`, `recordPlay/getRecentPlays`
- `getFavorites()` imports `games` from registry.js
- `isNew` flag in lobby means "not in recent 5 plays", not literally new