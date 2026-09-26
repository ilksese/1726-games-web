# 1726 Games Web

pnpm workspace monorepo with Vite 6 multi-entry, Tailwind CSS v4, and React 19 for newer games. Verify the web build with `pnpm build`. Room-server tests: `pnpm server:test`.

Code style: [references/code-style.md](references/code-style.md).

## Commands

```sh
pnpm dev          # Vite at localhost:5173. Port from VITE_1726_GAME_PORT.
pnpm build        # Build all HTML entries to dist/
pnpm preview      # Preview dist/
pnpm server:dev   # Go room server, default port 5174
pnpm server:test  # Room server tests
```

## Architecture

- HTML entry at project root: `index.html`
- Source in `packages/*/src/` — URL paths never include `packages/`
- `@games/shared` resolved via **both** `workspace:*` in package.json AND `resolve.alias` in vite.config.ts — both are required
- Tailwind v4 via `@tailwindcss/vite` plugin globally; per-package CSS does `@import "tailwindcss"` + optional `@theme` (no postcss config)

### Packages

| Package | Role |
|---------|------|
| `@games/shared` | Game registry + localStorage utils (key prefix `@games/`, zero deps) |
| `@games/lobby` | Lobby page: search, tag filter, favorites, recent plays (vanilla DOM) |
| `@games/number-detective` | Native DOM + Tailwind. LAN two-player number deduction over WebRTC via QR codes + link sharing (no server required) |
| `@games/who-drinks` | Party drinking game |
| `@games/wanxiang-mahjong` | React table for a physical mahjong match. Deals skill cards and records wins. Does not judge tile legality or execute skills. |
| `@games/server` | Go LAN room server. Default port 5174, from `VITE_1726_SERVER_PORT`. |

### number-detective

- UI layer (`src/ui/`) is pure DOM + Tailwind — no canvas
- `src/game/engine.js` + `src/game/validate.js` + `src/net/signaling.js` are **pure JS** (no DOM, no UI imports) — safe to unit test in isolation, currently untested
- WebRTC connection uses QR codes + shareable links for SDP exchange (no signaling server). Host generates offer → QR + link; guest scans/opens → generates answer → QR + link back. Single-round-trip with ICE candidates embedded in SDP.
- Only new dependency: `qrcode` npm package (in `@games/number-detective`); WebRTC is browser-native, no third-party WebRTC library
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