import { HAND_SIZE, MAX_PLAYERS, MIN_PLAYERS, REMATCH_MS, ROUNDS_PER_MATCH, VOTE_MS, buildPool } from './cards'

export type Phase = 'lobby' | 'voting' | 'playing' | 'settlement' | 'dissolved'

export type VoteKind = 'start' | 'win' | 'end-round'

export interface Vote {
  id: number
  kind: VoteKind
  proposerId: string
  nomineeId: string
  openedAt: number
  responded: string[]
}

export interface PlayedCard {
  id: number
  skillId: string
  playerId: string
  playerName: string
}

export interface Seat {
  id: string
  name: string
  score: number
  hand: string[]
  ready: boolean
  inMatch: boolean
}

export interface TableState {
  phase: Phase
  seats: Seat[]
  pool: string[]
  played: PlayedCard[]
  round: number
  vote: Vote | null
  rematchAt: number
  nextId: number
  flash: string
}

export type TableAction =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'propose-start'; playerId: string; now: number }
  | { type: 'propose-win'; playerId: string; nomineeId: string; now: number }
  | { type: 'propose-end'; playerId: string; now: number }
  | { type: 'respond'; playerId: string; agree: boolean }
  | { type: 'expire-vote'; now: number }
  | { type: 'play-card'; playerId: string; handIndex: number }
  | { type: 'ready-rematch'; playerId: string; now: number }
  | { type: 'leave-settlement'; playerId: string; now: number }
  | { type: 'expire-rematch'; now: number }
  | { type: 'dismiss-flash' }

export function createTable(random: () => number = Math.random): TableState {
  return {
    phase: 'lobby',
    seats: [],
    pool: shuffle(buildPool(), random),
    played: [],
    round: 0,
    vote: null,
    rematchAt: 0,
    nextId: 1,
    flash: '',
  }
}

export function reduce(state: TableState, action: TableAction, random: () => number = Math.random): TableState {
  switch (action.type) {
    case 'join':
      return join(state, action)
    case 'propose-start':
      return proposeStart(state, action.playerId, action.now)
    case 'propose-win':
      return proposeWin(state, action.playerId, action.nomineeId, action.now)
    case 'propose-end':
      return proposeEnd(state, action.playerId, action.now)
    case 'respond':
      return respond(state, action.playerId, action.agree, random)
    case 'expire-vote':
      return expireVote(state, action.now, random)
    case 'play-card':
      return playCard(state, action.playerId, action.handIndex)
    case 'ready-rematch':
      return readyRematch(state, action.playerId, action.now, random)
    case 'leave-settlement':
      return leaveSettlement(state, action.playerId, action.now)
    case 'expire-rematch':
      return expireRematch(state, action.now, random)
    case 'dismiss-flash':
      return { ...state, flash: '' }
    default:
      return state
  }
}

export function publicState(state: TableState, viewerId: string): TableState {
  return {
    ...state,
    seats: state.seats.map((seat) => ({
      ...seat,
      hand: seat.id === viewerId ? seat.hand : seat.hand.map(() => ''),
    })),
  }
}

function join(state: TableState, action: Extract<TableAction, { type: 'join' }>): TableState {
  const name = action.name.trim()
  if (!action.playerId || !name || state.seats.some((seat) => seat.id === action.playerId)) return state
  if (state.seats.length >= MAX_PLAYERS || state.phase === 'dissolved') return state
  return {
    ...state,
    seats: [...state.seats, { id: action.playerId, name, score: 0, hand: [], ready: false, inMatch: false }],
  }
}

function proposeStart(state: TableState, playerId: string, now: number): TableState {
  if (state.phase !== 'lobby' || state.seats.length < MIN_PLAYERS) return state
  if (!state.seats.some((seat) => seat.id === playerId)) return state
  return openVote(state, 'start', playerId, '', now)
}

function proposeWin(state: TableState, playerId: string, nomineeId: string, now: number): TableState {
  if (!canAct(state, playerId) || !inMatch(state).some((seat) => seat.id === nomineeId)) return state
  return openVote(state, 'win', playerId, nomineeId, now)
}

function proposeEnd(state: TableState, playerId: string, now: number): TableState {
  if (!canAct(state, playerId)) return state
  return openVote(state, 'end-round', playerId, '', now)
}

function respond(state: TableState, playerId: string, agree: boolean, random: () => number): TableState {
  const vote = state.vote
  if (!vote || state.phase !== 'voting') return state
  const pending = voters(state, vote)
  if (!pending.some((seat) => seat.id === playerId) || vote.responded.includes(playerId)) return state
  if (!agree) return { ...state, phase: vote.kind === 'start' ? 'lobby' : 'playing', vote: null }
  const next = { ...vote, responded: [...vote.responded, playerId] }
  if (!pending.every((seat) => next.responded.includes(seat.id))) return { ...state, vote: next }
  return passVote({ ...state, vote: next }, random)
}

function expireVote(state: TableState, now: number, random: () => number): TableState {
  if (state.phase !== 'voting' || !state.vote || now < state.vote.openedAt + VOTE_MS) return state
  return passVote(state, random)
}

function playCard(state: TableState, playerId: string, handIndex: number): TableState {
  if (state.phase !== 'playing') return state
  const seat = inMatch(state).find((item) => item.id === playerId)
  if (!seat || handIndex < 0 || handIndex >= seat.hand.length) return state
  return {
    ...state,
    nextId: state.nextId + 1,
    played: [...state.played, { id: state.nextId, skillId: seat.hand[handIndex], playerId, playerName: seat.name }],
    seats: state.seats.map((item) =>
      item.id === playerId ? { ...item, hand: item.hand.filter((_, index) => index !== handIndex) } : item,
    ),
  }
}

function readyRematch(state: TableState, playerId: string, now: number, random: () => number): TableState {
  if (state.phase !== 'settlement' || !state.seats.some((seat) => seat.id === playerId)) return state
  const seats = state.seats.map((seat) => (seat.id === playerId ? { ...seat, ready: true } : seat))
  return settleReady({ ...state, seats }, now, random)
}

function leaveSettlement(state: TableState, playerId: string, now: number): TableState {
  if (state.phase !== 'settlement') return state
  return checkRematch({ ...state, seats: state.seats.filter((seat) => seat.id !== playerId) }, now)
}

function expireRematch(state: TableState, now: number, random: () => number): TableState {
  if (state.phase !== 'settlement' || !state.rematchAt || now < state.rematchAt + REMATCH_MS) return state
  const ready = state.seats.filter((seat) => seat.ready)
  if (ready.length < MIN_PLAYERS) return dissolve(state)
  return beginMatch(state, ready.map((seat) => seat.id), random)
}

function openVote(state: TableState, kind: VoteKind, proposerId: string, nomineeId: string, now: number): TableState {
  const vote = { id: state.nextId, kind, proposerId, nomineeId, openedAt: now, responded: [proposerId] }
  const next = { ...state, phase: 'voting' as const, nextId: state.nextId + 1, vote }
  if (voters(next, vote).length === 0) return passVote(next, Math.random)
  return next
}

function passVote(state: TableState, random: () => number): TableState {
  const vote = state.vote
  if (!vote) return state
  if (vote.kind === 'start') return beginMatch({ ...state, vote: null }, state.seats.map((seat) => seat.id), random)
  return finishRound(state, vote.kind === 'win' ? vote.nomineeId : '', random)
}

function finishRound(state: TableState, winnerId: string, random: () => number): TableState {
  const round = state.round + 1
  const seats = state.seats.map((seat) => (seat.id === winnerId ? { ...seat, score: seat.score + 1 } : seat))
  if (round >= ROUNDS_PER_MATCH) {
    return {
      ...state,
      phase: 'settlement',
      vote: null,
      rematchAt: 0,
      round,
      played: [],
      seats: seats.map((seat) => ({ ...seat, hand: [], ready: false, inMatch: false })),
    }
  }
  return refill({ ...state, phase: 'playing', vote: null, round, seats }, random)
}

function beginMatch(state: TableState, playerIds: string[], random: () => number): TableState {
  if (playerIds.length < MIN_PLAYERS) return dissolve(state)
  const pool = shuffle(buildPool(), random)
  const hands: Record<string, string[]> = {}
  for (const playerId of playerIds) hands[playerId] = pool.splice(0, HAND_SIZE)
  return {
    ...state,
    phase: 'playing',
    vote: null,
    rematchAt: 0,
    round: 0,
    played: [],
    flash: '',
    pool,
    seats: state.seats
      .filter((seat) => playerIds.includes(seat.id))
      .map((seat) => ({ ...seat, score: 0, hand: hands[seat.id] || [], ready: false, inMatch: true })),
  }
}

function refill(state: TableState, _random: () => number): TableState {
  const pool = state.pool.slice()
  const seats = state.seats.map((seat) => {
    if (!seat.inMatch) return seat
    const hand = seat.hand.slice()
    while (hand.length < HAND_SIZE && pool.length > 0) hand.push(pool.shift() as string)
    return { ...seat, hand }
  })
  return { ...state, seats, pool }
}

function settleReady(state: TableState, now: number, random: () => number): TableState {
  const ready = state.seats.filter((seat) => seat.ready)
  const waiting = state.seats.some((seat) => !seat.ready)
  if (!waiting && ready.length >= MIN_PLAYERS) return beginMatch(state, ready.map((seat) => seat.id), random)
  const rematchAt = state.rematchAt || (ready.length >= MIN_PLAYERS && waiting && state.seats.length > MIN_PLAYERS ? now : 0)
  return checkRematch({ ...state, rematchAt }, now)
}

function checkRematch(state: TableState, _now: number): TableState {
  const ready = state.seats.filter((seat) => seat.ready)
  if (state.rematchAt && ready.length < MIN_PLAYERS) return dissolve(state)
  if (ready.length === 0) return { ...state, rematchAt: 0 }
  return state
}

function dissolve(state: TableState): TableState {
  const scores = state.seats.map((seat) => `${seat.name} ${seat.score}`).join(' · ')
  return {
    ...state,
    phase: 'dissolved',
    vote: null,
    rematchAt: 0,
    flash: scores ? `本局到此：${scores}` : '人数不足，房间散了',
  }
}

function canAct(state: TableState, playerId: string): boolean {
  return state.phase === 'playing' && !state.vote && inMatch(state).some((seat) => seat.id === playerId)
}

function inMatch(state: TableState): Seat[] {
  return state.seats.filter((seat) => seat.inMatch)
}

function voters(state: TableState, vote: Vote): Seat[] {
  const people = vote.kind === 'start' ? state.seats : inMatch(state)
  return people.filter((seat) => seat.id !== vote.proposerId)
}

function shuffle(cards: string[], random: () => number): string[] {
  const next = cards.slice()
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}
