import { games } from './registry.js'

const PREFIX = '@games/'

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function write(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function saveScore(gameId, score) {
  const best = getScore(gameId)
  if (score > best) write(`score/${gameId}`, score)
}

export function getScore(gameId) {
  return read(`score/${gameId}`) ?? 0
}

export function toggleFavorite(gameId) {
  const current = isFavorite(gameId)
  write(`fav/${gameId}`, !current)
  return !current
}

export function isFavorite(gameId) {
  return read(`fav/${gameId}`) === true
}

export function getFavorites() {
  return games
    .filter(g => isFavorite(g.id))
    .map(g => g.id)
}

export function recordPlay(gameId) {
  const recent = read('recent') ?? []
  const filtered = recent.filter(e => e.id !== gameId)
  filtered.unshift({ id: gameId, time: Date.now() })
  write('recent', filtered.slice(0, 20))
}

export function getRecentPlays(limit = 5) {
  const recent = read('recent') ?? []
  return recent.slice(0, limit)
}
