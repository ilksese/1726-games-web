# 1726 Games Web

pnpm workspace monorepo with Vite 6 multi-entry, Tailwind CSS v4, vanilla JS. No test, lint, or typecheck scripts exist — verify via `pnpm build`.

## Commands

```sh
pnpm dev          # Vite dev server at localhost:5173
pnpm build        # Build all 4 HTML entries to dist/
pnpm preview      # Preview dist/
pnpm signaling    # WebSocket signaling server on port 8787 (required for number-detective multiplayer)
```

Number-detective needs **both** `pnpm dev` and `pnpm signaling` running simultaneously. On another LAN device, browse `http://<host IP>:5173/number-detective.html`.

## Architecture

- HTML entries at project root: `index.html`, `game-a.html`, `game-b.html`, `number-detective.html`
- Source in `packages/*/src/` — URL paths never include `packages/`
- `@games/shared` resolved via **both** `workspace:*` in package.json AND `resolve.alias` in vite.config.ts — both are required
- Tailwind v4 via `@tailwindcss/vite` plugin globally; per-package CSS does `@import "tailwindcss"` + optional `@theme` (no postcss config)

### Packages

| Package | Role |
|---------|------|
| `@games/shared` | Game registry + localStorage utils (key prefix `@games/`, zero deps) |
| `@games/lobby` | Lobby page: search, tag filter, favorites, recent plays (vanilla DOM) |
| `@games/game-a` | PixiJS v8 placeholder (indigo bg `#1e1b4b`) |
| `@games/game-b` | PixiJS v8 placeholder (dark purple bg `#1b1b3a`) |
| `@games/number-detective` | Native DOM + Tailwind (no PixiJS). LAN two-player number deduction over WebRTC |
| `@games/signaling` | Minimal `ws` relay server for number-detective room pairing + SDP/ICE forwarding |

### PixiJS games (game-a, game-b)

- PixiJS v8: `new Application()` + `await app.init({...})`, then `app.canvas` (not `app.view`), `app.screen` for dimensions
- `init().catch(err => { ... show DOM fallback ... })`
- `pixi.js` is a root dependency (shared by game-a/game-b); number-detective does **not** depend on it

### number-detective

- UI layer (`src/ui/`) is pure DOM + Tailwind — no PixiJS, no canvas
- `src/game/engine.js` + `src/game/validate.js` + `src/net/connection.js` are **pure JS** (no DOM, no UI imports) — safe to unit test in isolation, currently untested
- `connection.js` hardcodes signaling port `8787` (matches `signaling/server.js` default `PORT=8787`)
- Room codes are 6-digit numeric (typable on the in-app keypad)
- Responsive: mobile/tablet/PC via Tailwind breakpoints; on-screen keypad on all devices, physical keyboard (0-9/Backspace/Enter) as desktop accelerator
- History records shown via Modal + Tabs, not inline on the play screen

### Shared Library

- `registry.js`: `games[]`, `getGame()`, `getGamesByTag()`, `getAllTags()`
- `storage.js`: `saveScore/getScore`, `toggleFavorite/isFavorite/getFavorites`, `recordPlay/getRecentPlays`
- `getFavorites()` imports `games` from registry.js
- `isNew` flag in lobby means "not in recent 5 plays", not literally new

### Lobby

- Vanilla JS + native DOM API (no framework)
- Game card tag colors use Tailwind arbitrary value syntax: `bg-[${game.color}]/10`
- Components: card.js (imports `recordPlay`), search.js (200ms debounce), filter.js
