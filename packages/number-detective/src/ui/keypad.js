import { Container, Graphics, Text, Rectangle } from 'pixi.js'

const W = 72, H = 56, GAP = 6

export function createKeypad(onDigit, onClear, onConfirm) {
  const container = new Container()
  const keys = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['←','0','✓'],
  ]

  keys.forEach((row, ri) => {
    row.forEach((label, ci) => {
      const x = ci * (W + GAP)
      const y = ri * (H + GAP)
      const isConfirm = label === '✓'
      const isClear = label === '←'

      const bg = new Graphics()
        .roundRect(0, 0, W, H, 8)
        .fill({ color: isConfirm ? 0x059669 : isClear ? 0xdc2626 : 0x1f2937 })

      const txt = new Text({
        text: label,
        style: { fontSize: 20, fill: 0xffffff, fontFamily: 'system-ui' },
      })
      txt.anchor.set(0.5)
      txt.x = W / 2
      txt.y = H / 2

      const btn = new Container()
      btn.addChild(bg, txt)
      btn.position.set(x, y)
      btn.eventMode = 'static'
      btn.cursor = 'pointer'
      btn.hitArea = new Rectangle(0, 0, W, H)
      btn.on('pointerdown', () => {
        if (isClear) onClear()
        else if (isConfirm) onConfirm()
        else onDigit(label)
      })
      container.addChild(btn)
    })
  })

  return container
}
