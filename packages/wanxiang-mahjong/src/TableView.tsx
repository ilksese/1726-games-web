import { useState } from 'react'
import { REMATCH_MS, ROUNDS_PER_MATCH, VOTE_MS, skillById } from './game/cards'
import DiscardTile from './DiscardTile'
import SkillCard from './SkillCard'
import type { TableAction, TableState } from './game/table'

interface TableViewProps {
  state: TableState
  selfId: string
  now: number
  onAction: (action: TableAction) => void
}

export default function TableView({ state, selfId, now, onAction }: TableViewProps) {
  const [pendingPlay, setPendingPlay] = useState<number | null>(null)
  const [nomineeId, setNomineeId] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const self = state.seats.find((seat) => seat.id === selfId)
  const ranked = [...state.seats].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh'))
  const voteLeft = state.vote ? Math.max(0, VOTE_MS - (now - state.vote.openedAt)) : 0
  const rematchLeft = state.rematchAt ? Math.max(0, REMATCH_MS - (now - state.rematchAt)) : 0

  if (state.phase === 'dissolved') {
    return (
      <section className="wx-panel">
        <h1 className="wx-title">散了</h1>
        <p>{state.flash || '人数不足，房间散了'}</p>
        <a className="wx-back" href="/" style={{ position: 'static', width: 'auto', padding: '0 14px' }}>回大厅</a>
      </section>
    )
  }

  return (
    <>
      <header className="wx-top">
        <div>
          <h1 className="wx-title">{state.phase === 'playing' || state.phase === 'voting' ? `第 ${state.round + 1} / ${ROUNDS_PER_MATCH} 轮` : '等朋友坐齐'}</h1>
          <p className="wx-muted">{self ? `${self.score} 胜` : ''}</p>
        </div>
        {state.phase === 'playing' && self?.inMatch ? (
          <button type="button" className="wx-end" disabled={pendingPlay !== null || nomineeId !== null} onClick={() => setConfirmEnd(true)}>结束本轮</button>
        ) : null}
        <div className="wx-rivals">
          {ranked.filter((seat) => seat.id !== selfId).map((seat) => {
            const picked = nomineeId === seat.id
            return (
              <button className={`wx-avatar${picked ? ' is-picked' : ''}`} type="button" key={seat.id} disabled={state.phase !== 'playing' || pendingPlay !== null} aria-pressed={picked} onClick={() => setNomineeId(picked ? null : seat.id)}>
                <span aria-hidden="true">{seat.name.slice(0, 1)}</span>
                <strong>{seat.name}</strong>
                <em>{seat.score}</em>
              </button>
            )
          })}
        </div>
      </header>
      <section className="wx-felt" aria-label="牌河">
        <div className="wx-river">
          {state.played.length === 0 ? <p className="wx-empty">还没人出技能</p> : [...state.played].reverse().map((card) => {
            const skill = skillById(card.skillId)
            return <DiscardTile key={card.id} name={skill.name} displayName={skill.displayName} player={card.playerName} />
          })}
        </div>
      </section>
      {self?.inMatch && state.phase === 'playing' ? (
        <section className="wx-dock">
          {pendingPlay !== null && self.hand[pendingPlay] ? <p className="wx-effect">{skillById(self.hand[pendingPlay]).effect}</p> : null}
          <div className="wx-hand">
            {self.hand.map((skillId, index) => {
              const skill = skillById(skillId)
              const picked = pendingPlay === index
              return (
                <button className={`wx-skill${picked ? ' is-picked' : ''}`} type="button" key={`${skillId}-${index}`} aria-pressed={picked} aria-label={`${skill.name}。${skill.effect}`} onClick={() => { setNomineeId(null); setPendingPlay(picked ? null : index) }}>
                  <SkillCard name={skill.name} displayName={skill.displayName} />
                </button>
              )
            })}
          </div>
          <div className="wx-actions">
            {pendingPlay !== null && self.hand[pendingPlay] ? (
              <>
                <button type="button" onClick={() => { const index = pendingPlay; setPendingPlay(null); onAction({ type: 'play-card', playerId: selfId, handIndex: index }) }}>打出</button>
                <button type="button" className="wx-ghost" onClick={() => setPendingPlay(null)}>取消</button>
              </>
            ) : nomineeId ? (
              <>
                <button type="button" onClick={() => { const id = nomineeId; setNomineeId(null); onAction({ type: 'propose-win', playerId: selfId, nomineeId: id, now }) }}>记 {ranked.find((seat) => seat.id === nomineeId)?.name} 一胜</button>
                <button type="button" className="wx-ghost" onClick={() => setNomineeId(null)}>取消</button>
              </>
            ) : (
              null
            )}
          </div>
        </section>
      ) : null}
      {state.phase === 'lobby' ? (
        <button type="button" disabled={!self || state.seats.length < 2} onClick={() => onAction({ type: 'propose-start', playerId: selfId, now })}>开始</button>
      ) : null}
      {state.phase === 'settlement' ? (
        <section className="wx-panel">
          <h2>本局结束</h2>
          {rematchLeft > 0 ? <p className="wx-muted">{Math.ceil(rematchLeft / 1000)} 秒后开下一局</p> : null}
          <div className="wx-actions">
            <button type="button" onClick={() => onAction({ type: 'ready-rematch', playerId: selfId, now })}>再来一局</button>
            <button type="button" className="wx-ghost" onClick={() => onAction({ type: 'leave-settlement', playerId: selfId, now })}>离开</button>
          </div>
        </section>
      ) : null}
      {confirmEnd ? (
        <div className="wx-dialog" role="dialog" aria-modal="true">
          <div className="wx-panel">
            <strong>结束这一轮？</strong>
            <span>其他人必须点同意才会结束。没有自动通过。一人拒绝就留在这一轮。</span>
            <div className="wx-actions">
              <button type="button" onClick={() => { setConfirmEnd(false); onAction({ type: 'propose-end', playerId: selfId, now }) }}>发起结束</button>
              <button type="button" className="wx-ghost" onClick={() => setConfirmEnd(false)}>留下</button>
            </div>
          </div>
        </div>
      ) : null}
      {state.vote ? (
        <div className="wx-dialog" role="dialog" aria-modal="true">
          <div className="wx-panel">
            <strong>{voteTitle(state)}</strong>
            <span>{state.vote.kind === 'end-round' ? '必须点同意才会结束。没有自动通过。' : `还剩 ${Math.ceil(voteLeft / 1000)} 秒。不点视为同意，被提名的人 +1，无人扣分。`}</span>
            {state.vote.responded.includes(selfId) ? <p>已表态</p> : (
              <div className="wx-actions">
                <button type="button" onClick={() => onAction({ type: 'respond', playerId: selfId, agree: true })}>同意</button>
                <button type="button" className="wx-ghost" onClick={() => onAction({ type: 'respond', playerId: selfId, agree: false })}>拒绝</button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

function voteTitle(state: TableState): string {
  const vote = state.vote
  if (!vote) return ''
  const proposer = state.seats.find((seat) => seat.id === vote.proposerId)?.name || '有人'
  if (vote.kind === 'start') return `${proposer} 要开始这一局`
  if (vote.kind === 'end-round') return `${proposer} 要结束这一轮`
  const nominee = state.seats.find((seat) => seat.id === vote.nomineeId)?.name || '这手'
  return `${proposer} 记 ${nominee} 一胜`
}
