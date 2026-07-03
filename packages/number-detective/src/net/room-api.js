const DEFAULT_API_BASE = 'https://1726-games-matchmaking.1726.workers.dev'
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 10 * 60 * 1000

const API_BASE = import.meta.env.VITE_MATCHMAKING_API_BASE || DEFAULT_API_BASE

export async function createRoom(offerSdp) {
  const data = await request('/rooms', {
    method: 'POST',
    body: { offerSdp },
  })
  return data.roomCode
}

export async function getOffer(roomCode) {
  const data = await request(`/rooms/${normalizeRoomCode(roomCode)}/offer`)
  return data.offerSdp
}

export async function submitAnswer(roomCode, answerSdp) {
  await request(`/rooms/${normalizeRoomCode(roomCode)}/answer`, {
    method: 'POST',
    body: { answerSdp },
  })
}

export async function pollAnswer(roomCode, { signal } = {}) {
  const startedAt = Date.now()
  const normalized = normalizeRoomCode(roomCode)

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw new Error('等待已取消')
    const data = await request(`/rooms/${normalized}/answer`, { signal })
    if (data.answerSdp) return data.answerSdp
    await delay(POLL_INTERVAL_MS, signal)
  }

  throw new Error('等待访客超时')
}

export async function closeRoom(roomCode) {
  if (!roomCode) return
  await request(`/rooms/${normalizeRoomCode(roomCode)}`, { method: 'DELETE' })
}

export function normalizeRoomCode(roomCode) {
  return String(roomCode || '').replace(/\D/g, '').slice(0, 6)
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(toUserMessage(data.error))
  return data
}

function toUserMessage(error) {
  if (error === 'ROOM_NOT_FOUND') return '房间不存在或已过期'
  if (error === 'ROOM_OCCUPIED') return '房间已被占用'
  if (error === 'INVALID_ROOM_CODE') return '房间码格式错误'
  if (error === 'INVALID_OFFER') return '创建房间失败'
  if (error === 'INVALID_ANSWER') return '加入房间失败'
  return '匹配服务暂不可用'
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('等待已取消'))
    }, { once: true })
  })
}
