export const games = [
  {
    id: 'game-a',
    name: '游戏A',
    url: '/game-a.html',
    icon: '🎮',
    tags: ['策略'],
    description: '首个游戏，敬请期待',
    color: '#6366f1',
  },
  {
    id: 'game-b',
    name: '游戏B',
    url: '/game-b.html',
    icon: '🎯',
    tags: ['动作'],
    description: '第二个游戏，开发中',
    color: '#ec4899',
  },
]

export function getGame(id) {
  return games.find(g => g.id === id) || null
}

export function getGamesByTag(tag) {
  return games.filter(g => g.tags.includes(tag))
}

export function getAllTags() {
  return [...new Set(games.flatMap(g => g.tags))]
}
