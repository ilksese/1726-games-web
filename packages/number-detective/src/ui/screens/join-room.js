import { createKeypad } from '../keypad.js'

export function createJoinRoomScreen({ onJoin, onBack, error }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4 py-8'

  wrap.innerHTML = `
    <h2 class="text-3xl font-semibold text-white mb-6">加入房间</h2>
    <div class="flex gap-1.5 justify-center mb-6"></div>
    <p data-error class="text-red-400 text-sm text-center min-h-[20px] mb-4"></p>
    <button type="button" data-back class="mt-6 text-gray-400 hover:text-white text-sm">&larr; 返回</button>
  `

  const slotsWrap = wrap.querySelector('div.flex')
  const slots = []
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div')
    s.className = 'w-11 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-2xl font-mono text-gray-500'
    s.textContent = '_'
    slotsWrap.appendChild(s)
    slots.push(s)
  }

  let input = ''

  function updateDisplay() {
    for (let i = 0; i < 6; i++) {
      if (i < input.length) {
        slots[i].textContent = input[i]
        slots[i].className = 'w-11 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-2xl font-mono text-white'
      } else {
        slots[i].textContent = '_'
        slots[i].className = 'w-11 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-2xl font-mono text-gray-500'
      }
    }
  }

  function commit() {
    if (input.length === 6) onJoin(input)
  }

  const keypad = createKeypad({
    onDigit: (d) => { if (input.length < 6) { input += d; updateDisplay() } },
    onClear: () => { input = input.slice(0, -1); updateDisplay() },
    onConfirm: commit,
  })
  wrap.insertBefore(keypad.element, wrap.querySelector('[data-error]'))

  if (error) wrap.querySelector('[data-error]').textContent = error
  wrap.querySelector('[data-back]').addEventListener('click', onBack)

  return wrap
}
