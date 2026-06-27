export function createKeypad({ onDigit, onClear, onConfirm }) {
  const wrap = document.createElement('div')
  wrap.className = 'grid grid-cols-3 gap-1.5 w-full max-w-[280px] mx-auto'

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'confirm'],
  ]

  function makeKey(label, variant, cb) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    const base = 'min-h-[56px] rounded-lg text-xl font-semibold text-white transition-colors active:scale-95 select-none'
    const color = variant === 'confirm'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : variant === 'clear'
        ? 'bg-red-600 hover:bg-red-500'
        : 'bg-gray-800 hover:bg-gray-700'
    btn.className = `${base} ${color}`
    btn.addEventListener('click', cb)
    return btn
  }

  keys.forEach((row) => {
    row.forEach((k) => {
      if (k === 'clear') wrap.appendChild(makeKey('←', 'clear', onClear))
      else if (k === 'confirm') wrap.appendChild(makeKey('✓', 'confirm', onConfirm))
      else wrap.appendChild(makeKey(k, 'digit', () => onDigit(k)))
    })
  })

  return { element: wrap }
}
