import { useEffect, useMemo, useState } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { getGame, recordPlay } from '@games/shared'
import './style.css'

const COPY_POOL = [
  '这杯酒，敬你的好运！',
  '酒是粮食精，越喝越年轻～',
  '是时候展示真正的酒量了！',
  '推杯换盏，友谊长存！',
  '一杯下肚，烦恼全无！',
  '这一杯，躲是躲不掉的～',
  '酒杯一响，黄金万两！',
  '干了这杯，好运翻倍！',
  '酒逢知己千杯少，先干为敬！',
  '好手气！这杯请你笑纳～',
  '感情深，一口闷，敬伯乐！',
  '酒樽不空，情谊不散！',
]

const SVG_GLASS = `
<svg viewBox="0 0 64 64" class="wd-glass-svg" aria-hidden="true">
  <defs>
    <linearGradient id="wg-wine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c6283a"/>
      <stop offset="1" stop-color="#6d0f1e"/>
    </linearGradient>
    <linearGradient id="wg-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d58a"/>
      <stop offset="1" stop-color="#b8863d"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-8 32 32)">
    <path d="M14 8h34l-4 40a3 3 0 0 1-3 2.7H21a3 3 0 0 1-3-2.7L14 8z" fill="none" stroke="url(#wg-gold)" stroke-width="2.4"/>
    <path d="M17.5 14c0 8 6 12 13 12s13-4 13-12z" fill="url(#wg-wine)"/>
    <path d="M12 8h38" stroke="url(#wg-gold)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="32" cy="14" rx="13" ry="3.4" fill="#f2d5a0" opacity="0.85"/>
    <path d="M31 2.5a1.5 1.5 0 0 1 2 0l1.4 3.4h-4.8z" fill="url(#wg-gold)"/>
  </g>
</svg>`

const SVG_SAFE = `
<svg viewBox="0 0 64 64" class="wd-safe-svg" aria-hidden="true">
  <defs>
    <linearGradient id="wg-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3726"/>
      <stop offset="1" stop-color="#2b1f14"/>
    </linearGradient>
  </defs>
  <g transform="rotate(8 32 32)">
    <path d="M32 8c5 4 13 5 13 12 0 12-13 22-13 22S19 32 19 20c0-7 8-8 13-12z" fill="url(#wg-ink)" opacity="0.28"/>
    <path d="M32 10c4.4 3.6 11.5 4.6 11.5 10.5 0 10.2-11.5 19-11.5 19S20.5 30.7 20.5 20.5C20.5 14.6 27.6 13.6 32 10z" fill="none" stroke="#c9a15f" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 26l-6-6.5 1.8-1.6L32 22.4l6.2-5.5 1.8 1.6z" fill="#c9a15f"/>
  </g>
</svg>`

const SVG_BACK = `
<svg viewBox="0 0 64 64" class="wd-back-svg" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="7" fill="none" stroke="#d8b877" stroke-width="2"/>
  <rect x="7" y="7" width="50" height="50" rx="4" fill="none" stroke="#d8b877" stroke-width="1" opacity="0.7"/>
  <circle cx="32" cy="32" r="15" fill="none" stroke="#d8b877" stroke-width="1.4" opacity="0.85"/>
  <circle cx="32" cy="32" r="8" fill="none" stroke="#d8b877" stroke-width="1.2" opacity="0.7"/>
  <path d="M32 24v16M24 32h16" stroke="#d8b877" stroke-width="1.6" stroke-linecap="round"/>
</svg>`

const SVG_BACK_BAR = SVG_BACK.replace('class="wd-back-svg"', 'class="wd-back-svg wd-bar-icon"')

const cfgAtom = atom({ total: 12, drinks: 3 })

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildDeck(total: number, drinks: number): Array<'drink' | 'safe'> {
  const deck: Array<'drink' | 'safe'> = []
  for (let i = 0; i < drinks; i++) deck.push('drink')
  for (let i = 0; i < total - drinks; i++) deck.push('safe')
  return shuffle(deck)
}

function clampTotalInt(t: number): number {
  if (Number.isNaN(t)) t = 2
  return Math.max(2, t)
}

function clampDrinksInt(d: number, total: number): number {
  if (Number.isNaN(d)) d = 1
  return Math.min(Math.max(1, d), total - 1)
}

function Setup({ onStart }: { onStart: (total: number, drinks: number) => void }) {
  const cfg = useAtomValue(cfgAtom)
  const [total, setTotal] = useState(String(cfg.total))
  const [drinks, setDrinks] = useState(String(cfg.drinks))

  const t = parseInt(total, 10)
  const d = parseInt(drinks, 10)
  const valid = !Number.isNaN(t) && !Number.isNaN(d)
  const hintError = valid && d >= t
  const hintText = !valid
    ? ''
    : hintError
      ? '酒杯数量必须少于卡牌数量'
      : `${t} 张牌 · 其中 ${d} 杯 · ${t - d} 张安全牌`

  const step = (field: 'total' | 'drinks', dir: number) => {
    let nt = clampTotalInt(parseInt(total, 10))
    let nd = clampDrinksInt(parseInt(drinks, 10), nt)
    if (field === 'total') nt = Math.max(2, nt + dir)
    else nd = Math.max(1, nd + dir)
    nt = clampTotalInt(nt)
    nd = clampDrinksInt(nd, nt)
    setTotal(String(nt))
    setDrinks(String(nd))
  }

  const start = () => {
    const nt = clampTotalInt(parseInt(total, 10))
    const nd = clampDrinksInt(parseInt(drinks, 10), nt)
    setTotal(String(nt))
    setDrinks(String(nd))
    if (nd >= nt) return
    onStart(nt, nd)
  }

  return (
    <div className="wd-shell wd-shell--center">
      <div className="wd-brand">
        <div className="wd-brand-mark" dangerouslySetInnerHTML={{ __html: SVG_GLASS }} />
        <h1 className="wd-title">谁喝酒</h1>
        <p className="wd-subtitle">翻到酒杯的人，喝一杯</p>
      </div>
      <div className="wd-setup-card">
        <label className="wd-field">
          <span className="wd-field-label">卡牌数量</span>
          <div className="wd-stepper">
            <button type="button" className="wd-step" aria-label="减少卡牌" onClick={() => step('total', -1)}>
              −
            </button>
            <input
              className="wd-num"
              id="wd-total"
              type="number"
              inputMode="numeric"
              min={2}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              onBlur={() => setTotal(String(clampTotalInt(parseInt(total, 10))))}
            />
            <button type="button" className="wd-step" aria-label="增加卡牌" onClick={() => step('total', 1)}>
              +
            </button>
          </div>
        </label>
        <label className="wd-field">
          <span className="wd-field-label">酒杯数量</span>
          <div className="wd-stepper">
            <button type="button" className="wd-step" aria-label="减少酒杯" onClick={() => step('drinks', -1)}>
              −
            </button>
            <input
              className="wd-num"
              id="wd-drinks"
              type="number"
              inputMode="numeric"
              min={1}
              value={drinks}
              onChange={(e) => setDrinks(e.target.value)}
              onBlur={() => {
                const nt = clampTotalInt(parseInt(total, 10))
                setDrinks(String(clampDrinksInt(parseInt(drinks, 10), nt)))
              }}
            />
            <button type="button" className="wd-step" aria-label="增加酒杯" onClick={() => step('drinks', 1)}>
              +
            </button>
          </div>
        </label>
        <p className={`wd-hint${hintError ? ' wd-hint--error' : ''}`}>{hintText}</p>
        <button type="button" className="wd-btn wd-btn--primary" onClick={start}>
          开一局
        </button>
      </div>
    </div>
  )
}

interface ConfettiPiece {
  left: number
  bg: string
  duration: number
  delay: number
  rotate: number
  round: boolean
}

function DrinkModal({
  remaining,
  onContinue,
  onNextRound,
}: {
  remaining: number
  onContinue: () => void
  onNextRound: () => void
}) {
  const [copy, setCopy] = useState('')
  const target = useMemo(() => randomFrom(COPY_POOL), [])

  useEffect(() => {
    const CHARS = '酒樽杯盏饮斟酌酣醉缘分情谊敬满干尽香气麦芽琥珀'
    let i = 0
    const timer = setInterval(() => {
      let out = ''
      for (let k = 0; k < Math.ceil(i); k++) out += target[k]
      for (let k = Math.ceil(i); k < target.length; k++)
        out += CHARS[Math.floor(Math.random() * CHARS.length)]
      setCopy(out)
      i += 0.5
      if (i >= target.length) {
        setCopy(target)
        clearInterval(timer)
      }
    }, 40)
    return () => clearInterval(timer)
  }, [target])

  const confetti = useMemo<ConfettiPiece[]>(() => {
    const colors = ['#d8b877', '#c6283a', '#f3d58a', '#8e1b2b', '#f6ecd8', '#b8863d']
    return Array.from({ length: 32 }, (_, n) => ({
      left: Math.random() * 100,
      bg: colors[n % colors.length],
      duration: 2.4 + Math.random() * 2.4,
      delay: Math.random() * 2,
      rotate: Math.random() * 360,
      round: Math.random() > 0.5,
    }))
  }, [])

  return (
    <div className="wd-prize">
      <div className="wd-confetti">
        {confetti.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              background: p.bg,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              transform: `rotate(${p.rotate}deg)`,
              borderRadius: p.round ? '50%' : undefined,
            }}
          />
        ))}
      </div>
      <div className="wd-prize-glow" />
      <div className="wd-prize-card">
        <div className="wd-prize-glass" dangerouslySetInnerHTML={{ __html: SVG_GLASS }} />
        <h2 className="wd-prize-title">喝一杯！</h2>
        <p className="wd-prize-copy">{copy}</p>
      </div>
      <div className="wd-prize-actions">
        {remaining > 0 ? (
          <button className="wd-btn wd-btn--ghost" onClick={onContinue}>
            继续
          </button>
        ) : null}
        <button
          className={`wd-btn ${remaining > 0 ? 'wd-btn--secondary' : 'wd-btn--primary'}`}
          onClick={onNextRound}
        >
          下一轮
        </button>
      </div>
    </div>
  )
}

function Game({ onReset }: { onReset: () => void }) {
  const cfg = useAtomValue(cfgAtom)
  const [deck, setDeck] = useState(() => buildDeck(cfg.total, cfg.drinks))
  const [flipped, setFlipped] = useState<number[]>([])
  const [remaining, setRemaining] = useState(cfg.drinks)
  const [locked, setLocked] = useState(false)
  const [modal, setModal] = useState<{ remaining: number } | null>(null)
  const [leaving, setLeaving] = useState(false)

  const flipCard = (i: number, kind: 'drink' | 'safe') => {
    if (locked || flipped.includes(i)) return
    const next = [...flipped, i]
    setFlipped(next)
    if (kind === 'safe') return
    setLocked(true)
    const newRemaining = remaining - 1
    setRemaining(newRemaining)
    setTimeout(() => setModal({ remaining: newRemaining }), 320)
  }

  const resetRound = () => {
    setDeck(buildDeck(cfg.total, cfg.drinks))
    setFlipped([])
    setRemaining(cfg.drinks)
    setLocked(false)
  }

  const closeModal = (action: () => void) => {
    setLeaving(true)
    action()
    setTimeout(() => {
      setModal(null)
      setLeaving(false)
    }, 220)
  }

  return (
    <>
      <div className="wd-shell wd-shell--game">
        <div className="wd-bar">
          <button
            type="button"
            className="wd-bar-btn"
            aria-label="重新设置"
            onClick={onReset}
            dangerouslySetInnerHTML={{ __html: SVG_BACK_BAR }}
          />
          <div className="wd-bar-center">
            <span className="wd-bar-count">
              剩余 <b>{remaining}</b> 杯
            </span>
            <span className="wd-bar-progress">
              {flipped.length} / {cfg.total}
            </span>
          </div>
          <div className="wd-bar-spacer"></div>
        </div>
        <div className="wd-grid">
          {deck.map((kind, i) => {
            const flippedNow = flipped.includes(i)
            const cardClass = `wd-card${flippedNow ? ' is-flipped' : ''}${
              flippedNow && kind === 'safe' ? ' is-safe' : ''
            }${flippedNow && kind === 'drink' ? ' is-drink' : ''}`
            return (
              <button
                key={i}
                type="button"
                className={cardClass}
                aria-label="卡牌"
                onClick={() => flipCard(i, kind)}
              >
                <span className="wd-card-inner">
                  <span
                    className="wd-card-face wd-card-face--back"
                    dangerouslySetInnerHTML={{ __html: SVG_BACK }}
                  />
                  <span
                    className={`wd-card-face wd-card-face--front wd-card-face--${kind}`}
                    dangerouslySetInnerHTML={{ __html: kind === 'drink' ? SVG_GLASS : SVG_SAFE }}
                  />
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {modal ? (
        <div className={`wd-overlay${leaving ? ' is-leaving' : ''}`}>
          <DrinkModal
            remaining={modal.remaining}
            onContinue={() => closeModal(() => setLocked(false))}
            onNextRound={() => closeModal(resetRound)}
          />
        </div>
      ) : null}
    </>
  )
}

export default function WhoDrinks() {
  const [cfg, setCfg] = useAtom(cfgAtom)
  const [screen, setScreen] = useState<'setup' | 'game'>('setup')

  useEffect(() => {
    getGame('who-drinks')
    recordPlay('who-drinks')
  }, [])

  return (
    <>
      <div className="wd-texture" aria-hidden="true" />
      <a className="wd-back-link" href="/" aria-label="返回大厅">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </a>
      <div className="wd-app">
        {screen === 'setup' ? (
          <Setup
            onStart={(total, drinks) => {
              setCfg({ total, drinks })
              setScreen('game')
            }}
          />
        ) : (
          <Game onReset={() => setScreen('setup')} />
        )}
      </div>
    </>
  )
}
