import { Container, Text, Graphics, Rectangle } from 'pixi.js'

export function createCreateRoomScreen({ code, onBack }) {
  const container = new Container()

  const title = new Text({
    text: '房间已创建',
    style: { fontSize: 28, fill: 0xffffff, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = 400
  title.y = 160
  container.addChild(title)

  const codeText = new Text({
    text: code,
    style: { fontSize: 56, fill: 0x10b981, fontFamily: 'monospace', letterSpacing: 8 },
  })
  codeText.anchor.set(0.5)
  codeText.x = 400
  codeText.y = 260
  container.addChild(codeText)

  const hint = new Text({
    text: '将此口令告知对方',
    style: { fontSize: 16, fill: 0x9ca3af, fontFamily: 'system-ui' },
  })
  hint.anchor.set(0.5)
  hint.x = 400
  hint.y = 310
  container.addChild(hint)

  const waiting = new Text({
    text: '等待对手加入...',
    style: { fontSize: 20, fill: 0xfbbf24, fontFamily: 'system-ui' },
  })
  waiting.anchor.set(0.5)
  waiting.x = 400
  waiting.y = 380
  container.addChild(waiting)

  const backBg = new Graphics().roundRect(0, 0, 140, 44, 10).fill({ color: 0x374151 })
  const backText = new Text({
    text: '取消',
    style: { fontSize: 18, fill: 0xffffff, fontFamily: 'system-ui' },
  })
  backText.anchor.set(0.5)
  backText.x = 70
  backText.y = 22
  const backBtn = new Container()
  backBtn.addChild(backBg, backText)
  backBtn.position.set(400 - 70, 460)
  backBtn.eventMode = 'static'
  backBtn.cursor = 'pointer'
  backBtn.hitArea = new Rectangle(0, 0, 140, 44)
  backBtn.on('pointerdown', onBack)
  container.addChild(backBtn)

  return container
}