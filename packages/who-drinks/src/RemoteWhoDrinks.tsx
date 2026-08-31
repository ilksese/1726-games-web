import { useEffect, useMemo, useState } from 'react'
import { getGame, recordPlay } from '@games/shared'
import { COPY_POOL, SVG_BACK, SVG_BACK_BAR, SVG_GLASS, SVG_SAFE } from './visuals'

interface RemoteRoomParams {
  roomCode: string
  serverBase: string
}

type RoomPhase = 'waiting' | 'confirming' | 'game-select' | 'started' | 'finished'

interface PlayerState {
  id: string
  name: string
  captain: boolean
  connected: boolean
  confirmed: boolean
}

interface RevealedCard {
  index: number
  kind: 'drink' | 'safe'
  actorId: string
  actorName: string
}

interface GameActionState {
  id: number
  type: string
  index: number
  kind?: 'drink' | 'safe'
  actorId?: string
  actorName?: string
}

interface WhoDrinksState {
  round: number
  total: number
  drinks: number
  remainingDrinks: number
  revealed: RevealedCard[]
  locked: boolean
  lastAction?: GameActionState
}

interface RoomState {
  code: string
  phase: RoomPhase
  revision: number
  players: PlayerState[]
  selectedGame?: { id: string; name: string }
  gameUrl?: string
  gameState?: WhoDrinksState
}

interface GameResponse {
  playerId: string
  state: RoomState
}

interface RoomEvent {
  type: string
  state: RoomState
  message?: string
}

class RoomRequestError extends Error {
  code: string

  constructor(message: string, code = '') {
    super(message)
    this.code = code
  }
}

export function getRemoteRoomParams(): RemoteRoomParams | null {
  const params = new URLSearchParams(window.location.search)
  const roomCode = String(params.get('room') || '').replace(/\D/g, '').slice(0, 6)
  const server = params.get('server')
  if (roomCode.length !== 6 || !server) return null

  try {
    const url = new URL(server)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return { roomCode, serverBase: url.origin }
  } catch {
    return null
  }
}

export default function RemoteWhoDrinks({ roomCode, serverBase }: RemoteRoomParams) {
  const [state, setState] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [connection, setConnection] = useState<'connecting' | 'online' | 'reconnecting'>('connecting')
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const roomURL = `${serverBase}/room/${encodeURIComponent(roomCode)}`

  useEffect(() => {
    getGame('who-drinks')
    recordPlay('who-drinks')
  }, [])

  useEffect(() => {
    let disposed = false
    let source: EventSource | null = null

    const applyState = (next: RoomState) => {
      if (disposed) return
      setState((current) => (!current || next.revision >= current.revision ? next : current))
    }

    const connect = async () => {
      setConnection('connecting')
      setError('')
      try {
        const response = await roomRequest<GameResponse>(serverBase, roomCode, 'game')
        if (disposed) return
        setPlayerId(response.playerId)
        applyState(response.state)

        source = new EventSource(roomEndpoint(serverBase, roomCode, 'events'), {
          withCredentials: true,
        })
        source.onopen = () => {
          if (!disposed) setConnection('online')
        }
        source.onmessage = (event) => {
          if (disposed) return
          try {
            const payload = JSON.parse(event.data) as RoomEvent
            applyState(payload.state)
          } catch {
            setError('收到无法识别的房间消息')
          }
        }
        source.onerror = () => {
          if (!disposed) setConnection('reconnecting')
        }
      } catch (reason) {
        if (disposed) return
        const requestError = reason as RoomRequestError
        setError(requestError.message || '无法连接房间服务器')
        setConnection('reconnecting')
      }
    }

    void connect()
    return () => {
      disposed = true
      source?.close()
    }
  }, [roomCode, serverBase])

  useEffect(() => {
    if (!state) return
    if (state.phase === 'waiting' || state.phase === 'confirming' || state.phase === 'game-select') {
      window.location.replace(roomURL)
    }
  }, [roomURL, state])

  const revealedByIndex = useMemo(() => {
    const result = new Map<number, RevealedCard>()
    for (const card of state?.gameState?.revealed || []) result.set(card.index, card)
    return result
  }, [state?.gameState?.revealed])

  const self = state?.players.find((player) => player.id === playerId)
  const game = state?.gameState
  const lastAction = game?.lastAction
  const drinkPending = state?.phase === 'started' && game?.locked && lastAction?.kind === 'drink'
  const prizeCopy = COPY_POOL[(lastAction?.id || 0) % COPY_POOL.length]

  const performAction = async (type: string, index = -1) => {
    if (pendingAction) return
    setPendingAction(`${type}:${index}`)
    setError('')
    try {
      const response = await roomRequest<{ state: RoomState }>(serverBase, roomCode, 'game/action', {
        type,
        index,
      })
      setState((current) => (!current || response.state.revision >= current.revision ? response.state : current))
    } catch (reason) {
      setError((reason as Error).message || '游戏操作失败')
    } finally {
      setPendingAction('')
    }
  }

  const reopenRoom = async () => {
    if (pendingAction) return
    setPendingAction('reopen')
    try {
      await roomRequest(serverBase, roomCode, 'reopen', {})
      window.location.assign(roomURL)
    } catch (reason) {
      setError((reason as Error).message || '重新开启房间失败')
      setPendingAction('')
    }
  }

  if (error && !state) {
    return (
      <RemoteShell connection={connection}>
        <div className="wd-remote-message">
          <h1>无法进入同步牌局</h1>
          <p>{error}</p>
          <a className="wd-btn wd-btn--primary" href={roomURL}>
            返回组队房间
          </a>
        </div>
      </RemoteShell>
    )
  }

  if (!state || !game || state.selectedGame?.id !== 'who-drinks') {
    return (
      <RemoteShell connection={connection}>
        <div className="wd-remote-message">
          <span className="wd-remote-spinner" aria-hidden="true" />
          <h1>正在同步牌局</h1>
          <p>{error || '等待房间服务器发送游戏状态…'}</p>
        </div>
      </RemoteShell>
    )
  }

  const boardLocked = state.phase !== 'started' || game.locked || Boolean(pendingAction)

  return (
    <RemoteShell connection={connection}>
      <div className="wd-shell wd-shell--game wd-shell--remote">
        <div className="wd-bar">
          <a
            className="wd-bar-btn"
            href={roomURL}
            aria-label="返回组队房间"
            dangerouslySetInnerHTML={{ __html: SVG_BACK_BAR }}
          />
          <div className="wd-bar-center">
            <span className="wd-bar-count">
              剩余 <b>{game.remainingDrinks}</b> 杯
            </span>
            <span className="wd-bar-progress">
              第 {game.round} 轮 · {game.revealed.length} / {game.total}
            </span>
          </div>
          <div className={`wd-remote-status wd-remote-status--${connection}`}>
            <span aria-hidden="true" />
            {connection === 'online' ? '同步中' : connection === 'connecting' ? '连接中' : '重连中'}
          </div>
        </div>

        <div className="wd-player-strip" aria-label="房间玩家">
          {state.players.map((player) => (
            <span
              key={player.id}
              className={`wd-player-chip${player.id === playerId ? ' is-self' : ''}${player.connected ? '' : ' is-offline'}`}
            >
              {player.captain ? '♛ ' : ''}{player.name}
            </span>
          ))}
        </div>

        {error ? <div className="wd-remote-error" role="alert">{error}</div> : null}
        {lastAction?.type === 'flip' ? (
          <div className="wd-remote-activity" aria-live="polite">
            {lastAction.actorName} 翻开了第 {lastAction.index + 1} 张牌
          </div>
        ) : null}

        <div className="wd-grid">
          {Array.from({ length: game.total }, (_, index) => {
            const revealed = revealedByIndex.get(index)
            const kind = revealed?.kind || 'safe'
            const cardClass = `wd-card${revealed ? ' is-flipped' : ''}${
              revealed?.kind === 'safe' ? ' is-safe' : ''
            }${revealed?.kind === 'drink' ? ' is-drink' : ''}`
            return (
              <button
                key={index}
                type="button"
                className={cardClass}
                aria-label={revealed ? `第 ${index + 1} 张牌，${revealed.kind === 'drink' ? '酒杯' : '安全'}` : `翻开第 ${index + 1} 张牌`}
                disabled={boardLocked || Boolean(revealed)}
                onClick={() => void performAction('flip', index)}
              >
                <span className="wd-card-inner">
                  <span
                    className="wd-card-face wd-card-face--back"
                    dangerouslySetInnerHTML={{ __html: SVG_BACK }}
                  />
                  <span className={`wd-card-face wd-card-face--front wd-card-face--${kind}`}>
                    <span
                      className="wd-card-symbol"
                      dangerouslySetInnerHTML={{ __html: kind === 'drink' ? SVG_GLASS : SVG_SAFE }}
                    />
                    {revealed ? <small className="wd-card-actor">{revealed.actorName}</small> : null}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {drinkPending ? (
        <div className="wd-overlay">
          <div className="wd-prize">
            <div className="wd-prize-glow" />
            <div className="wd-prize-card">
              <div className="wd-prize-glass" dangerouslySetInnerHTML={{ __html: SVG_GLASS }} />
              <h2 className="wd-prize-title">{lastAction.actorName} 喝一杯！</h2>
              <p className="wd-prize-copy">{prizeCopy}</p>
            </div>
            <div className="wd-prize-actions">
              <button
                className="wd-btn wd-btn--ghost"
                disabled={Boolean(pendingAction)}
                onClick={() => void performAction('continue')}
              >
                继续
              </button>
              <button
                className="wd-btn wd-btn--secondary"
                disabled={Boolean(pendingAction)}
                onClick={() => void performAction('next-round')}
              >
                下一轮
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.phase === 'finished' ? (
        <div className="wd-overlay">
          <div className="wd-prize wd-prize--finished">
            <div className="wd-prize-glow" />
            <div className="wd-prize-card">
              <div className="wd-prize-glass" dangerouslySetInnerHTML={{ __html: SVG_GLASS }} />
              <h2 className="wd-prize-title">第 {game.round} 轮结束</h2>
              <p className="wd-prize-copy">
                {lastAction?.actorName ? `${lastAction.actorName} 翻出了最后一杯。` : '所有酒杯都已经翻出。'}
              </p>
            </div>
            <div className="wd-remote-finish-actions">
              <button
                className="wd-btn wd-btn--secondary"
                disabled={Boolean(pendingAction)}
                onClick={() => void performAction('next-round')}
              >
                再来一轮
              </button>
              {self?.captain ? (
                <button
                  className="wd-btn wd-btn--primary"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void reopenRoom()}
                >
                  重新开启房间
                </button>
              ) : (
                <a className="wd-btn wd-btn--ghost" href={roomURL}>
                  返回组队房间
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </RemoteShell>
  )
}

function RemoteShell({
  connection,
  children,
}: {
  connection: 'connecting' | 'online' | 'reconnecting'
  children: React.ReactNode
}) {
  return (
    <>
      <div className="wd-texture" aria-hidden="true" />
      <div className="wd-app" data-connection={connection}>{children}</div>
    </>
  )
}

function roomEndpoint(serverBase: string, roomCode: string, suffix: string) {
  return `${serverBase}/api/rooms/${encodeURIComponent(roomCode)}/${suffix}`
}

async function roomRequest<T = unknown>(
  serverBase: string,
  roomCode: string,
  suffix: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(roomEndpoint(serverBase, roomCode, suffix), {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    credentials: 'include',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new RoomRequestError(data.error?.message || `请求失败（${response.status}）`, data.error?.code)
  }
  return data as T
}
