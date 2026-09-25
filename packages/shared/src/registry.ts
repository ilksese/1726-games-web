export interface Game {
  id: string
  name: string
  url: string
  icon: string
  tags: string[]
  description: string
  color: string
}

export const games: Game[] = [
  {
    id: 'game-a',
    name: '游戏A',
    url: '/game-a',
    icon: '🎮',
    tags: ['策略'],
    description: '首个游戏，敬请期待',
    color: '#6366f1',
  },
  {
    id: 'game-b',
    name: '游戏B',
    url: '/game-b',
    icon: '🎯',
    tags: ['动作'],
    description: '第二个游戏，开发中',
    color: '#ec4899',
  },
  {
    id: 'number-detective',
    name: '数字侦探',
    url: '/number-detective',
    icon: '🕵️',
    tags: ['益智', '双人'],
    description: '局域网双人数字破译',
    color: '#10b981',
  },
  {
    id: 'who-drinks',
    name: '谁喝酒',
    url: '/who-drinks',
    icon: '🍷',
    tags: ['聚会'],
    description: '翻牌喝酒，杯杯见真情',
    color: '#c6283a',
  },
  {
    id: 'wanxiang-mahjong',
    name: '万象麻将',
    url: '/wanxiang-mahjong',
    icon: '🀄',
    tags: ['聚会', '麻将'],
    description: '线下打牌，线上发技能、记胜次',
    color: '#c45c3e',
  },
]

export function getGame(id: string): Game | null {
  return games.find((g) => g.id === id) || null
}

export function getGamesByTag(tag: string): Game[] {
  return games.filter((g) => g.tags.includes(tag))
}

export function getAllTags(): string[] {
  return [...new Set(games.flatMap((g) => g.tags))]
}
