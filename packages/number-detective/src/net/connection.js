const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export class Connection {
  constructor(signalingHost = location.hostname) {
    this.signalingHost = signalingHost
    this.signalingPort = 8787
    this.ws = null
    this.pc = null
    this.channel = null
    this.isHost = false
    this.callbacks = {}
  }

  on(event, cb) { this.callbacks[event] = cb }

  _emit(event, data) { this.callbacks[event]?.(data) }

  _connectWS() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${this.signalingHost}:${this.signalingPort}`)
      ws.onopen = () => resolve(ws)
      ws.onerror = () => reject(new Error('信令服务器连接失败'))
      this.ws = ws
    })
  }

  async createRoom() {
    await this._connectWS()
    this.isHost = true
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('信令服务器响应超时，请确认信令服务器已启动')), 8000)
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'created') { clearTimeout(timer); resolve(msg.code) }
      }
      this.ws.send(JSON.stringify({ type: 'create' }))
    })
  }

  async joinRoom(code) {
    await this._connectWS()
    this.isHost = false
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('信令服务器响应超时，请确认信令服务器已启动')), 8000)
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'paired') { clearTimeout(timer); resolve() }
        if (msg.type === 'error') { clearTimeout(timer); reject(new Error(msg.message)) }
      }
      this.ws.send(JSON.stringify({ type: 'join', code }))
    })
  }

  _startWebRTC() {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.ws.send(JSON.stringify({ type: 'ice', candidate: e.candidate.toJSON() }))
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
        this._emit('disconnect')
      }
    }

    if (this.isHost) {
      this.channel = this.pc.createDataChannel('game')
      this._setupChannel()
    } else {
      this.pc.ondatachannel = (e) => {
        this.channel = e.channel
        this._setupChannel()
      }
    }

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'paired' && this.isHost) {
        this.pc.createOffer().then(offer => {
          this.pc.setLocalDescription(offer)
          this.ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
        })
      } else if (msg.type === 'offer') {
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
        this.pc.createAnswer().then(answer => {
          this.pc.setLocalDescription(answer)
          this.ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }))
        })
      } else if (msg.type === 'answer') {
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
      } else if (msg.type === 'ice') {
        this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
      }
    }
  }

  _setupChannel() {
    this.channel.onopen = () => this._emit('ready')
    this.channel.onmessage = (e) => this._emit('data', JSON.parse(e.data))
    this.channel.onclose = () => this._emit('disconnect')
  }

  async startGame() {
    this._startWebRTC()
  }

  send(data) {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify(data))
    }
  }

  close() {
    this.channel?.close()
    this.pc?.close()
    this.ws?.close()
  }
}
