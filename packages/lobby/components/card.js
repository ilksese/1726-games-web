import { recordPlay } from '@games/shared'

export function createCard(game, state, onFavorite) {
  const card = document.createElement('div')
  card.className = 'relative group bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-colors cursor-pointer'
  card.innerHTML = `
    <div class="p-6">
      <div class="text-4xl mb-3">${game.icon}</div>
      <h3 class="text-lg font-semibold">${game.name}</h3>
      <p class="text-sm text-gray-400 mt-1">${game.description}</p>
      <div class="flex items-center gap-2 mt-3">
        <span class="text-xs bg-[${game.color}]/10 text-gray-300 px-2 py-0.5 rounded">${game.tags[0]}</span>
        ${state.score > 0 ? `<span class="text-xs text-gray-500">最高分: ${state.score}</span>` : ''}
        ${state.isNew ? `<span class="text-xs text-green-400 font-medium">NEW</span>` : ''}
      </div>
    </div>
    <button class="favorite-btn absolute top-3 right-3 text-lg p-1 rounded hover:bg-gray-800 transition-colors" title="收藏">
      ${state.favorited ? '⭐' : '☆'}
    </button>
  `

  // Favorite button
  const favBtn = card.querySelector('.favorite-btn')
  favBtn.addEventListener('click', e => {
    e.stopPropagation()
    onFavorite()
  })

  // Click to navigate
  card.addEventListener('click', () => {
    recordPlay(game.id)
    window.location.href = game.url
  })

  return card
}