import { useAtom, useAtomValue } from 'jotai'
import { useNavigate } from 'react-router-dom'
import {
  games,
  getAllTags,
  getScore,
  isFavorite,
  getRecentPlays,
  recordPlay,
} from '@games/shared'
import { searchQueryAtom, activeTagAtom, showFavoritesOnlyAtom, favoritesAtom } from './state'
import { Card } from './components/Card'
import { Search } from './components/Search'
import { Filter } from './components/Filter'

export default function Lobby() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)
  const [activeTag, setActiveTag] = useAtom(activeTagAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useAtom(showFavoritesOnlyAtom)
  const favorites = useAtomValue(favoritesAtom)

  let filtered = [...games]

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q),
    )
  }

  if (activeTag !== 'all') {
    filtered = filtered.filter((g) => g.tags.includes(activeTag))
  }

  if (showFavoritesOnly) {
    filtered = filtered.filter((g) => isFavorite(g.id))
  }

  const recentIds = new Set(getRecentPlays(5).map((r) => r.id))
  const allTags = ['all', ...getAllTags()]

  const handleOpen = (game: (typeof games)[number]) => {
    recordPlay(game.id)
    navigate(game.url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">1726 Games</h1>
          <p className="text-gray-400 mt-1">选择游戏开始游玩</p>
        </header>
        <div className="flex flex-wrap gap-4 items-center mb-6">
          <Search
            key={`${searchQuery}|${activeTag}|${showFavoritesOnly}|${favorites.join(',')}`}
            onQuery={setSearchQuery}
          />
          <Filter tags={allTags} activeTag={activeTag} onSelect={setActiveTag} />
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              showFavoritesOnly
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            {showFavoritesOnly ? '⭐ 收藏' : '☆ 收藏'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((game) => (
            <Card
              key={game.id}
              game={game}
              score={getScore(game.id)}
              isNew={!recentIds.has(game.id)}
              onOpen={handleOpen}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
