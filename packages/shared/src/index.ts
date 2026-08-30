export { games, getGame, getGamesByTag, getAllTags } from './registry'
export type { Game } from './registry'
export {
  saveScore,
  getScore,
  toggleFavorite,
  isFavorite,
  getFavorites,
  recordPlay,
  getRecentPlays,
} from './storage'
