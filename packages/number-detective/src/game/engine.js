import { validateGuess } from './validate.js'

export function computeFeedback(secret, guess) {
  let correctDigits = 0
  let correctPositions = 0
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) correctPositions++
    if (secret.includes(guess[i])) correctDigits++
  }
  return { correctDigits, correctPositions, isExact: correctPositions === 4 }
}

export class GameEngine {
  constructor(mySecret, isHost) {
    this.mySecret = mySecret
    this.isHost = isHost
    this.myGuesses = []
    this.oppGuesses = []
    this.myMatchPoint = false
    this.oppMatchPoint = false
    this.isMyTurn = isHost
    this.isOver = false
    this.won = null
  }

  processMyGuess(guess) {
    const err = validateGuess(guess)
    if (err) return { error: err }
    this.myGuesses.push({ guess, red: false, resultText: '等待反馈...' })
    this.isMyTurn = false
    return { type: 'guess', guess }
  }

  processOppGuess(guess) {
    const fb = computeFeedback(this.mySecret, guess)
    const entry = { guess, red: false, resultText: '' }

    let response

    if (fb.isExact) {
      entry.resultText = '对 ✓'
      response = { type: 'feedback', win: true }
      this.isOver = true
      this.won = false
    } else if (this.oppMatchPoint) {
      entry.resultText = '错 ✗'
      response = { type: 'feedback', binary: false }
    } else if (fb.correctDigits === 4) {
      this.oppMatchPoint = true
      entry.red = true
      entry.resultText = '赛点! 4位正确'
      response = { type: 'feedback', matchPoint: true, correctDigits: 4 }
      this.isOver = true
      this.won = false
    } else {
      entry.resultText = `${fb.correctDigits}位正确`
      response = { type: 'feedback', correctDigits: fb.correctDigits }
    }

    this.oppGuesses.push(entry)
    this.isMyTurn = true
    return response
  }

  processFeedback(feedback) {
    const last = this.myGuesses[this.myGuesses.length - 1]
    if (!last) return

    if (feedback.win) {
      last.resultText = '对 ✓'
      this.isOver = true
      this.won = true
    } else if (feedback.matchPoint) {
      this.myMatchPoint = true
      last.red = true
      last.resultText = '赛点! 4位正确'
      this.isOver = true
      this.won = true
    } else if (feedback.binary === false) {
      last.resultText = '错 ✗'
    } else {
      last.resultText = `${feedback.correctDigits}位正确`
    }
  }
}
