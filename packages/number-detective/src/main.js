import { Application, Text } from 'pixi.js'
import { getGame, recordPlay } from '@games/shared'

async function init() {
  const game = getGame('number-detective')
  recordPlay('number-detective')

  const app = new Application()
  await app.init({ width: 800, height: 600, background: 0x030712 })

  document.getElementById('game-container').appendChild(app.canvas)

  const title = new Text({
    text: game.name,
    style: { fontSize: 48, fill: 0x10b981, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = app.screen.width / 2
  title.y = app.screen.height / 2
  app.stage.addChild(title)
}

init().catch(err => {
  console.error(err)
  document.getElementById('game-container').innerHTML = '<p style="color:red;padding:2rem;">游戏加载失败</p>'
})
