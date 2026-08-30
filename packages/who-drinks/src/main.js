import { getGame, recordPlay } from '@games/shared'

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

const app = document.getElementById('app')

let cfg = { total: 12, drinks: 3 }

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildDeck(total, drinks) {
  const deck = []
  for (let i = 0; i < drinks; i++) deck.push('drink')
  for (let i = 0; i < total - drinks; i++) deck.push('safe')
  return shuffle(deck)
}

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

function mount(el) {
  app.replaceChildren(el)
}

function el(tag, className, html) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (html != null) node.innerHTML = html
  return node
}

// ---------- Setup screen ----------
function renderSetup() {
  const wrap = el('div', 'wd-shell wd-shell--center')
  wrap.innerHTML = `
    <div class="wd-brand">
      <div class="wd-brand-mark">${SVG_GLASS}</div>
      <h1 class="wd-title">谁喝酒</h1>
      <p class="wd-subtitle">翻到酒杯的人，喝一杯</p>
    </div>
    <div class="wd-setup-card">
      <label class="wd-field">
        <span class="wd-field-label">卡牌数量</span>
        <div class="wd-stepper">
          <button type="button" class="wd-step" data-dir="-1" aria-label="减少卡牌">−</button>
          <input class="wd-num" id="wd-total" type="number" inputmode="numeric" min="2" value="12">
          <button type="button" class="wd-step" data-dir="1" aria-label="增加卡牌">+</button>
        </div>
      </label>
      <label class="wd-field">
        <span class="wd-field-label">酒杯数量</span>
        <div class="wd-stepper">
          <button type="button" class="wd-step" data-dir="-1" aria-label="减少酒杯">−</button>
          <input class="wd-num" id="wd-drinks" type="number" inputmode="numeric" min="1" value="3">
          <button type="button" class="wd-step" data-dir="1" aria-label="增加酒杯">+</button>
        </div>
      </label>
      <p class="wd-hint" id="wd-hint"></p>
      <button type="button" class="wd-btn wd-btn--primary" id="wd-start">开一局</button>
    </div>
  `
  mount(wrap)

  const totalEl = wrap.querySelector('#wd-total')
  const drinksEl = wrap.querySelector('#wd-drinks')
  const hintEl = wrap.querySelector('#wd-hint')

  function clampTotal() {
    let t = parseInt(totalEl.value, 10)
    if (Number.isNaN(t)) t = 2
    t = Math.max(2, t)
    totalEl.value = t
    return t
  }
  function clampDrinks() {
    const t = clampTotal()
    const max = t - 1
    let d = parseInt(drinksEl.value, 10)
    if (Number.isNaN(d)) d = 1
    d = Math.min(Math.max(1, d), max)
    drinksEl.value = d
    return d
  }
  function syncHint() {
    const t = parseInt(totalEl.value, 10)
    const d = parseInt(drinksEl.value, 10)
    if (Number.isNaN(t) || Number.isNaN(d)) return
    if (d >= t) hintEl.textContent = '酒杯数量必须少于卡牌数量'
    else hintEl.textContent = `${t} 张牌 · 其中 ${d} 杯 · ${t - d} 张安全牌`
    hintEl.classList.toggle('wd-hint--error', d >= t)
  }

  totalEl.addEventListener('change', () => { clampTotal(); syncHint() })
  drinksEl.addEventListener('change', () => { clampDrinks(); syncHint() })

  wrap.querySelectorAll('.wd-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.dir)
      if (btn.closest('.wd-field').contains(totalEl)) totalEl.value = Math.max(2, (parseInt(totalEl.value, 10) || 2) + dir)
      else drinksEl.value = Math.max(1, (parseInt(drinksEl.value, 10) || 1) + dir)
      clampTotal(); clampDrinks(); syncHint()
    })
  })

  wrap.querySelector('#wd-start').addEventListener('click', () => {
    const t = clampTotal()
    const d = clampDrinks()
    syncHint()
    if (d >= t) return
    startGame(t, d)
  })

  syncHint()
}

// ---------- Game screen ----------
function startGame(total, drinks) {
  cfg = { total, drinks }
  const deck = buildDeck(total, drinks)
  const state = { total, drinks, flipped: [], remaining: drinks, locked: false }

  const stick = el('div', 'wd-bar')
  stick.innerHTML = `
    <button type="button" class="wd-bar-btn" id="wd-reset" aria-label="重新设置">${SVG_BACK.replace('class="wd-back-svg"', 'class="wd-back-svg wd-bar-icon"')}</button>
    <div class="wd-bar-center">
      <span class="wd-bar-count">剩余 <b id="wd-left">${drinks}</b> 杯</span>
      <span class="wd-bar-progress" id="wd-progress">0 / ${total}</span>
    </div>
    <div class="wd-bar-spacer"></div>
  `

  const grid = el('div', 'wd-grid')
  const wrap = el('div', 'wd-shell wd-shell--game')
  wrap.append(stick, grid)
  mount(wrap)

  const leftEl = stick.querySelector('#wd-left')
  const progressEl = stick.querySelector('#wd-progress')

  stick.querySelector('#wd-reset').addEventListener('click', renderSetup)

  deck.forEach((kind, i) => {
    const card = el('button', 'wd-card', '')
    card.type = 'button'
    card.setAttribute('aria-label', '卡牌')
    card.innerHTML = `
      <span class="wd-card-inner">
        <span class="wd-card-face wd-card-face--back">${SVG_BACK}</span>
        <span class="wd-card-face wd-card-face--front wd-card-face--${kind === 'drink' ? 'drink' : 'safe'}">${kind === 'drink' ? SVG_GLASS : SVG_SAFE}</span>
      </span>`
    card.addEventListener('click', () => flipCard(card, kind, i))
    grid.appendChild(card)
  })

  function flipCard(card, kind, i) {
    if (state.locked || state.flipped.includes(i)) return
    state.flipped.push(i)
    card.classList.add('is-flipped')
    if (kind === 'safe') {
      card.classList.add('is-safe')
      progressEl.textContent = `${state.flipped.length} / ${state.total}`
      return
    }
    // drink card → lock board, play reveal
    state.locked = true
    state.remaining -= 1
    leftEl.textContent = state.remaining
    progressEl.textContent = `${state.flipped.length} / ${state.total}`
    card.classList.add('is-drink')
    setTimeout(() => showDrinkModal(state.remaining, () => { state.locked = false }), 320)
  }
}

// ---------- Drink modal ----------
function showDrinkModal(remaining, onClose) {
  const overlay = el('div', 'wd-overlay')
  const prize = el('div', 'wd-prize')
  prize.innerHTML = `
    <div class="wd-confetti"></div>
    <div class="wd-prize-glow"></div>
    <div class="wd-prize-card">
      <div class="wd-prize-glass">${SVG_GLASS}</div>
      <h2 class="wd-prize-title">喝一杯！</h2>
      <p class="wd-prize-copy"></p>
    </div>
    <div class="wd-prize-actions"></div>
  `
  overlay.appendChild(prize)
  document.body.appendChild(overlay)

  const confetti = prize.querySelector('.wd-confetti')
  const confettiColors = ['#d8b877', '#c6283a', '#f3d58a', '#8e1b2b', '#f6ecd8', '#b8863d']
  for (let n = 0; n < 32; n++) {
    const p = el('span', '')
    p.style.left = `${Math.random() * 100}%`
    p.style.background = confettiColors[n % confettiColors.length]
    p.style.animationDuration = `${2.4 + Math.random() * 2.4}s`
    p.style.animationDelay = `${Math.random() * 2}s`
    p.style.transform = `rotate(${Math.random() * 360}deg)`
    if (Math.random() > 0.5) p.style.borderRadius = '50%'
    confetti.appendChild(p)
  }

  const copy = prize.querySelector('.wd-prize-copy')
  let i = 0

  // Scramble-text effect
  const target = randomFrom(COPY_POOL)
  const CHARS = '酒樽杯盏饮斟酌酣醉缘分情谊敬满干尽香气麦芽琥珀'
  let timer = setInterval(() => {
    let out = ''
    for (let k = 0; k < Math.ceil(i); k++) out += target[k]
    for (let k = Math.ceil(i); k < target.length; k++) out += CHARS[Math.floor(Math.random() * CHARS.length)]
    copy.textContent = out
    i += 0.5
    if (i >= target.length) {
      copy.textContent = target
      clearInterval(timer)
      timer = null
    }
  }, 40)

  const actions = prize.querySelector('.wd-prize-actions')

  function renderButtons() {
    actions.replaceChildren()
    const cont = el('button', 'wd-btn wd-btn--ghost', '继续')
    const next = el('button', `wd-btn ${remaining > 0 ? 'wd-btn--secondary' : 'wd-btn--primary'}`, '下一轮')
    if (remaining > 0) actions.appendChild(cont)
    actions.appendChild(next)
    cont.addEventListener('click', () => destroy())
    next.addEventListener('click', () => { destroy(); newRound() })
  }

  function destroy() {
    if (timer) clearInterval(timer)
    overlay.classList.add('is-leaving')
    setTimeout(() => overlay.remove(), 220)
    onClose()
  }

  renderButtons()
}

function newRound() {
  startGame(cfg.total, cfg.drinks)
}

function init() {
  recordPlay('who-drinks')
  getGame('who-drinks')
  renderSetup()
}

init()
