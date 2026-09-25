import { useEffect, useState } from 'react'
import { getGame, recordPlay } from '@games/shared'

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
}

interface PlayedCard {
  skillId: string
  player: string
}

interface SeatState {
  id?: string
  name: string
  score?: number
  handCount?: number
  hand?: unknown[]
  ready?: boolean
  inMatch?: boolean
}

interface VoteState {
  kind: string
  proposer: string
  nominee?: string
  expiresAt: number
  agreed: string[]
  pending: string[]
}

interface WanxiangState {
  phase?: string
  round?: number
  scores?: SeatState[]
  seats?: SeatState[]
  played?: PlayedCard[]
  vote?: VoteState | null
  flash?: string
}

interface RoomState {
  code: string
  phase: RoomPhase
  revision: number
  players: PlayerState[]
  selectedGame?: { id: string; name: string }
  wanxiang?: WanxiangState
}

interface GameResponse {
  name: string
  key: string
  state: RoomState
}

interface PlayerSeat {
  name: string
  key: string
}

interface RoomEvent {
  type: string
  state: RoomState
  message?: string
}

const SKILLS: Record<string, { name: string; effect: string }> = {
  'no-pung': { name: '禁止碰牌', effect: '指定一名玩家，直到这一轮结束，禁止碰牌。' },
  'no-kong': { name: '禁止杠牌', effect: '指定一名玩家，直到这一轮结束，禁止杠牌。' },
  'no-chow': { name: '禁止吃牌', effect: '指定一名玩家，直到这一轮结束，禁止吃牌。' },
  'no-win': { name: '禁止胡牌', effect: '指定一名玩家，直到这一轮结束，禁止胡牌。' },
  'no-dots': { name: '禁止筒子', effect: '指定一名玩家，直到这一轮结束，禁止筒子。' },
  'no-bams': { name: '禁止条子', effect: '指定一名玩家，直到这一轮结束，禁止条子。' },
  'no-chars': { name: '禁止万子', effect: '指定一名玩家，直到这一轮结束，禁止万子。' },
  'no-honors': { name: '禁止字牌', effect: '指定一名玩家，直到这一轮结束，禁止字牌。' },
  'no-draw': { name: '禁止摸牌', effect: '指定一名玩家，直到这一轮结束，禁止摸牌。' },
  'no-ready': { name: '禁止听牌', effect: '指定一名玩家，直到这一轮结束，禁止听牌。' },
  'no-meld-in': { name: '禁止入鸣', effect: '指定一名玩家，直到这一轮结束，禁止入鸣。' },
  'no-remeld': { name: '禁止换鸣', effect: '指定一名玩家，直到这一轮结束，禁止换鸣。' },
}

class RoomRequestError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.status = status
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

export default function RemoteTable({ roomCode, serverBase }: RemoteRoomParams) {
  const [state, setState] = useState<RoomState | null>(null)
  const [hand, setHand] = useState<string[]>([])
  const [handNote, setHandNote] = useState('')
  const [playerName, setPlayerName] = useState(() => readSeat(roomCode).name)
  const [playerKey, setPlayerKey] = useState(() => readSeat(roomCode).key)
  const [connection, setConnection] = useState<'connecting' | 'online' | 'reconnecting'>('connecting')
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const roomURL = `${serverBase}/room/${encodeURIComponent(roomCode)}`

  useEffect(() => {
    getGame('wanxiang-mahjong')
    recordPlay('wanxiang-mahjong')
  }, [])

  useEffect(() => {
    const seat = readSeat(roomCode)
    if (!seat.name) {
      window.location.replace(roomURL)
      return
    }
    localStorage.setItem(`@games/server/name/${roomCode}`, JSON.stringify(seat))
    setPlayerName(seat.name)
    setPlayerKey(seat.key)

    let disposed = false
    let source: EventSource | null = null
    let retryTimer = 0

    const applyState = (next: RoomState) => {
      if (disposed) return
      setState((current) => (!current || next.revision >= current.revision ? next : current))
    }

    const connect = async () => {
      if (disposed) return
      setConnection((current) => (current === 'online' ? 'reconnecting' : current))
      setError('')
      source?.close()
      try {
        const response = await roomRequest<GameResponse>(serverBase, roomCode, 'game', undefined, seat)
        if (disposed) return
        setPlayerName(response.name || seat.name)
        applyState(response.state)
        await loadHand(serverBase, roomCode, seat, disposed, setHand, setHandNote)

        const eventsURL = new URL(roomEndpoint(serverBase, roomCode, 'events'))
        eventsURL.searchParams.set('name', seat.name)
        eventsURL.searchParams.set('key', seat.key)
        source = new EventSource(eventsURL)
        source.onopen = () => {
          if (!disposed) setConnection('online')
        }
        source.onmessage = (event) => {
          if (disposed) return
          try {
            const payload = JSON.parse(event.data) as RoomEvent
            applyState(payload.state)
            void loadHand(serverBase, roomCode, seat, disposed, setHand, setHandNote)
          } catch {
            setError('收到无法识别的房间消息')
          }
        }
        source.onerror = () => {
          if (disposed) return
          setConnection('reconnecting')
          source?.close()
          window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(() => void connect(), 1000)
        }
      } catch (reason) {
        if (disposed) return
        const requestError = reason as RoomRequestError
        setError(requestError.message || '无法连接房间服务器')
        setConnection('reconnecting')
        window.clearTimeout(retryTimer)
        retryTimer = window.setTimeout(() => void connect(), 1000)
      }
    }

    void connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      source?.close()
    }
  }, [roomCode, roomURL, serverBase])

  useEffect(() => {
    if (!state) return
    if (state.phase === 'waiting' || state.phase === 'confirming' || state.phase === 'game-select') {
      window.location.replace(roomURL)
      return
    }
    if (state.selectedGame && state.selectedGame.id !== 'wanxiang-mahjong') {
      window.location.replace(roomURL)
    }
  }, [roomURL, state])

  const game = state?.wanxiang
  const seats = game?.seats || []
  const vote = game?.vote
  const busy = Boolean(pendingAction)

  const perform = async (body: Record<string, unknown>) => {
    if (pendingAction) return
    setPendingAction(String(body.type || 'action'))
    setError('')
    try {
      const response = await roomRequest<{ state: RoomState }>(
        serverBase,
        roomCode,
        'game/action',
        body,
        { name: playerName, key: playerKey },
      )
      setState((current) => (!current || response.state.revision >= current.revision ? response.state : current))
      await loadHand(serverBase, roomCode, { name: playerName, key: playerKey }, false, setHand, setHandNote)
      window.setTimeout(() => {
        void roomRequest<GameResponse>(serverBase, roomCode, 'game', undefined, { name: playerName, key: playerKey })
          .then((latest) => setState((current) => (!current || latest.state.revision >= current.revision ? latest.state : current)))
          .catch(() => undefined)
      }, 300)
    } catch (reason) {
      setError((reason as Error).message || '游戏操作失败')
    } finally {
      setPendingAction('')
    }
  }

  if (error && !state) {
    return (
      <main className="wx-app">
        <div className="wx-shell">
          <section className="wx-panel">
            <h1 className="wx-title">无法进入牌桌</h1>
            <p>{error}</p>
            <a className="wx-back" href={roomURL} style={{ position: 'static', width: 'auto', padding: '0 14px' }}>返回房间</a>
          </section>
        </div>
      </main>
    )
  }

  if (!state || !game || state.selectedGame?.id !== 'wanxiang-mahjong') {
    return (
      <main className="wx-app">
        <div className="wx-shell">
          <section className="wx-panel">
            <h1 className="wx-title">正在同步牌桌</h1>
            <p className="wx-muted">{error || '等待房间服务器发送游戏状态…'}</p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="wx-app">
      <a className="wx-back" href={roomURL} aria-label="返回房间">←</a>
      <div className="wx-shell">
        <header className="wx-row">
          <div>
            <h1 className="wx-title">万象麻将</h1>
            <p className="wx-muted">第 {(game.round ?? 0) + 1} 轮 · {connection === 'online' ? '同步中' : connection === 'connecting' ? '连接中' : '重连中'}</p>
          </div>
        </header>
        {error ? <p role="alert">{error}</p> : null}
        {handNote ? <p className="wx-muted">{handNote}</p> : null}
        {game.flash ? <p>{game.flash}</p> : null}
        <section className="wx-seats">
          {seats.map((seat) => (
            <article className="wx-panel wx-seat" key={seat.id || seat.name}>
              <strong>{seat.name}{seat.name === playerName ? ' · 我' : ''}</strong>
              <span>{seat.score ?? 0} 胜 · 剩余 {handCount(seat)} 张</span>
              {seat.name === playerName ? (
                <div className="wx-actions" style={{ marginTop: 6 }}>
                  <button type="button" disabled={busy} onClick={() => void perform({ type: 'win', nominee: playerName })}>我赢了</button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
        <section>
          <div className="wx-row">
            <h2>我的技能</h2>
            <button type="button" className="wx-ghost" disabled={busy} onClick={() => void perform({ type: 'end-round' })}>本轮结束</button>
          </div>
          <div className="wx-hand">
            {hand.map((skillId, index) => {
              const skill = labelSkill(skillId)
              return (
                <button className="wx-skill" type="button" key={`${skillId}-${index}`} disabled={busy} onClick={() => void perform({ type: 'play', handIndex: index })}>
                  <strong>{skill.name}</strong>
                  <span>{skill.effect}</span>
                </button>
              )
            })}
          </div>
        </section>
        <section>
          <h2>牌桌</h2>
          <div className="wx-grid">
            {(game.played || []).map((card, index) => {
              const skill = labelSkill(card.skillId)
              return (
                <article className="wx-panel" key={`${card.player}-${index}`}>
                  <strong>{skill.name}</strong>
                  <span>{card.player} 打出。{skill.effect}</span>
                </article>
              )
            })}
          </div>
        </section>
      </div>
      {vote ? (
        <div className="wx-dialog" role="dialog" aria-modal="true" style={{ zIndex: 80 }}>
          <div className="wx-panel">
            <strong>{voteTitle(vote)}</strong>
            <span>{vote.kind === 'win' ? '5 秒内不点算同意。' : '结束这一轮需要你点同意。'}</span>
            <div className="wx-actions">
              <button type="button" disabled={busy} onClick={() => void perform({ type: 'respond', agree: true })}>同意</button>
              <button type="button" className="wx-ghost" disabled={busy} onClick={() => void perform({ type: 'respond', agree: false })}>拒绝</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function voteTitle(vote: VoteState): string {
  if (vote.kind === 'end-round') return `${vote.proposer} 要结束这一轮`
  if (vote.kind === 'win') return `${vote.proposer} 说 ${vote.nominee || '这手'} 赢了`
  return `${vote.proposer} 发起了表决`
}

function handCount(seat: SeatState): number {
  if (typeof seat.handCount === 'number') return seat.handCount
  return seat.hand?.length || 0
}

function labelSkill(id: string): { name: string; effect: string } {
  return SKILLS[id] || { name: id || '技能', effect: '指定一名玩家，直到这一轮结束，禁止这一项。' }
}

async function loadHand(
  serverBase: string,
  roomCode: string,
  seat: PlayerSeat,
  disposed: boolean,
  setHand: (hand: string[]) => void,
  setHandNote: (note: string) => void,
) {
  try {
    const payload = await roomRequest<{ cards?: string[] }>(serverBase, roomCode, 'game/hand', undefined, seat)
    if (disposed) return
    setHand(Array.isArray(payload.cards) ? payload.cards : [])
    setHandNote('')
  } catch (reason) {
    if (disposed) return
    const status = (reason as RoomRequestError).status
    if (status === 404) {
      setHandNote('私人手牌还没同步，先看牌桌公开状态。')
      return
    }
  }
}

function roomEndpoint(serverBase: string, roomCode: string, suffix: string) {
  return `${serverBase}/api/rooms/${encodeURIComponent(roomCode)}/${suffix}`
}

function readSeat(roomCode: string): PlayerSeat {
  try {
    const params = new URLSearchParams(window.location.search)
    const queryName = params.get('name') || ''
    const queryKey = params.get('key') || ''
    if (queryName && queryKey) return { name: queryName, key: queryKey }
    const value = localStorage.getItem(`@games/server/name/${roomCode}`)
    if (!value) return { name: '', key: '' }
    if (value.startsWith('{')) {
      const parsed = JSON.parse(value) as { name?: string; key?: string }
      return { name: parsed.name || '', key: parsed.key || '' }
    }
    return { name: value, key: '' }
  } catch {
    return { name: '', key: '' }
  }
}

async function roomRequest<T = unknown>(
  serverBase: string,
  roomCode: string,
  suffix: string,
  body?: unknown,
  seat: PlayerSeat = { name: '', key: '' },
): Promise<T> {
  const endpoint = new URL(roomEndpoint(serverBase, roomCode, suffix))
  if (seat.name) endpoint.searchParams.set('name', seat.name)
  if (seat.key) endpoint.searchParams.set('key', seat.key)
  const response = await fetch(endpoint, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const payload = data as { error?: { message?: string } }
    throw new RoomRequestError(payload.error?.message || `请求失败（${response.status}）`, response.status)
  }
  return data as T
}
