import { Container, Graphics, Text } from 'pixi.js'

const W = 60, H = 64, GAP = 8

export function createGuessInput() {
  const container = new Container()
  const cells = []

  for (let i = 0; i < 4; i++) {
    const bg = new Graphics()
      .roundRect(0, 0, W, H, 8)
      .fill({ color: 0x1f2937 })

    const txt = new Text({
      text: '_',
      style: { fontSize: 28, fill: 0x9ca3af, fontFamily: 'monospace' },
    })
    txt.anchor.set(0.5)
    txt.x = W / 2
    txt.y = H / 2

    const cell = new Container()
    cell.position.set(i * (W + GAP), 0)
    cell.addChild(bg, txt)
    container.addChild(cell)
    cells.push({ bg, txt })
  }

  function setValue(digits) {
    for (let i = 0; i < 4; i++) {
      if (i < digits.length) {
        cells[i].txt.text = digits[i]
        cells[i].txt.style.fill = 0xffffff
      } else {
        cells[i].txt.text = '_'
        cells[i].txt.style.fill = 0x9ca3af
      }
    }
  }

  return { container, setValue }
}
