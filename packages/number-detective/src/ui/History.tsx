import { useAtom, useAtomValue } from 'jotai'
import type { GameEngine, GuessEntry } from '../game/engine'
import { versionAtom, historyTabAtom } from '../store'

function getBadge(entry: GuessEntry): { label: string; tone: string } {
  const text = entry.resultText || ''

  if (text.includes('等待反馈')) {
    return { label: '等待中', tone: 'muted' }
  }

  if (text === '对 ✓') {
    return { label: '命中 4', tone: 'good' }
  }

  if (text === '错 ✗') {
    return { label: '未命中', tone: 'danger' }
  }

  const match = text.match(/(\d)位正确/)
  if (match) {
    const hits = Number(match[1])
    return { label: `命中 ${hits}`, tone: hits >= 4 ? 'good' : 'accent' }
  }

  return { label: text || '未命中', tone: 'muted' }
}

export default function History({ engine }: { engine: GameEngine | null }) {
  useAtomValue(versionAtom)
  const [tab, setTab] = useAtom(historyTabAtom)

  const myEntries = engine?.myGuesses ?? []
  const oppEntries = engine?.oppGuesses ?? []
  const entries = tab === 'mine' ? myEntries : oppEntries
  const round = Math.max(myEntries.length, oppEntries.length) || 1

  return (
    <section className="nd-card nd-panel nd-animate">
      <div className="nd-panel__head">
        <div className="nd-panel__title">猜测记录</div>
        <div className="nd-round-chip">第 {round} 轮</div>
      </div>
      <div className="nd-history-tabs">
        <button
          type="button"
          className="nd-history-tab"
          aria-pressed={tab === 'mine'}
          onClick={() => setTab('mine')}
        >
          我方
        </button>
        <button
          type="button"
          className="nd-history-tab"
          aria-pressed={tab === 'opp'}
          onClick={() => setTab('opp')}
        >
          对手
        </button>
      </div>
      <div className="nd-history-list">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">暂无记录</p>
        ) : (
          entries.map((entry, index) => {
            const badge = getBadge(entry)
            const digits = String(entry.guess || '').slice(0, 4).split('')
            return (
              <div
                key={index}
                className={`nd-history-row${entry.red ? ' nd-history-row--highlight' : ''}`}
              >
                <span className="nd-history-index">{index + 1}</span>
                <div className="nd-digits">
                  {digits.map((digit, di) => (
                    <span key={di} className="nd-digit-chip">
                      {digit}
                    </span>
                  ))}
                </div>
                <span className={`nd-result-badge nd-result-badge--${badge.tone}`}>{badge.label}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
