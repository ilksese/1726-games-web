import { useEffect, useState } from 'react'
import { getGame, recordPlay } from '@games/shared'
import DiscardTile from './DiscardTile'
import SkillCard from './SkillCard'
import WoodGrain from './WoodGrain'
import { skillById } from './game/cards'

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
  const [pendingPlay, setPendingPlay] = useState<number | null>(null)
  const [nominee, setNominee] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const roomURL = `${serverBase}/room/${encodeURIComponent(roomCode)}`
  const game = state?.wanxiang
  const voteOpen = Boolean(game?.vote)

  useEffect(() => {
    if (!voteOpen) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [voteOpen])

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
        <div className="wx-board">
          <section className="wx-panel">
            <h1 className="wx-title">进不了牌桌</h1>
            <p>{friendlyError(error)}</p>
            <a href={roomURL}>返回房间</a>
          </section>
        </div>
      </main>
    )
  }

  if (!state || !game || state.selectedGame?.id !== 'wanxiang-mahjong') {
    return (
      <main className="wx-app">
        <div className="wx-board">
          <section className="wx-panel">
            <h1 className="wx-title">正在连上牌桌</h1>
            <p className="wx-muted">{error ? friendlyError(error) : '房间还没把这一桌发过来。'}</p>
            <a href={roomURL}>返回房间</a>
          </section>
        </div>
      </main>
    )
  }

  const others = seats.filter((seat) => seat.name !== playerName)
  const selfSeat = seats.find((seat) => seat.name === playerName)
  const pickedSkill = pendingPlay !== null && hand[pendingPlay] ? labelSkill(hand[pendingPlay]) : null
  const canVote = Boolean(vote && vote.pending.includes(playerName) && vote.proposer !== playerName)
  const secondsLeft = vote?.kind === 'win' ? Math.max(0, Math.ceil((vote.expiresAt - now) / 1000)) : 0
  const linkLabel = connection === 'online' ? '已连接' : connection === 'connecting' ? '连接中' : '重连中'

  return (
    <main className="wx-app">
      <WoodGrain />
      <a className="wx-back" href={roomURL} aria-label="返回房间">←</a>
      <div className="wx-board">
        <header className="wx-top">
          <div>
            <h1 className="wx-title">第 {(game.round ?? 0) + 1} / 5 轮</h1>
            <p className="wx-muted">{linkLabel}{selfSeat ? ` · ${selfSeat.score ?? 0} 胜` : ''}</p>
          </div>
          <button type="button" className="wx-end" disabled={busy || pendingPlay !== null || nominee !== null} onClick={() => setConfirmEnd(true)}>结束本轮</button>
          <div className="wx-rivals">
            {others.map((seat) => {
              const picked = nominee === seat.name
              return (
                <button className={`wx-avatar${picked ? ' is-picked' : ''}`} type="button" key={seat.id || seat.name} disabled={busy || pendingPlay !== null} aria-pressed={picked} onClick={() => setNominee(picked ? null : seat.name)}>
                  <span aria-hidden="true">{seat.name.slice(0, 1)}</span>
                  <strong>{seat.name}</strong>
                  <em>{seat.score ?? 0}</em>
                </button>
              )
            })}
          </div>
        </header>
        {error ? <p className="wx-banner" role="alert">{error}</p> : null}
        {handNote ? <p className="wx-muted">{handNote}</p> : null}
        <section className="wx-felt" aria-label="牌河">
          <div className="wx-river">
            {(game.played || []).length === 0 ? <p className="wx-empty">还没人出技能</p> : [...(game.played || [])].reverse().map((card, index) => {
              const skill = labelSkill(card.skillId)
              return <DiscardTile key={`${card.player}-${card.skillId}-${index}`} name={skill.name} displayName={skill.displayName} player={card.player} />
            })}
          </div>
        </section>
        <section className="wx-dock">
          {pickedSkill ? <p className="wx-effect">{pickedSkill.effect}</p> : null}
          <div className="wx-hand">
            {hand.map((skillId, index) => {
              const skill = labelSkill(skillId)
              const picked = pendingPlay === index
              return (
                <button className={`wx-skill${picked ? ' is-picked' : ''}`} type="button" key={`${skillId}-${index}`} disabled={busy} aria-pressed={picked} aria-label={`${skill.name}。${skill.effect}`} onClick={() => { setNominee(null); setPendingPlay(picked ? null : index) }}>
                  <SkillCard name={skill.name} displayName={skill.displayName} />
                </button>
              )
            })}
          </div>
          <div className="wx-actions">
            {pickedSkill ? (
              <>
                <button type="button" disabled={busy} onClick={() => { const index = pendingPlay; setPendingPlay(null); void perform({ type: 'play', handIndex: index }) }}>打出</button>
                <button type="button" className="wx-ghost" disabled={busy} onClick={() => setPendingPlay(null)}>取消</button>
              </>
            ) : nominee ? (
              <>
                <button type="button" disabled={busy} onClick={() => { const name = nominee; setNominee(null); void perform({ type: 'win', nominee: name }) }}>记 {nominee} 一胜</button>
                <button type="button" className="wx-ghost" disabled={busy} onClick={() => setNominee(null)}>取消</button>
              </>
            ) : null}
          </div>
        </section>
      </div>
      {confirmEnd ? (
        <div className="wx-dialog" role="dialog" aria-modal="true" aria-labelledby="wx-end-title">
          <div className="wx-panel">
            <strong id="wx-end-title">结束这一轮？</strong>
            <span>其他人必须点同意才会结束。没有自动通过。一人拒绝就留在这一轮。</span>
            <div className="wx-actions">
              <button type="button" disabled={busy} onClick={() => { setConfirmEnd(false); void perform({ type: 'end-round' }) }}>发起结束</button>
              <button type="button" className="wx-ghost" disabled={busy} onClick={() => setConfirmEnd(false)}>留下</button>
            </div>
          </div>
        </div>
      ) : null}
      {vote && canVote ? (
        <div className="wx-dialog" role="dialog" aria-modal="true">
          <div className="wx-panel">
            <strong>{voteTitle(vote)}</strong>
            <span>{voteCopy(vote, secondsLeft)}</span>
            {vote.pending.length ? <p className="wx-muted">还没点：{vote.pending.join('、')}</p> : null}
            <div className="wx-actions">
              <button type="button" disabled={busy} onClick={() => void perform({ type: 'respond', agree: true })}>同意</button>
              <button type="button" className="wx-ghost" disabled={busy} onClick={() => void perform({ type: 'respond', agree: false })}>拒绝</button>
            </div>
          </div>
        </div>
      ) : null}
      {vote && !canVote ? <p className="wx-banner">{vote.pending.length ? `等 ${vote.pending.join('、')} 点同意。这一笔没完，不能再发起。` : `${voteTitle(vote)}。这一笔还没完。`}</p> : null}
    </main>
  )
}

function voteTitle(vote: VoteState): string {
  if (vote.kind === 'end-round') return `${vote.proposer} 要结束这一轮`
  if (vote.kind === 'win') return `${vote.proposer} 记 ${vote.nominee || '这手'} 一胜`
  return `${vote.proposer} 发起了表决`
}

function voteCopy(vote: VoteState, secondsLeft: number): string {
  if (vote.kind === 'end-round') return '必须点同意才会结束。没有自动通过。一人拒绝就取消。'
  return `${secondsLeft} 秒内不点，视为同意。${vote.nominee || '被提名的人'} +1，无人扣分。一人拒绝就取消。`
}

function friendlyError(message: string): string {
  if (/failed to fetch|network|load failed/i.test(message)) return '连不上房间。检查同一网络后再试，或返回房间重新进入。'
  return message
}

function handCount(seat: SeatState): number {
  if (typeof seat.handCount === 'number') return seat.handCount
  return seat.hand?.length || 0
}

function labelSkill(id: string) {
  return skillById(id)
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
