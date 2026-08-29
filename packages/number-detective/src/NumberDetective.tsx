import { useEffect, useRef } from 'react'
import { useAtomValue, getDefaultStore } from 'jotai'
import { useNavigate } from 'react-router-dom'
import type Peer from 'simple-peer'
import { getGame, recordPlay } from '@games/shared'
import { GameEngine } from './game/engine'
import {
  screenAtom,
  modeAtom,
  encodedOfferAtom,
  errorAtom,
  wonAtom,
  toastAtom,
  versionAtom,
  secretAtom,
  myReadyAtom,
  oppReadyAtom,
  guessAtom,
} from './store'
import type { Mode, ToastKind } from './store'
import RoleSelect from './ui/screens/RoleSelect'
import Exchange from './ui/screens/Exchange'
import RoomExchange from './ui/screens/RoomExchange'
import Setup from './ui/screens/Setup'
import Play from './ui/screens/Play'
import Result from './ui/screens/Result'
import FeedbackToast from './ui/FeedbackToast'
import './style.css'

export default function NumberDetective() {
  const navigate = useNavigate()
  const store = getDefaultStore()
  const { set, get } = store

  const screen = useAtomValue(screenAtom)
  const mode = useAtomValue(modeAtom)
  const encodedOffer = useAtomValue(encodedOfferAtom)
  const error = useAtomValue(errorAtom)
  const won = useAtomValue(wonAtom)

  const peerRef = useRef<Peer | null>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const isHostRef = useRef(false)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  function send(data: unknown) {
    if (peerRef.current?.connected) {
      peerRef.current.send(JSON.stringify(data))
    }
  }

  function cleanConnection() {
    peerRef.current?.destroy()
    peerRef.current = null
  }

  function bump() {
    set(versionAtom, get(versionAtom) + 1)
  }

  function showToast(text: string, kind: ToastKind) {
    set(toastAtom, { text, kind, id: Date.now() })
  }

  function goToRoleSelect(err = '') {
    cleanConnection()
    set(errorAtom, err)
    set(screenAtom, 'role-select')
  }

  function goToExchange(nextMode: Mode) {
    cleanConnection()
    if (nextMode === 'host-cloudflare' || nextMode === 'guest-cloudflare') {
      set(modeAtom, nextMode)
      set(screenAtom, 'room-exchange')
      return
    }

    let resolved: Mode = nextMode
    let offer: string | null = null
    const hash = location.hash
    if (hash.startsWith('#s=')) {
      offer = decodeURIComponent(hash.slice(3))
      resolved = 'guest'
    }
    set(modeAtom, resolved)
    set(encodedOfferAtom, offer)
    set(screenAtom, 'exchange')
  }

  function goToSetup() {
    set(secretAtom, '')
    set(myReadyAtom, false)
    set(oppReadyAtom, false)
    set(screenAtom, 'setup')
  }

  function handleDisconnect() {
    if (!engineRef.current?.isOver) {
      engineRef.current = null
      goToRoleSelect('连接已断开')
    }
  }

  function handleConnected(peer: Peer) {
    peerRef.current = peer
    const m = get(modeAtom)
    isHostRef.current = m === 'host' || m === 'host-cloudflare'
    peer.on('data', (data: unknown) => {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer)
      handleGameMessage(JSON.parse(text))
    })
    peer.on('close', () => handleDisconnect())
    peer.on('error', () => handleDisconnect())
    goToSetup()
  }

  function handleGameMessage(msg: Record<string, unknown> & { type?: string }) {
    if (msg.type === 'secret-ready') {
      set(oppReadyAtom, true)
      tryStartGame()
    }

    if (msg.type === 'guess' && engineRef.current) {
      const engine = engineRef.current
      const response = engine.processOppGuess(msg.guess as string)
      send(response)
      if (engine.isOver) {
        showToast('对方猜对了', 'lose')
        setTimeout(() => goToResult(engine.won), 800)
      } else {
        bump()
      }
    }

    if (msg.type === 'feedback' && engineRef.current) {
      const engine = engineRef.current
      engine.processFeedback(msg as never)
      const last = engine.myGuesses[engine.myGuesses.length - 1]
      if (last) {
        const kind: ToastKind = msg.win
          ? 'win'
          : msg.matchPoint
            ? 'match'
            : msg.binary === false
              ? 'lose'
              : 'info'
        showToast(last.resultText, kind)
      }
      if (engine.isOver) {
        setTimeout(() => goToResult(engine.won), 800)
      } else {
        bump()
      }
    }

    if (msg.type === 'rematch') {
      goToSetup()
    }
  }

  function tryStartGame() {
    if (get(myReadyAtom) && get(oppReadyAtom) && !engineRef.current) {
      engineRef.current = new GameEngine(get(secretAtom), isHostRef.current)
      goToPlay()
    }
  }

  function goToPlay() {
    set(guessAtom, '')
    set(screenAtom, 'play')
  }

  function submitGuess(guess: string) {
    const engine = engineRef.current
    if (engine && guess.length === 4) {
      const result = engine.processMyGuess(guess)
      if (result.type === 'guess') {
        send(result)
        bump()
      }
    }
  }

  function goToResult(w: boolean | null) {
    if (engineRef.current) engineRef.current.won = w
    set(wonAtom, !!w)
    set(screenAtom, 'result')
  }

  function handleSetupReady() {
    set(myReadyAtom, true)
    send({ type: 'secret-ready' })
    tryStartGame()
  }

  function handleRematch() {
    send({ type: 'rematch' })
    engineRef.current = null
    goToSetup()
  }

  function handleLeave() {
    cleanConnection()
    navigateRef.current('/')
  }

  useEffect(() => {
    getGame('number-detective')
    recordPlay('number-detective')
    return () => cleanConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="nd-texture" aria-hidden="true" />
      <a className="nd-back-link" href="/" aria-label="返回大厅">
        ←
      </a>
      <div className="nd-app">
        {screen === 'role-select' && (
          <RoleSelect
            error={error}
            onCreateLan={() => goToExchange('host')}
            onJoinLan={() => goToExchange('guest')}
            onCreateCloudflare={() => goToExchange('host-cloudflare')}
            onJoinCloudflare={() => goToExchange('guest-cloudflare')}
          />
        )}
        {screen === 'exchange' && (
          <Exchange
            mode={mode === 'guest' ? 'guest' : 'host'}
            encodedOffer={encodedOffer}
            onConnected={handleConnected}
            onBack={() => goToRoleSelect()}
          />
        )}
        {screen === 'room-exchange' && (
          <RoomExchange
            mode={mode === 'guest-cloudflare' ? 'guest-cloudflare' : 'host-cloudflare'}
            onConnected={handleConnected}
            onBack={() => goToRoleSelect()}
          />
        )}
        {screen === 'setup' && <Setup onReady={handleSetupReady} />}
        {screen === 'play' && <Play engineRef={engineRef} submitGuess={submitGuess} />}
        {screen === 'result' && (
          <Result won={won} onRematch={handleRematch} onLeave={handleLeave} />
        )}
        <FeedbackToast />
      </div>
    </>
  )
}
