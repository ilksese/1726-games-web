import { Application, Text } from 'pixi.js'
import { getGame, saveScore, recordPlay } from '@games/shared'

async function init() {
  const game = getGame('game-b')
  recordPlay('game-b')

  const app = new Application()
  await app.init({
    width: 800,
    height: 600,
    background: 0x1b1b3a,
    antialias: true,
  })

  document.getElementById('game-container').appendChild(app.canvas)

  const title = new Text({
    text: game.name,
    style: { fontSize: 48, fill: 0xffffff, fontFamily: 'system-ui' },
  })
  title.anchor.set(0.5)
  title.x = app.screen.width / 2
  title.y = app.screen.height / 2 - 20
  app.stage.addChild(title)

  const subtitle = new Text({
    text: '开发中...',
    style: { fontSize: 24, fill: 0xf472b6, fontFamily: 'system-ui' },
  })
  subtitle.anchor.set(0.5)
  subtitle.x = app.screen.width / 2
  subtitle.y = app.screen.height / 2 + 30
  app.stage.addChild(subtitle)

  app.stage.eventMode = 'static'
  app.stage.on('pointerdown', () => {
    saveScore('game-b', Date.now() % 10000)
    title.text = `${game.name} - 已记录分数`
  })
}

init().catch(console.error)