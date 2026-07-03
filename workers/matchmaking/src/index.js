export { RoomObject } from './room-object.js'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    try {
      if (request.method === 'POST' && parts.length === 1 && parts[0] === 'rooms') {
        return withCors(await createRoom(request, env))
      }

      if (parts.length === 3 && parts[0] === 'rooms') {
        const [, roomCode, resource] = parts
        if (!isRoomCode(roomCode)) return withCors(json({ error: 'INVALID_ROOM_CODE' }, 400))
        if (request.method === 'GET' && resource === 'offer') return withCors(await forward(env, roomCode, request, 'offer'))
        if (request.method === 'POST' && resource === 'answer') return withCors(await forward(env, roomCode, request, 'answer'))
        if (request.method === 'GET' && resource === 'answer') return withCors(await forward(env, roomCode, request, 'answer'))
      }

      if (request.method === 'DELETE' && parts.length === 2 && parts[0] === 'rooms') {
        const [, roomCode] = parts
        if (!isRoomCode(roomCode)) return withCors(json({ error: 'INVALID_ROOM_CODE' }, 400))
        return withCors(await forward(env, roomCode, request, 'close'))
      }

      return withCors(json({ error: 'NOT_FOUND' }, 404))
    } catch {
      return withCors(json({ error: 'INTERNAL_ERROR' }, 500))
    }
  },
}

async function createRoom(request, env) {
  const bodyText = await request.text()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomCode = createRoomCode()
    const id = env.ROOMS.idFromName(roomCode)
    const stub = env.ROOMS.get(id)
    const response = await stub.fetch(new Request('https://room.local/?action=create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyText,
    }))

    if (response.ok) return json({ roomCode })
    if (response.status !== 409) return response
  }

  return json({ error: 'ROOM_CODE_UNAVAILABLE' }, 503)
}

function forward(env, roomCode, request, action) {
  const id = env.ROOMS.idFromName(roomCode)
  const stub = env.ROOMS.get(id)
  return stub.fetch(new Request(`https://room.local/?action=${action}`, request))
}

function createRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isRoomCode(roomCode) {
  return /^\d{6}$/.test(roomCode)
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function withCors(response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
  return new Response(response.body, { status: response.status, headers })
}
