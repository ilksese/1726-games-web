import { atom } from 'jotai'
import { getFavorites, toggleFavorite as persistToggle } from '@games/shared'

export const searchQueryAtom = atom('')
export const activeTagAtom = atom('all')
export const showFavoritesOnlyAtom = atom(false)

export const favoritesAtom = atom<string[]>(getFavorites())

export const toggleFavoriteAtom = atom(null, (_get, set, gameId: string) => {
  persistToggle(gameId)
  set(favoritesAtom, getFavorites())
})
