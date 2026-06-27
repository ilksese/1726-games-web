import { getGame, recordPlay } from '@games/shared'
import { Connection } from './net/connection.js'
import { GameEngine } from './game/engine.js'
import { validateSecret } from './game/validate.js'
import { createKeypad } from './ui/keypad.js'
import { createGuessInput } from './ui/guess-input.js'
import { createFeedbackToast } from './ui/feedback-toast.js'
import { createHistoryModal } from './ui/history-modal.js'
import { createRoleSelectScreen } from './ui/screens/role-select.js'
import { createCreateRoomScreen } from './ui/screens/create-room.js'
import { createJoinRoomScreen } from './ui/screens/join-room.js'
import { createSetupScreen } from './ui/screens/setup.js'
import { createPlayScreen } from './ui/screens/play.js'
import { createResultScreen } from './ui/screens/result.js'

function init() {
  getGame('number-detective')
  recordPlay('number-detective')

  const root = document.getElementById('app')
  const conn = new Connection()
  let engine = null
  let currentScreen = null
  let secret = ''
  let oppReady = false
  let myReady = false
  let guessInput
  let keypad
  let historyModal
  let toast
  let playScreen = null
  let renderSetup = null
  let keydownHandler = null
  let overlayEls = []

  function switchScreen(el) {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
    }
    if (currentScreen) {
      root.removeChild(currentScreen)
    }
    overlayEls.forEach((e) => { if (e.parentNode) e.parentNode.removeChild(e) })
    overlayEls = []
    currentScreen = el
    root.appendChild(el)
  }

  function attachKeydown(handler) {
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
    keydownHandler = handler
    document.addEventListener('keydown', keydownHandler)
  }

  function goToRoleSelect(error) {
    switchScreen(createRoleSelectScreen({
      onCreate: () => goToCreateRoom(),
      onJoin: () => goToJoinRoom(),
      error,
    }))
  }

  async function goToCreateRoom() {
    try {
      const code = await conn.createRoom()
      switchScreen(createCreateRoomScreen({
        code,
        onBack: () => { conn.close(); goToRoleSelect() },
      }))
      conn.on('ready', () => { goToSetup() })
      conn.on('disconnect', () => {
        goToRoleSelect('连接已断开')
      })
      await conn.startGame()
    } catch (e) {
      conn.close()
      goToRoleSelect(e.message)
    }
  }

  function goToJoinRoom(error) {
    switchScreen(createJoinRoomScreen({
      onJoin: async (code) => {
        try {
          await conn.joinRoom(code)
          conn.on('ready', () => goToSetup())
          await conn.startGame()
        } catch (e) {
          goToJoinRoom(e.message)
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
      const screen = createSetupScreen({
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
      })
      switchScreen(screen)

      if (!myReady) {
        attachKeydown((e) => {
          if (e.key >= '0' && e.key <= '9') {
            if (secret.length < 4) { secret += e.key; renderSetup() }
          } else if (e.key === 'Backspace') {
            secret = secret.slice(0, -1); renderSetup()
          } else if (e.key === 'Enter') {
            const err = validateSecret(secret)
            if (!err) {
              myReady = true
              conn.send({ type: 'secret-ready' })
              renderSetup()
              tryStartGame()
            }
          }
        })
      }
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
        toast?.show('对方猜对了', 'lose')
        setTimeout(() => goToResult(engine.won), 800)
      } else {
        updatePlayUI()
      }
    }

    if (msg.type === 'feedback' && engine) {
      engine.processFeedback(msg)
      const last = engine.myGuesses[engine.myGuesses.length - 1]
      if (last) {
        const kind = msg.win ? 'win'
          : msg.matchPoint ? 'match'
            : msg.binary === false ? 'lose'
              : 'info'
        toast?.show(last.resultText, kind)
      }
      if (engine.isOver) {
        setTimeout(() => goToResult(engine.won), 800)
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
    historyModal = createHistoryModal()
    toast = createFeedbackToast()

    function handleDigit(d) {
      if (engine && engine.isMyTurn && !engine.isOver) {
        const digits = guessInput.digits || ''
        if (digits.length < 4) {
          guessInput.digits = digits + d
          guessInput.setValue(guessInput.digits)
        }
      }
    }
    function handleClear() {
      if (engine && engine.isMyTurn) {
        guessInput.digits = (guessInput.digits || '').slice(0, -1)
        guessInput.setValue(guessInput.digits || '')
      }
    }
    function handleConfirm() {
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

    keypad = createKeypad({
      onDigit: handleDigit,
      onClear: handleClear,
      onConfirm: handleConfirm,
    })

    guessInput.digits = ''
    guessInput.setValue('')

    playScreen = createPlayScreen({ guessInput, keypad, historyModal })
    switchScreen(playScreen.element)
    root.appendChild(historyModal.element)
    root.appendChild(toast.element)
    overlayEls.push(historyModal.element, toast.element)

    attachKeydown((e) => {
      if (e.key >= '0' && e.key <= '9') { handleDigit(e.key) }
      else if (e.key === 'Backspace') { handleClear() }
      else if (e.key === 'Enter') { handleConfirm() }
    })

    updatePlayUI()
  }

  function updatePlayUI() {
    if (!engine || !historyModal || !playScreen) return
    historyModal.setMyEntries(engine.myGuesses)
    historyModal.setOppEntries(engine.oppGuesses)
    playScreen.updateTurn(engine)
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

init()
