import { useEffect, useState } from 'react'
import { getGame, recordPlay } from '@games/shared'
import RemoteTable, { getRemoteRoomParams } from './RemoteTable'
import WoodGrain from './WoodGrain'
import TableView from './TableView'
import { createTable, reduce, type TableAction, type TableState } from './game/table'
import { keepAwake } from './keepAwake'
import './style.css'

const STORE_KEY = '@games/wanxiang-mahjong/table'

function loadTable(): TableState {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return createTable()
    return JSON.parse(raw) as TableState
  } catch {
    return createTable()
  }
}

export default function WanxiangMahjong() {
  useEffect(() => keepAwake(), [])
  const remoteRoom = getRemoteRoomParams()
  if (remoteRoom) return <RemoteTable {...remoteRoom} />
  return <LocalTable />
}

function LocalTable() {
  const [state, setState] = useState<TableState>(() => loadTable())
  const [selfId] = useState(() => localStorage.getItem(`${STORE_KEY}/self`) || `p-${crypto.randomUUID()}`)
  const [name, setName] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    getGame('wanxiang-mahjong')
    recordPlay('wanxiang-mahjong')
    localStorage.setItem(`${STORE_KEY}/self`, selfId)
  }, [selfId])

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)
      setState((current) => reduce(reduce(current, { type: 'expire-vote', now: nextNow }), { type: 'expire-rematch', now: nextNow }))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const dispatch = (action: TableAction) => setState((current) => reduce(current, action))
  const seated = state.seats.some((seat) => seat.id === selfId)

  return (
    <main className="wx-app">
      <WoodGrain />
      <a className="wx-back" href="/" aria-label="返回大厅">←</a>
      <div className="wx-board">
        {seated ? <TableView state={state} selfId={selfId} now={now} onAction={dispatch} /> : (
          <div className="wx-join-wrap">
          <form className="wx-panel wx-join" onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'join', playerId: selfId, name }) }}>
            <h1 className="wx-title">加入万象麻将</h1>
            <p className="wx-muted">这一桌存在这台浏览器里。朋友把手机递过来，各自用自己的名字加入。</p>
            <input className="wx-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="你的名字" aria-label="你的名字" />
            <button type="submit" disabled={!name.trim() || state.seats.length >= 4}>坐下</button>
          </form>
          </div>
        )}
      </div>
    </main>
  )
}
