import { Application, Text } from 'pixi.js'
import { getGame, recordPlay } from '@games/shared'
import { Connection } from './net/connection.js'
import { GameEngine } from './game/engine.js'
import { validateSecret } from './game/validate.js'
import { createKeypad } from './ui/keypad.js'
import { createGuessInput } from './ui/guess-input.js'
import { createHistory } from './ui/history.js'
import { createRoleSelectScreen } from './ui/screens/role-select.js'
import { createCreateRoomScreen } from './ui/screens/create-room.js'
import { createJoinRoomScreen } from './ui/screens/join-room.js'
import { createSetupScreen } from './ui/screens/setup.js'
import { createPlayScreen, updatePlayTurn } from './ui/screens/play.js'
import { createResultScreen } from './ui/screens/result.js'

async function init() {
  const game = getGame('number-detective')
  recordPlay('number-detective')

  const app = new Application()
  await app.init({ width: 800, height: 600, background: 0x030712, antialias: true })

  document.getElementById('game-container').appendChild(app.canvas)

  const conn = new Connection()
  let engine = null
  let currentScreen = null
  let secret = ''
  let oppReady = false
  let myReady = false
  let guessInput
  let keypad
  let history
  let playContainer
  let turnText
  let renderSetup

  function switchScreen(screen) {
    if (currentScreen) {
      app.stage.removeChild(currentScreen)
    }
    currentScreen = screen
    if (screen) {
      app.stage.addChild(screen)
    }
  }

  function goToRoleSelect() {
    switchScreen(createRoleSelectScreen({
      onCreate: () => goToCreateRoom(),
      onJoin: () => goToJoinRoom(),
    }))
  }

  async function goToCreateRoom() {
    try {
      const code = await conn.createRoom()
      switchScreen(createCreateRoomScreen({
        code,
        onBack: () => { conn.close(); goToRoleSelect() },
      }))
      conn.on('ready', () => {
        goToSetup()
      })
      conn.on('disconnect', () => {
        if (currentScreen) {
          const err = new Text({
            text: '连接已断开',
            style: { fontSize: 20, fill: 0xff4444, fontFamily: 'system-ui' },
          })
          err.anchor.set(0.5)
          err.x = 400; err.y = 300
          currentScreen.addChild(err)
        }
      })
      await conn.startGame()
    } catch (e) {
      switchScreen(createRoleSelectScreen({
        onCreate: () => goToCreateRoom(),
        onJoin: () => goToJoinRoom(),
      }))
    }
  }

  async function goToJoinRoom() {
    switchScreen(createJoinRoomScreen({
      code: '',
      onJoin: async (code) => {
        try {
          await conn.joinRoom(code)
          conn.on('ready', () => goToSetup())
          await conn.startGame()
        } catch (e) {
          goToJoinRoomError(e.message)
        }
      },
      onBack: () => goToRoleSelect(),
    }))
  }

  function goToJoinRoomError(error) {
    switchScreen(createJoinRoomScreen({
      onJoin: async (code) => {
        try {
          await conn.joinRoom(code)
          conn.on('ready', () => goToSetup())
          await conn.startGame()
        } catch (e) {
          goToJoinRoomError(e.message)
        }
      },
      onBack: () => goToRoleSelect(),
      error,
    }))
  }

  function goToSetup() {
    secret = ''
    myReady = false
    oppReady = false

    renderSetup = function () {
      switchScreen(createSetupScreen({
        secret,
        ready: myReady,
        waiting: oppReady,
        onDigit: (d) => {
          if (secret.length < 4 && !myReady) {
            secret += d
            renderSetup()
          }
        },
        onClear: () => {
          if (!myReady) {
            secret = secret.slice(0, -1)
            renderSetup()
          }
        },
        onConfirm: () => {
          const err = validateSecret(secret)
          if (err) return
          myReady = true
          conn.send({ type: 'secret-ready' })
          renderSetup()
          tryStartGame()
        },
      }))
    }

    renderSetup()
  }

  conn.on('data', (msg) => {
    if (msg.type === 'secret-ready') {
      oppReady = true
      if (!myReady && renderSetup) {
        renderSetup()
      }
      tryStartGame()
    }

    if (msg.type === 'guess' && engine) {
      const response = engine.processOppGuess(msg.guess)
      conn.send(response)
      if (engine.isOver) {
        goToResult(engine.won)
      } else {
        updatePlayUI()
      }
    }

    if (msg.type === 'feedback' && engine) {
      engine.processFeedback(msg)
      if (engine.isOver) {
        goToResult(engine.won)
      } else {
        updatePlayUI()
      }
    }

    if (msg.type === 'rematch') {
      goToSetup()
    }
  })

  function tryStartGame() {
    if (myReady && oppReady && !engine) {
      engine = new GameEngine(secret, conn.isHost)
      goToPlay()
    }
  }

  function goToPlay() {
    guessInput = createGuessInput()
    keypad = createKeypad(
      (d) => {
        if (engine && engine.isMyTurn && !engine.isOver) {
          const digits = guessInput.digits || ''
          if (digits.length < 4) {
            guessInput.digits = (guessInput.digits || '') + d
            guessInput.setValue(guessInput.digits)
          }
        }
      },
      () => {
        if (engine && engine.isMyTurn) {
          guessInput.digits = (guessInput.digits || '').slice(0, -1)
          guessInput.setValue(guessInput.digits || '')
        }
      },
      () => {
        if (engine && engine.isMyTurn && (guessInput.digits || '').length === 4) {
          const guess = guessInput.digits
          guessInput.digits = ''
          guessInput.setValue('')
          const result = engine.processMyGuess(guess)
          if (result.type === 'guess') {
            conn.send(result)
            updatePlayUI()
          }
        }
      }
    )
    guessInput.digits = ''
    guessInput.setValue('')
    history = createHistory()

    playContainer = createPlayScreen({ engine, guessInput, keypad, history })
    switchScreen(playContainer)
    turnText = playContainer.turnText
    updatePlayUI()
  }

  function updatePlayUI() {
    if (!engine || !history || !playContainer) return
    history.setMyEntries(engine.myGuesses)
    history.setOppEntries(engine.oppGuesses)
    updatePlayTurn(playContainer, engine, turnText)
  }

  function goToResult(won) {
    engine.won = won
    switchScreen(createResultScreen({
      won,
      onRematch: () => {
        conn.send({ type: 'rematch' })
        engine = null
        goToSetup()
      },
      onLeave: () => {
        conn.close()
        window.location.href = '/'
      },
    }))
  }

  goToRoleSelect()
}

init().catch(err => {
  console.error(err)
  document.getElementById('game-container').innerHTML =
    '<p style="color:red;padding:2rem;">游戏加载失败，请刷新重试</p>'
})
