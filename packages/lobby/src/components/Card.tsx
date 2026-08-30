import { useAtomValue, useSetAtom } from 'jotai'
import type { Game } from '@games/shared'
import { favoritesAtom, toggleFavoriteAtom } from '../state'

interface CardProps {
  game: Game
  score: number
  isNew: boolean
  onOpen: (game: Game) => void
}

export function Card({ game, score, isNew, onOpen }: CardProps) {
  const favorites = useAtomValue(favoritesAtom)
  const toggleFavorite = useSetAtom(toggleFavoriteAtom)
  const favorited = favorites.includes(game.id)

  return (
    <div
      className="relative group bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-colors cursor-pointer"
      onClick={() => onOpen(game)}
    >
      <div className="p-6">
        <div className="text-4xl mb-3">{game.icon}</div>
        <h3 className="text-lg font-semibold">{game.name}</h3>
        <p className="text-sm text-gray-400 mt-1">{game.description}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-xs bg-[${game.color}]/10 text-gray-300 px-2 py-0.5 rounded`}>
            {game.tags[0]}
          </span>
          {score > 0 ? <span className="text-xs text-gray-500">最高分: {score}</span> : null}
          {isNew ? <span className="text-xs text-green-400 font-medium">NEW</span> : null}
        </div>
      </div>
      <button
        className="absolute top-3 right-3 text-lg p-1 rounded hover:bg-gray-800 transition-colors"
        title="收藏"
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(game.id)
        }}
      >
        {favorited ? '⭐' : '☆'}
      </button>
    </div>
  )
}
