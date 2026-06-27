import { Container, Text, Graphics, Rectangle } from 'pixi.js'

export function createResultScreen({ won, onRematch, onLeave }) {
  const container = new Container()

  const title = new Text({
    text: won ? '你赢了!' : '你输了',
    style: {
      fontSize: 48,
      fill: won ? 0x22c55e : 0xff4444,
      fontFamily: 'system-ui',
    },
  })
  title.anchor.set(0.5)
  title.x = 400
  title.y = 200
  container.addChild(title)

  function makeButton(text, x, y, color, cb) {
    const bg = new Graphics().roundRect(0, 0, 160, 50, 10).fill({ color })
    const label = new Text({
      text,
      style: { fontSize: 20, fill: 0xffffff, fontFamily: 'system-ui' },
    })
    label.anchor.set(0.5)
    label.x = 80
    label.y = 25
    const btn = new Container()
    btn.addChild(bg, label)
    btn.position.set(x, y)
    btn.eventMode = 'static'
    btn.cursor = 'pointer'
    btn.hitArea = new Rectangle(0, 0, 160, 50)
    btn.on('pointerdown', cb)
    return btn
  }

  container.addChild(makeButton('再来一局', 400 - 170, 320, 0x059669, onRematch))
  container.addChild(makeButton('返回大厅', 400 + 10, 320, 0x374151, onLeave))

  return container
}