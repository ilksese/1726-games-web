export function createPlayScreen({ guessInput, keypad, historyModal }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center px-4 pt-16 pb-8'

  wrap.innerHTML = `
    <p data-turn class="text-lg font-medium mb-1"></p>
    <p data-matchpoint class="text-amber-400 text-sm mb-4 hidden">⚡ 赛点 — 再猜中即胜!</p>
    <div data-guess class="mb-6"></div>
    <div data-keypad class="mb-8"></div>
    <button type="button" data-history class="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors active:scale-95">📜 记录</button>
  `

  const turnEl = wrap.querySelector('[data-turn]')
  const matchpointEl = wrap.querySelector('[data-matchpoint]')
  const guessWrap = wrap.querySelector('[data-guess]')
  const keypadWrap = wrap.querySelector('[data-keypad]')

  guessWrap.appendChild(guessInput.element)
  keypadWrap.appendChild(keypad.element)
  wrap.querySelector('[data-history]').addEventListener('click', () => historyModal.open())

  function updateTurn(engine) {
    turnEl.textContent = engine.isMyTurn ? '你的回合' : '对方回合...'
    turnEl.className = `text-lg font-medium mb-1 ${engine.isMyTurn ? 'text-emerald-400' : 'text-gray-400'}`
    if (engine.myMatchPoint) {
      matchpointEl.classList.remove('hidden')
    } else {
      matchpointEl.classList.add('hidden')
    }
  }

  return { element: wrap, updateTurn }
}
