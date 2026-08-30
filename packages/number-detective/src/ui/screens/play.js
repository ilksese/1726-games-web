import { icons } from '../icons.js'

function createPlayerCard({ title, tag, score, active, muted }) {
  const card = document.createElement('section')
  card.className = `nd-player-card${active ? ' nd-player-card--active' : ''}`
  card.innerHTML = `
    <div class="nd-player-top">
      <div class="nd-avatar${muted ? ' nd-avatar--muted' : ''}">${icons.user}</div>
      <div class="nd-player-copy">
        <div class="nd-player-name">${title}</div>
        <span class="nd-badge${active ? '' : ' nd-badge--muted'}">${tag}</span>
      </div>
    </div>
    <div class="nd-score">${score}</div>
  `
  return card
}

export function createPlayScreen({ guessInput, keypad, history }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--stack'

  wrap.innerHTML = `
    <div class="nd-topbar">
      <span class="nd-topbar__spacer" aria-hidden="true"></span>
      <h1 class="nd-topbar__title">较量中</h1>
      <div class="nd-topbar__actions" aria-hidden="true">
        <div class="nd-icon-button">${icons.more}</div>
        <div class="nd-icon-button">${icons.ring}</div>
      </div>
    </div>
    <section class="nd-player-row"></section>
    <button type="button" data-review class="nd-review-card nd-animate">
      <span class="nd-review-icon">${icons.clipboard}</span>
      <span>
        <span class="nd-review-title">复盘模式</span>
        <span class="nd-review-subtitle">查看本局游戏的猜测记录</span>
      </span>
    </button>
    <div data-history></div>
    <section data-controls class="nd-stack"></section>
  `

  const playerRow = wrap.querySelector('.nd-player-row')
  const historyWrap = wrap.querySelector('[data-history]')
  const controlsWrap = wrap.querySelector('[data-controls]')
  const reviewBtn = wrap.querySelector('[data-review]')

  const myCard = createPlayerCard({ title: '你', tag: '本机', score: '0000', active: true, muted: false })
  const oppCard = createPlayerCard({ title: '对手', tag: '远端', score: '0000', active: false, muted: true })
  const turnPill = document.createElement('div')
  turnPill.className = 'nd-turn-pill nd-turn-pill--waiting'
  turnPill.textContent = '轮到对手'

  playerRow.appendChild(myCard)
  playerRow.appendChild(turnPill)
  playerRow.appendChild(oppCard)

  historyWrap.appendChild(history.element)

  const guessCard = document.createElement('section')
  guessCard.className = 'nd-card nd-panel'
  guessCard.innerHTML = '<div class="nd-screen-subtitle">输入猜测</div>'
  guessCard.appendChild(guessInput.element)

  const keypadCard = document.createElement('section')
  keypadCard.className = 'nd-card nd-panel'
  keypadCard.appendChild(keypad.element)

  controlsWrap.appendChild(guessCard)
  controlsWrap.appendChild(keypadCard)

  reviewBtn.addEventListener('click', () => {
    history.showMine?.()
    historyWrap.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  function updateTurn(engine) {
    turnPill.textContent = engine.isOver ? '对局结束' : engine.isMyTurn ? '轮到你' : '轮到对手'
    turnPill.className = `nd-turn-pill${engine.isMyTurn ? '' : ' nd-turn-pill--waiting'}`
    myCard.querySelector('.nd-score').textContent = String(engine.myGuesses.length).padStart(4, '0')
    oppCard.querySelector('.nd-score').textContent = String(engine.oppGuesses.length).padStart(4, '0')

    reviewBtn.classList.toggle('nd-card--accent', engine.myMatchPoint || engine.oppMatchPoint)
    controlsWrap.classList.toggle('nd-hidden', !engine.isMyTurn || engine.isOver)
  }

  return { element: wrap, updateTurn }
}
