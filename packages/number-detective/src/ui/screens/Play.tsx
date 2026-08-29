import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type { GameEngine } from '../../game/engine'
import { guessAtom, historyTabAtom, versionAtom } from '../../store'
import { icons } from '../icons'
import GuessInput from '../GuessInput'
import Keypad from '../Keypad'
import History from '../History'

interface PlayProps {
  engineRef: RefObject<GameEngine | null>
  submitGuess: (guess: string) => void
}

function PlayerCard({
  title,
  tag,
  score,
  active,
  muted,
}: {
  title: string
  tag: string
  score: string
  active: boolean
  muted: boolean
}) {
  return (
    <section className={`nd-player-card${active ? ' nd-player-card--active' : ''}`}>
      <div className="nd-player-top">
        <div className={`nd-avatar${muted ? ' nd-avatar--muted' : ''}`}>{icons.user}</div>
        <div className="nd-player-copy">
          <div className="nd-player-name">{title}</div>
          <span className={`nd-badge${active ? '' : ' nd-badge--muted'}`}>{tag}</span>
        </div>
      </div>
      <div className="nd-score">{score}</div>
    </section>
  )
}

export default function Play({ engineRef, submitGuess }: PlayProps) {
  useAtomValue(versionAtom)
  const [guess, setGuess] = useAtom(guessAtom)
  const setHistoryTab = useSetAtom(historyTabAtom)
  const historyWrapRef = useRef<HTMLDivElement>(null)

  const engine = engineRef.current
  const canInput = engine ? engine.isMyTurn && !engine.isOver : false
  const hidden = engine ? !engine.isMyTurn || engine.isOver : true

  const myScore = String(engine?.myGuesses.length ?? 0).padStart(4, '0')
  const oppScore = String(engine?.oppGuesses.length ?? 0).padStart(4, '0')
  const turnText = !engine ? '轮到对手' : engine.isOver ? '对局结束' : engine.isMyTurn ? '轮到你' : '轮到对手'
  const reviewAccent = engine ? engine.myMatchPoint || engine.oppMatchPoint : false

  const handleDigit = (d: string) => {
    if (canInput && guess.length < 4) setGuess(guess + d)
  }
  const handleClear = () => {
    if (canInput) setGuess(guess.slice(0, -1))
  }
  const handleConfirm = () => {
    if (canInput && guess.length === 4) {
      submitGuess(guess)
      setGuess('')
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      else if (e.key === 'Backspace') handleClear()
      else if (e.key === 'Enter') handleConfirm()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  return (
    <div className="nd-shell nd-shell--stack">
      <div className="nd-topbar">
        <span className="nd-topbar__spacer" aria-hidden="true"></span>
        <h1 className="nd-topbar__title">较量中</h1>
        <div className="nd-topbar__actions" aria-hidden="true">
          <div className="nd-icon-button">{icons.more}</div>
          <div className="nd-icon-button">{icons.ring}</div>
        </div>
      </div>
      <section className="nd-player-row">
        <PlayerCard title="你" tag="本机" score={myScore} active={true} muted={false} />
        <div className={`nd-turn-pill${engine && engine.isMyTurn ? '' : ' nd-turn-pill--waiting'}`}>
          {turnText}
        </div>
        <PlayerCard title="对手" tag="远端" score={oppScore} active={false} muted={true} />
      </section>
      <button
        type="button"
        className={`nd-review-card nd-animate${reviewAccent ? ' nd-card--accent' : ''}`}
        onClick={() => {
          setHistoryTab('mine')
          historyWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      >
        <span className="nd-review-icon">{icons.clipboard}</span>
        <span>
          <span className="nd-review-title">复盘模式</span>
          <span className="nd-review-subtitle">查看本局游戏的猜测记录</span>
        </span>
      </button>
      <div ref={historyWrapRef}>
        <History engine={engine} />
      </div>
      <section className={`nd-stack${hidden ? ' nd-hidden' : ''}`}>
        <section className="nd-card nd-panel">
          <div className="nd-screen-subtitle">输入猜测</div>
          <GuessInput digits={guess} />
        </section>
        <section className="nd-card nd-panel">
          <Keypad onDigit={handleDigit} onClear={handleClear} onConfirm={handleConfirm} />
        </section>
      </section>
    </div>
  )
}
