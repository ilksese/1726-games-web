import { createKeypad } from '../keypad.js'

export function createSetupScreen({ secret, onDigit, onClear, onConfirm, ready, waiting }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--stack'

  wrap.innerHTML = `
    <div>
      <h2 class="nd-screen-title">设置谜底</h2>
      <p class="nd-screen-subtitle">输入 4 位不重复的数字</p>
    </div>
    <section class="nd-card nd-panel nd-stack">
      <div data-secret class="nd-secret-grid"></div>
      <p data-status class="min-h-[24px] text-center text-sm text-amber-300"></p>
    </section>
    <div data-keypad></div>
  `

  const cellsWrap = wrap.querySelector('[data-secret]')
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div')
    cell.className = 'nd-secret-cell'
    cell.textContent = i < secret.length ? secret[i] : '_'
    if (i < secret.length) {
      cell.classList.add('nd-secret-cell--filled')
    }
    cellsWrap.appendChild(cell)
  }

  const statusEl = wrap.querySelector('[data-status]')
  statusEl.textContent = ready ? '已设置，等待对手...' : waiting ? '对手已就绪，等你设置' : ''

  const keypad = createKeypad({ onDigit, onClear, onConfirm })
  wrap.querySelector('[data-keypad]').appendChild(keypad.element)

  return wrap
}
