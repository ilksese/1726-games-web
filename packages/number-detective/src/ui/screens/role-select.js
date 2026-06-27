import { Container, Text, Graphics, Rectangle } from 'pixi.js'

export function createRoleSelectScreen({ onCreate, onJoin }) {
  const container = new Container()

  const title = new Text({
    text: '数字侦探',
    style: { fontSize: 40, fill: 0x10b981, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = 400
  title.y = 160
  container.addChild(title)

  const subtitle = new Text({
    text: '局域网双人数字破译',
    style: { fontSize: 18, fill: 0x9ca3af, fontFamily: 'system-ui' },
  })
  subtitle.anchor.set(0.5)
  subtitle.x = 400
  subtitle.y = 210
  container.addChild(subtitle)

  const btnW = 200, btnH = 56

  function makeButton(text, x, y, color, cb) {
    const bg = new Graphics().roundRect(0, 0, btnW, btnH, 10).fill({ color })
    const label = new Text({
      text,
      style: { fontSize: 22, fill: 0xffffff, fontFamily: 'system-ui' },
    })
    label.anchor.set(0.5)
    label.x = btnW / 2
    label.y = btnH / 2
    const btn = new Container()
    btn.addChild(bg, label)
    btn.position.set(x, y)
    btn.eventMode = 'static'
    btn.cursor = 'pointer'
    btn.hitArea = new Rectangle(0, 0, btnW, btnH)
    btn.on('pointerdown', cb)
    return btn
  }

  container.addChild(makeButton('创建房间', 400 - btnW - 12, 320, 0x059669, onCreate))
  container.addChild(makeButton('加入房间', 400 + 12, 320, 0x6366f1, onJoin))

  return container
}