import { getGame, recordPlay } from '@games/shared'
import { GameEngine } from './game/engine.js'
import { validateSecret } from './game/validate.js'
import { createKeypad } from './ui/keypad.js'
import { createGuessInput } from './ui/guess-input.js'
import { createFeedbackToast } from './ui/feedback-toast.js'
import { createHistoryModal } from './ui/history-modal.js'
import { createRoleSelectScreen } from './ui/screens/role-select.js'
import { createExchangeScreen } from './ui/screens/exchange.js'
import { createSetupScreen } from './ui/screens/setup.js'
import { createPlayScreen } from './ui/screens/play.js'
import { createResultScreen } from './ui/screens/result.js'

function init() {
  getGame('number-detective')
  recordPlay('number-detective')

  const root = document.getElementById('app')
  let pc = null
  let channel = null
  let isHost = false
  let engine = null
  let currentScreen = null
  let exchangeScreen = null
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

  function send(data) {
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(data))
    }
  }

  function cleanConnection() {
    channel?.close()
    pc?.close()
    channel = null
    pc = null
    exchangeScreen?.destroy()
    exchangeScreen = null
  }

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
    cleanConnection()
    switchScreen(createRoleSelectScreen({
      onCreate: () => goToExchange('host'),
      onJoin: () => goToExchange('guest'),
      error,
    }))
  }

  function goToExchange(mode) {
    cleanConnection()

    let encodedOffer = null
    // Check if entered via invite link (#s=<offer> or #r=<answer>)
    const hash = location.hash
    if (hash.startsWith('#s=')) {
      encodedOffer = decodeURIComponent(hash.slice(3))
      mode = 'guest'
    }

    exchangeScreen = createExchangeScreen({
      mode,
      encodedOffer,
      onConnected: ({ pc: peerConn, channel: dataChannel }) => {
        pc = peerConn
        channel = dataChannel
        isHost = mode === 'host'
        exchangeScreen?.destroy()
        exchangeScreen = null
        goToSetup()
      },
      onBack: () => goToRoleSelect(),
    })
    switchScreen(exchangeScreen.element)
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
          send({ type: 'secret-ready' })
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
              send({ type: 'secret-ready' })
              renderSetup()
              tryStartGame()
            }
          }
        })
      }
    }

    renderSetup()
  }

  function handleGameMessage(msg) {
    if (msg.type === 'secret-ready') {
      oppReady = true
      if (!myReady && renderSetup) {
        renderSetup()
      }
      tryStartGame()
    }

    if (msg.type === 'guess' && engine) {
      const response = engine.processOppGuess(msg.guess)
      send(response)
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

    // Forward disconnect to maintenance check
    // (connectionstatechange handles this separately)
  }

  function tryStartGame() {
    if (myReady && oppReady && !engine) {
      engine = new GameEngine(secret, isHost)
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
          send(result)
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

    // Bind disconnect detection
    channel.onclose = () => {
      if (!engine?.isOver) {
        engine = null
        goToRoleSelect('连接已断开')
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (!engine?.isOver) {
          engine = null
          goToRoleSelect('连接已断开')
        }
      }
    }
    // Bind data handler
    channel.onmessage = (e) => handleGameMessage(JSON.parse(e.data))

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
        send({ type: 'rematch' })
        engine = null
        goToSetup()
      },
      onLeave: () => {
        cleanConnection()
        window.location.href = '/'
      },
    }))
  }

  goToRoleSelect()
}

init()