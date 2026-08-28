export function createGuessInput() {
  const wrap = document.createElement('div')
  wrap.className = 'nd-entry-grid'

  const cells = []
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement('div')
    cell.className = 'nd-entry-cell'
    cell.textContent = '_'
    wrap.appendChild(cell)
    cells.push(cell)
  }

  function setValue(digits) {
    for (let i = 0; i < 4; i++) {
      if (i < digits.length) {
        cells[i].textContent = digits[i]
        cells[i].className = 'nd-entry-cell nd-entry-cell--filled'
      } else {
        cells[i].textContent = '_'
        cells[i].className = 'nd-entry-cell'
      }
    }
  }

  return { element: wrap, setValue }
}
