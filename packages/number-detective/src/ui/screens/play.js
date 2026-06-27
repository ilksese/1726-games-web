import { Container, Text } from 'pixi.js'
import { createKeypad } from '../keypad.js'
import { createGuessInput } from '../guess-input.js'
import { createHistory } from '../history.js'

export function createPlayScreen({
  engine, onDigit, onClear, onConfirm, guessInput, keypad, history,
}) {
  const container = new Container()

  // Turn indicator
  const turnText = new Text({
    text: engine.isMyTurn ? '你的回合' : '对方回合...',
    style: {
      fontSize: 18,
      fill: engine.isMyTurn ? 0x22c55e : 0x9ca3af,
      fontFamily: 'system-ui',
    },
  })
  turnText.anchor.set(0.5)
  turnText.x = 400
  turnText.y = 20
  container.addChild(turnText)

  // Match point indicator
  if (engine.myMatchPoint) {
    const mp = new Text({
      text: '⚡ 赛点 — 再猜中即胜!',
      style: { fontSize: 16, fill: 0xfbbf24, fontFamily: 'system-ui' },
    })
    mp.anchor.set(0.5)
    mp.x = 400
    mp.y = 48
    container.addChild(mp)
  }

  // Guess input
  guessInput.container.position.set(400 - 150, 80)
  container.addChild(guessInput.container)

  // Keypad
  keypad.container.position.set(400 - 114, 180)
  container.addChild(keypad.container)

  // History
  history.container.position.set(30, 380)
  container.addChild(history.container)

  return container
}

export function updatePlayTurn(container, engine, turnText) {
  turnText.text = engine.isMyTurn ? '你的回合' : '对方回合...'
  turnText.style.fill = engine.isMyTurn ? 0x22c55e : 0x9ca3af
}