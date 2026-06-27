import { createKeypad } from '../keypad.js'

export function createSetupScreen({ secret, onDigit, onClear, onConfirm, ready, waiting }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4 py-8'

  wrap.innerHTML = `
    <h2 class="text-3xl font-semibold text-white mb-2">设置谜底</h2>
    <p class="text-gray-400 text-base mb-6">输入4位不重复的数字</p>
    <div class="flex gap-2.5 justify-center mb-8"></div>
    <p data-status class="text-amber-400 text-base min-h-[24px] mb-4"></p>
  `

  const cellsWrap = wrap.querySelector('div.flex')
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div')
    cell.className = 'w-16 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-3xl font-mono text-gray-500'
    cell.textContent = i < secret.length ? secret[i] : '_'
    if (i < secret.length) {
      cell.classList.remove('text-gray-500')
      cell.classList.add('text-white')
    }
    cellsWrap.appendChild(cell)
  }

  const statusEl = wrap.querySelector('[data-status]')
  statusEl.textContent = ready ? '已设置，等待对手...' : waiting ? '对手已就绪，等你设置' : ''

  const keypad = createKeypad({ onDigit, onClear, onConfirm })
  wrap.insertBefore(keypad.element, statusEl)

  return wrap
}
