import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 8787
const rooms = new Map()

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`Signaling server running on port ${PORT}`)
})

wss.on('error', (err) => {
  console.error(`Signaling server failed to start on port ${PORT}: ${err.message}`)
  process.exit(1)
})

wss.on('connection', (ws) => {
  let currentRoom = null
  let isHost = false

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())

    if (msg.type === 'create') {
      let code
      do { code = generateCode() } while (rooms.has(code))
      rooms.set(code, { host: ws, guest: null })
      currentRoom = code
      isHost = true
      ws.send(JSON.stringify({ type: 'created', code }))
    }

    else if (msg.type === 'join') {
      const room = rooms.get(msg.code)
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }))
      } else if (room.guest) {
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }))
      } else {
        room.guest = ws
        currentRoom = msg.code
        room.host.send(JSON.stringify({ type: 'paired' }))
        ws.send(JSON.stringify({ type: 'paired' }))
      }
    }

    else if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
      const room = rooms.get(currentRoom)
      if (room) {
        const target = isHost ? room.guest : room.host
        if (target) target.send(JSON.stringify(msg))
      }
    }
  })

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom)
      if (room.guest) {
        room.guest.send(JSON.stringify({ type: 'peer-disconnected' }))
        room.guest.close()
      }
      if (room.host && room.host !== ws) {
        room.host.send(JSON.stringify({ type: 'peer-disconnected' }))
        room.host.close()
      }
      rooms.delete(currentRoom)
    }
  })
})

