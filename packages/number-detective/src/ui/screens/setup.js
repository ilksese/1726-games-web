import { Container, Text, Graphics, Rectangle } from 'pixi.js'

export function createSetupScreen({ secret, onDigit, onClear, onConfirm, ready, waiting }) {
  const container = new Container()

  const title = new Text({
    text: '设置谜底',
    style: { fontSize: 28, fill: 0xffffff, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = 400
  title.y = 80
  container.addChild(title)

  const hint = new Text({
    text: '输入4位不重复的数字',
    style: { fontSize: 16, fill: 0x9ca3af, fontFamily: 'system-ui' },
  })
  hint.anchor.set(0.5)
  hint.x = 400
  hint.y = 120
  container.addChild(hint)

  // Secret input display (4 cells)
  const cells = []
  const cellW = 64, cellH = 72, gap = 10
  const sx = 400 - (1.5 * (cellW + gap) + cellW / 2)
  for (let i = 0; i < 4; i++) {
    const bg = new Graphics()
      .roundRect(0, 0, cellW, cellH, 10)
      .fill({ color: 0x1f2937 })
    const txt = new Text({
      text: i < secret.length ? secret[i] : '_',
      style: {
        fontSize: 32,
        fill: i < secret.length ? 0xffffff : 0x9ca3af,
        fontFamily: 'monospace',
      },
    })
    txt.anchor.set(0.5)
    txt.x = cellW / 2
    txt.y = cellH / 2
    const cell = new Container()
    cell.position.set(sx + i * (cellW + gap), 160)
    cell.addChild(bg, txt)
    container.addChild(cell)
    cells.push(txt)
  }

  // Keypad
  const keyW = 72, keyH = 56, kgap = 6
  const keys = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['←','0','✓'],
  ]
  const kx = 400 - (1.5 * (keyW + kgap) + keyW / 2)
  keys.forEach((row, ri) => {
    row.forEach((label, ci) => {
      const x = kx + ci * (keyW + kgap)
      const y = 270 + ri * (keyH + kgap)
      const isConfirm = label === '✓'
      const isClear = label === '←'
      const bg = new Graphics()
        .roundRect(0, 0, keyW, keyH, 8)
        .fill({ color: isConfirm ? 0x059669 : isClear ? 0xdc2626 : 0x1f2937 })
      const txt = new Text({
        text: label,
        style: { fontSize: 20, fill: 0xffffff, fontFamily: 'system-ui' },
      })
      txt.anchor.set(0.5)
      txt.x = keyW / 2
      txt.y = keyH / 2
      const btn = new Container()
      btn.addChild(bg, txt)
      btn.position.set(x, y)
      btn.eventMode = 'static'
      btn.cursor = 'pointer'
      btn.hitArea = new Rectangle(0, 0, keyW, keyH)
      btn.on('pointerdown', () => {
        if (isClear) onClear()
        else if (isConfirm) onConfirm()
        else onDigit(label)
      })
      container.addChild(btn)
    })
  })

  // Status
  const statusText = new Text({
    text: ready ? '已设置，等待对手...' : waiting ? '对手已就绪，等你设置' : '',
    style: { fontSize: 16, fill: 0xfbbf24, fontFamily: 'system-ui' },
  })
  statusText.anchor.set(0.5)
  statusText.x = 400
  statusText.y = 540
  container.addChild(statusText)

  return container
}
