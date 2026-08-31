import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { getGame, recordPlay } from '@games/shared'
import RemoteWhoDrinks, { getRemoteRoomParams } from './RemoteWhoDrinks'
import { COPY_POOL } from "./visuals"
import './style.css'

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
        <button type="button" className="wd-btn wd-btn--primary" onClick={start} aria-label="开一局" />
      </div>
      <p className="wd-footer">木质酒馆聚会游戏 · 合理饮酒 · 量力而行</p>
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
        <div className="wd-prize-glass" />
        <h2 className="wd-prize-title">喝一杯！</h2>
        <p className="wd-prize-copy">{copy}</p>
      </div>
      <div className="wd-prize-actions">
        {remaining > 0 ? (
          <button className="wd-btn wd-btn--continue" onClick={onContinue} aria-label="继续" />
        ) : null}
        <button className="wd-btn wd-btn--next" onClick={onNextRound} aria-label="下一轮" />
      </div>
    </div>
  )
}

const MIN_CARD_W = 30
const CARD_AR = 1.5

function Game({ onReset }: { onReset: () => void }) {
  const cfg = useAtomValue(cfgAtom)
  const [deck, setDeck] = useState(() => buildDeck(cfg.total, cfg.drinks))
  const [flipped, setFlipped] = useState<number[]>([])
  const [remaining, setRemaining] = useState(cfg.drinks)
  const [locked, setLocked] = useState(false)
  const [modal, setModal] = useState<{ remaining: number } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const g = gridRef.current
    if (!g) return
    const compute = () => {
      g.style.width = ''
      const W = g.clientWidth
      const H = g.clientHeight
      const n = deck.length
      if (!W || !H || !n) return
      // ponytail: auto-fill 只按宽度数列，不知道牌数与高度约束，这里穷举 c；
      // 先强制 30px 下限，牌多放不下时允许跌破下限保一屏
      let best: { c: number; width: number; gap: number; area: number } | null = null
      const maxCols = Math.min(n, 12)
      for (const minW of [MIN_CARD_W, 0]) {
        for (let c = 1; c <= maxCols; c++) {
          const gap = Math.max(0, Math.min(14, Math.round((W / c) * 0.12)))
          const r = Math.ceil(n / c)
          const cwFull = (W - (c - 1) * gap) / c
          const cw = Math.min(cwFull, (H - (r - 1) * gap) / r / CARD_AR)
          if (cw < minW + 0.5) continue
          const area = cw * cw
          if (!best || area > best.area) {
            best = { c, width: cw < cwFull - 0.5 ? c * cw + (c - 1) * gap : W, gap, area }
          }
        }
        if (best) break
      }
      if (best) {
        g.style.width = best.width < W - 0.5 ? `${best.width}px` : ''
        g.style.gap = `${best.gap}px`
        g.style.gridTemplateColumns = `repeat(${best.c}, minmax(0, 1fr))`
      }
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [deck])

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
          <button type="button" className="wd-bar-btn" aria-label="重新设置" onClick={onReset} />
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
        <div className="wd-grid" ref={gridRef}>
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
                  <span className="wd-card-face wd-card-face--back" />
                  <span className={`wd-card-face wd-card-face--front wd-card-face--${kind}`} />
                </span>
              </button>
            )
          })}
        </div>
        <p className="wd-footer">木质酒馆聚会游戏 · 合理饮酒 · 量力而行</p>
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
  const remoteRoom = getRemoteRoomParams()
  if (remoteRoom) {
    return <RemoteWhoDrinks {...remoteRoom} />
  }
  return <LocalWhoDrinks />
}

function LocalWhoDrinks() {
  const [cfg, setCfg] = useAtom(cfgAtom)
  const [screen, setScreen] = useState<'setup' | 'game'>('setup')

  useEffect(() => {
    getGame('who-drinks')
    recordPlay('who-drinks')
  }, [])

  return (
    <>
      <a className="wd-back-link" href="/" aria-label="返回大厅" />
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
