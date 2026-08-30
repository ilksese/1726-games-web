import { useEffect, useRef, useState } from 'react'
import type Peer from 'simple-peer'
import { createHostPeer, createGuestPeer, applyAnswer } from '../../net/signaling'
import {
  createRoom,
  pollAnswer,
  closeRoom,
  getOffer,
  submitAnswer,
  normalizeRoomCode,
} from '../../net/room-api'

interface RoomExchangeProps {
  mode: 'host-cloudflare' | 'guest-cloudflare'
  onConnected: (peer: Peer) => void
  onBack: () => void
}

export default function RoomExchange({ mode, onConnected, onBack }: RoomExchangeProps) {
  const [error, setError] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [awaitText, setAwaitText] = useState('创建中...')
  const [showAwait, setShowAwait] = useState(mode === 'host-cloudflare')
  const [guestInitHidden, setGuestInitHidden] = useState(false)

  const roomInputRef = useRef<HTMLInputElement>(null)
  const pendingPeerRef = useRef<Peer | null>(null)
  const roomCodeRef = useRef<string | null>(null)
  const matchedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const destroyedRef = useRef(false)
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected

  const showError = (msg: string) => setError(msg)

  async function joinRoom(rawCode: string) {
    const code = normalizeRoomCode(rawCode)
    if (code.length !== 6) {
      showError('请输入 6 位房间码')
      return
    }

    try {
      showError('')
      setGuestInitHidden(true)
      setShowAwait(true)
      setAwaitText('正在连接房主...')

      const offerSdp = await getOffer(code)
      const { peer, signalData } = await createGuestPeer(offerSdp)
      if (destroyedRef.current) {
        peer.destroy()
        return
      }
      pendingPeerRef.current = peer

      await submitAnswer(code, signalData)
      matchedRef.current = true
      setAwaitText('匹配成功，正在建立连接...')

      peer.on('connect', () => {
        if (!destroyedRef.current) onConnectedRef.current(peer)
      })
    } catch (e) {
      setGuestInitHidden(false)
      setShowAwait(false)
      showError((e as Error).message || '加入房间失败')
    }
  }

  useEffect(() => {
    if (mode === 'host-cloudflare') {
      createHostPeer()
        .then(async ({ peer, signalData }) => {
          if (destroyedRef.current) {
            peer.destroy()
            return
          }
          pendingPeerRef.current = peer

          const code = await createRoom(signalData)
          if (destroyedRef.current) {
            peer.destroy()
            return
          }
          roomCodeRef.current = code
          setRoomCode(code)
          setAwaitText('等待访客输入房间码...')

          abortRef.current = new AbortController()
          const answerSdp = await pollAnswer(code, { signal: abortRef.current.signal })
          if (destroyedRef.current) {
            peer.destroy()
            return
          }

          matchedRef.current = true
          applyAnswer(peer, answerSdp)
          setAwaitText('匹配成功，正在建立连接...')

          peer.on('connect', () => {
            if (!destroyedRef.current) onConnectedRef.current(peer)
          })
        })
        .catch((e) => {
          if (!destroyedRef.current) showError((e as Error).message || '连接创建失败')
        })
    }

    return () => {
      destroyedRef.current = true
      abortRef.current?.abort()
      if (roomCodeRef.current && !matchedRef.current) closeRoom(roomCodeRef.current).catch(() => {})
    }
  }, [mode])

  if (mode === 'host-cloudflare') {
    return (
      <div className="nd-shell nd-shell--stack">
        <div>
          <h2 className="nd-screen-title">创建房间（Cloudflare）</h2>
          <p className="nd-screen-subtitle">把房间码告诉对手，对手输入后会自动连接</p>
        </div>
        <section className="nd-card nd-panel nd-stack text-center">
          <p className="text-sm text-slate-500">房间码</p>
          <div className="min-h-[4rem] flex items-center justify-center text-4xl font-bold tracking-[0.35em] text-[#59d98a]">
            {roomCode || '------'}
          </div>
          <p className="nd-surface-note whitespace-pre-line">{awaitText}</p>
        </section>
        <p className="text-center text-sm text-red-300">{error}</p>
        <button type="button" className="nd-btn nd-btn--ghost self-center" onClick={onBack}>
          ← 返回
        </button>
      </div>
    )
  }

  return (
    <div className="nd-shell nd-shell--stack">
      <div>
        <h2 className="nd-screen-title">加入房间（Cloudflare）</h2>
        <p className="nd-screen-subtitle">输入房主显示的 6 位房间码</p>
      </div>
      <section className={`nd-card nd-panel nd-stack${guestInitHidden ? ' hidden' : ''}`}>
        <input
          ref={roomInputRef}
          inputMode="numeric"
          maxLength={6}
          placeholder="例如 482913"
          className="nd-input text-center text-2xl tracking-[0.25em]"
          onInput={(e) => {
            e.currentTarget.value = normalizeRoomCode(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') joinRoom(roomInputRef.current?.value || '')
          }}
        />
        <button
          type="button"
          className="nd-btn nd-btn--primary w-full"
          onClick={() => joinRoom(roomInputRef.current?.value || '')}
        >
          加入房间
        </button>
      </section>
      <div className={`nd-surface-note text-center${showAwait ? '' : ' hidden'}`}>{awaitText}</div>
      <p className="text-center text-sm text-red-300">{error}</p>
      <button type="button" className="nd-btn nd-btn--ghost self-center" onClick={onBack}>
        ← 返回
      </button>
    </div>
  )
}
