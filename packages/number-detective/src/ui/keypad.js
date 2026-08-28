export function createKeypad({ onDigit, onClear, onConfirm }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-keypad'

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
    btn.setAttribute('aria-label', variant === 'clear' ? '删除' : variant === 'confirm' ? '确认' : `输入 ${label}`)
    btn.className = `nd-keypad__button${variant === 'confirm' ? ' nd-keypad__button--confirm' : variant === 'clear' ? ' nd-keypad__button--clear' : ''}`
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
