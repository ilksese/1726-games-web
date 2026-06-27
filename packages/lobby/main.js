import { games, getGame, getAllTags, getScore, isFavorite, toggleFavorite, recordPlay, getRecentPlays } from '@games/shared'
import { createCard } from './components/card.js'
import { createSearch } from './components/search.js'
import { createFilter } from './components/filter.js'

const app = document.getElementById('app')

// State
let searchQuery = ''
let activeTag = 'all'
let showFavoritesOnly = false

function render() {
  let filtered = [...games]

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(g =>
      g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
    )
  }

  if (activeTag !== 'all') {
    filtered = filtered.filter(g => g.tags.includes(activeTag))
  }

  if (showFavoritesOnly) {
    filtered = filtered.filter(g => isFavorite(g.id))
  }

  const recentIds = new Set(getRecentPlays(5).map(r => r.id))

  app.innerHTML = `
    <header class="mb-8">
      <h1 class="text-3xl font-bold">1726 Games</h1>
      <p class="text-gray-400 mt-1">选择游戏开始游玩</p>
    </header>
    <div id="controls" class="flex flex-wrap gap-4 items-center mb-6"></div>
    <div id="cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
  `

  const controls = document.getElementById('controls')
  const cardsEl = document.getElementById('cards')

  // Search
  const searchWidget = createSearch(q => { searchQuery = q; render() })
  controls.appendChild(searchWidget.element)

  // Filter
  const allTags = ['all', ...getAllTags()]
  const filterWidget = createFilter(allTags, activeTag, tag => { activeTag = tag; render() })
  controls.appendChild(filterWidget.element)

  // Favorites toggle
  const favBtn = document.createElement('button')
  favBtn.className = `px-3 py-1.5 rounded-lg text-sm border transition-colors ${
    showFavoritesOnly
      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
      : 'border-gray-700 text-gray-400 hover:border-gray-500'
  }`
  favBtn.textContent = showFavoritesOnly ? '⭐ 收藏' : '☆ 收藏'
  favBtn.addEventListener('click', () => { showFavoritesOnly = !showFavoritesOnly; render() })
  controls.appendChild(favBtn)

  // Cards
  filtered.forEach(game => {
    const state = {
      score: getScore(game.id),
      favorited: isFavorite(game.id),
      isNew: !recentIds.has(game.id),
    }
    const card = createCard(game, state, () => {
      const fav = toggleFavorite(game.id)
      state.favorited = fav
      render()
    })
    cardsEl.appendChild(card)
  })
}

render()