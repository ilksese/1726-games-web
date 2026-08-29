import { games } from './registry'

const PREFIX = '@games/'

function read<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function saveScore(gameId: string, score: number): void {
  const best = getScore(gameId)
  if (score > best) write(`score/${gameId}`, score)
}

export function getScore(gameId: string): number {
  return read<number>(`score/${gameId}`) ?? 0
}

export function toggleFavorite(gameId: string): boolean {
  const current = isFavorite(gameId)
  write(`fav/${gameId}`, !current)
  return !current
}

export function isFavorite(gameId: string): boolean {
  return read<boolean>(`fav/${gameId}`) === true
}

export function getFavorites(): string[] {
  return games.filter((g) => isFavorite(g.id)).map((g) => g.id)
}

export function recordPlay(gameId: string): void {
  const recent = read<Array<{ id: string; time: number }>>('recent') ?? []
  const filtered = recent.filter((e) => e.id !== gameId)
  filtered.unshift({ id: gameId, time: Date.now() })
  write('recent', filtered.slice(0, 20))
}

export function getRecentPlays(limit = 5): Array<{ id: string; time: number }> {
  const recent = read<Array<{ id: string; time: number }>>('recent') ?? []
  return recent.slice(0, limit)
}
