import { Container, Text, Graphics, Rectangle } from 'pixi.js'

export function createJoinRoomScreen({ onJoin, onBack, error }) {
  const container = new Container()

  const title = new Text({
    text: '加入房间',
    style: { fontSize: 28, fill: 0xffffff, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = 400
  title.y = 140
  container.addChild(title)

  // 6 slot code input display
  const slots = []
  const slotW = 48, slotH = 64, gap = 6
  const startX = 400 - (3 * (slotW + gap) + slotW / 2)

  for (let i = 0; i < 6; i++) {
    const bg = new Graphics()
      .roundRect(0, 0, slotW, slotH, 8)
      .fill({ color: 0x1f2937 })
    const txt = new Text({
      text: '_',
      style: { fontSize: 28, fill: 0x9ca3af, fontFamily: 'monospace' },
    })
    txt.anchor.set(0.5)
    txt.x = slotW / 2
    txt.y = slotH / 2
    const cell = new Container()
    cell.position.set(startX + i * (slotW + gap), 220)
    cell.addChild(bg, txt)
    container.addChild(cell)
    slots.push(txt)
  }

  let input = ''
  const commit = () => {
    if (input.length === 6) onJoin(input)
  }
  const updateDisplay = () => {
    for (let i = 0; i < 6; i++) {
      slots[i].text = i < input.length ? input[i] : '_'
      slots[i].style.fill = i < input.length ? 0xffffff : 0x9ca3af
    }
  }

  // Keypad for code entry (0-9, ←, ✓)
  const keyW = 60, keyH = 50, kgap = 4
  const keys = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['←','0','✓'],
  ]
  const kx0 = 400 - (1.5 * (keyW + kgap) + keyW / 2)
  keys.forEach((row, ri) => {
    row.forEach((label, ci) => {
      const x = kx0 + ci * (keyW + kgap)
      const y = 310 + ri * (keyH + kgap)
      const isConfirm = label === '✓'
      const isClear = label === '←'
      const bg = new Graphics()
        .roundRect(0, 0, keyW, keyH, 8)
        .fill({ color: isConfirm ? 0x059669 : isClear ? 0xdc2626 : 0x374151 })
      const txt = new Text({
        text: label,
        style: { fontSize: 18, fill: 0xffffff, fontFamily: 'system-ui' },
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
        if (isClear) { input = input.slice(0, -1); updateDisplay() }
        else if (isConfirm) commit()
        else if (input.length < 6) { input += label; updateDisplay() }
      })
      container.addChild(btn)
    })
  })

  if (error) {
    const errText = new Text({
      text: error,
      style: { fontSize: 16, fill: 0xff4444, fontFamily: 'system-ui' },
    })
    errText.anchor.set(0.5)
    errText.x = 400
    errText.y = 560
    container.addChild(errText)
  }

  const backBtn = new Text({
    text: '← 返回',
    style: { fontSize: 16, fill: 0x9ca3af, fontFamily: 'system-ui' },
  })
  backBtn.eventMode = 'static'
  backBtn.cursor = 'pointer'
  backBtn.position.set(20, 560)
  backBtn.on('pointerdown', onBack)
  container.addChild(backBtn)

  return container
}