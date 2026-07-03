const ROOM_TTL_MS = 10 * 60 * 1000

export class RoomObject {
  constructor(state, env) {
    this.state = state
    this.env = env
  }

  async fetch(request) {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (request.method === 'POST' && action === 'create') return this.create(request)
    if (request.method === 'GET' && action === 'offer') return this.getOffer()
    if (request.method === 'POST' && action === 'answer') return this.submitAnswer(request)
    if (request.method === 'GET' && action === 'answer') return this.getAnswer()
    if (request.method === 'DELETE' && action === 'close') return this.close()

    return json({ error: 'NOT_FOUND' }, 404)
  }

  async create(request) {
    const existing = await this.getActiveRoom()
    if (existing) return json({ error: 'ROOM_EXISTS' }, 409)

    const body = await readJson(request)
    if (!body.offerSdp || typeof body.offerSdp !== 'string') {
      return json({ error: 'INVALID_OFFER' }, 400)
    }

    const now = Date.now()
    await this.state.storage.put('room', {
      offerSdp: body.offerSdp,
      answerSdp: null,
      status: 'waiting',
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
    })

    return json({ ok: true })
  }

  async getOffer() {
    const room = await this.getActiveRoom()
    if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404)
    if (room.status !== 'waiting') return json({ error: 'ROOM_OCCUPIED' }, 409)
    return json({ offerSdp: room.offerSdp })
  }

  async submitAnswer(request) {
    const body = await readJson(request)
    if (!body.answerSdp || typeof body.answerSdp !== 'string') {
      return json({ error: 'INVALID_ANSWER' }, 400)
    }

    const room = await this.getActiveRoom()
    if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404)
    if (room.status !== 'waiting') return json({ error: 'ROOM_OCCUPIED' }, 409)

    room.answerSdp = body.answerSdp
    room.status = 'matched'
    await this.state.storage.put('room', room)

    return json({ ok: true })
  }

  async getAnswer() {
    const room = await this.getActiveRoom()
    if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404)
    if (!room.answerSdp) return json({ status: 'waiting' })
    return json({ answerSdp: room.answerSdp })
  }

  async close() {
    await this.state.storage.put('room', { status: 'closed', closedAt: Date.now() })
    return json({ ok: true })
  }

  async getActiveRoom() {
    const room = await this.state.storage.get('room')
    if (!room) return null
    if (room.status === 'closed') return null
    if (room.expiresAt && Date.now() > room.expiresAt && room.status === 'waiting') {
      await this.state.storage.put('room', { ...room, status: 'expired' })
      return null
    }
    return room
  }
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
