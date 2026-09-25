import { REMATCH_MS, ROUNDS_PER_MATCH, VOTE_MS, skillById } from './game/cards'
import type { TableAction, TableState } from './game/table'

interface TableViewProps {
  state: TableState
  selfId: string
  now: number
  onAction: (action: TableAction) => void
}

export default function TableView({ state, selfId, now, onAction }: TableViewProps) {
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
      <header className="wx-row">
        <div>
          <h1 className="wx-title">万象麻将</h1>
          <p className="wx-muted">{state.phase === 'playing' || state.phase === 'voting' ? `第 ${state.round + 1} / ${ROUNDS_PER_MATCH} 轮` : '等朋友坐齐'}</p>
        </div>
      </header>
      <section className="wx-seats">
        {ranked.map((seat) => (
          <article className="wx-panel wx-seat" key={seat.id}>
            <strong>{seat.name}{seat.id === selfId ? ' · 我' : ''}</strong>
            <span>{seat.score} 胜 · 剩余 {seat.hand.filter(Boolean).length || seat.hand.length} 张{seat.ready ? ' · 再来' : ''}</span>
            {state.phase === 'playing' && self?.inMatch && seat.id === selfId ? (
              <div className="wx-actions" style={{ marginTop: 6 }}>
                <button type="button" onClick={() => onAction({ type: 'propose-win', playerId: selfId, nomineeId: selfId, now })}>我赢了</button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
      {self?.inMatch && state.phase === 'playing' ? (
        <section>
          <div className="wx-row">
            <h2>我的技能</h2>
            <button type="button" className="wx-ghost" onClick={() => onAction({ type: 'propose-end', playerId: selfId, now })}>本轮结束</button>
          </div>
          <div className="wx-hand">
            {self.hand.map((skillId, index) => {
              const skill = skillById(skillId)
              return (
                <button className="wx-skill" type="button" key={`${skillId}-${index}`} onClick={() => onAction({ type: 'play-card', playerId: selfId, handIndex: index })}>
                  <strong>{skill.name}</strong>
                  <span>{skill.effect}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}
      <section>
        <h2>牌桌</h2>
        <div className="wx-grid">
          {state.played.map((card) => {
            const skill = skillById(card.skillId)
            return (
              <article className="wx-panel" key={card.id}>
                <strong>{skill.name}</strong>
                <span>{card.playerName} 打出。{skill.effect}</span>
              </article>
            )
          })}
        </div>
      </section>
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
      {state.vote ? (
        <div className="wx-dialog" role="dialog" aria-modal="true">
          <div className="wx-panel">
            <strong>{voteTitle(state)}</strong>
            <span>还剩 {Math.ceil(voteLeft / 1000)} 秒，不点算同意。</span>
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
  return `${proposer} 说 ${nominee} 赢了`
}
