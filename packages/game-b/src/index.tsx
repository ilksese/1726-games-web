import { useEffect, useRef } from 'react'
import { Application, Text } from 'pixi.js'
import { getGame, saveScore, recordPlay } from '@games/shared'
import './style.css'

export default function GameB() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const game = getGame('game-b')!
    recordPlay('game-b')
    const container = containerRef.current!

    let destroyed = false
    const app = new Application()
    const destroyOnce = () => {
      if (!destroyed) {
        destroyed = true
        try {
          app.destroy()
        } catch {
          /* noop */
        }
      }
    }

    app
      .init({
        width: 800,
        height: 600,
        background: 0x1b1b3a,
        antialias: true,
      })
      .then(() => {
        if (destroyed) return
        container.appendChild(app.canvas)

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
      })
      .catch((err) => {
        console.error(err)
        if (!destroyed) {
          container.innerHTML = '<p style="color:red;padding:2rem;">游戏加载失败，请刷新重试</p>'
        }
      })

    return destroyOnce
  }, [])

  return (
    <>
      <a id="back-link" href="/">
        ← 返回大厅
      </a>
      <div className="game-page">
        <div id="game-container" ref={containerRef} />
      </div>
    </>
  )
}
