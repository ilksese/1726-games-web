export function createGuessInput() {
  const wrap = document.createElement('div')
  wrap.className = 'flex gap-2 justify-center'

  const cells = []
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div')
    cell.className = 'w-16 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-3xl font-mono text-gray-500'
    cell.textContent = '_'
    wrap.appendChild(cell)
    cells.push(cell)
  }

  function setValue(digits) {
    for (let i = 0; i < 4; i++) {
      if (i < digits.length) {
        cells[i].textContent = digits[i]
        cells[i].className = 'w-16 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-3xl font-mono text-white'
      } else {
        cells[i].textContent = '_'
        cells[i].className = 'w-16 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-3xl font-mono text-gray-500'
      }
    }
  }

  return { element: wrap, setValue }
}
