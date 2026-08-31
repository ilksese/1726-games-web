const roomCode = parseRoomCode()
const storageKey = roomCode ? `@games/server/player/${roomCode}` : ""

const elements = {
  heroRoomCode: document.querySelector("#heroRoomCode"),
  connectionBadge: document.querySelector("#connectionBadge"),
  connectionText: document.querySelector("#connectionText"),
  inviteRoomCode: document.querySelector("#inviteRoomCode"),
  fatalView: document.querySelector("#fatalView"),
  fatalMessage: document.querySelector("#fatalMessage"),
  joinView: document.querySelector("#joinView"),
  joinForm: document.querySelector("#joinForm"),
  joinName: document.querySelector("#joinName"),
  joinButton: document.querySelector("#joinButton"),
  joinError: document.querySelector("#joinError"),
  roomView: document.querySelector("#roomView"),
  qrImage: document.querySelector("#qrImage"),
  inviteLink: document.querySelector("#inviteLink"),
  copyButton: document.querySelector("#copyButton"),
  shareButton: document.querySelector("#shareButton"),
  playerCount: document.querySelector("#playerCount"),
  playerList: document.querySelector("#playerList"),
  renameForm: document.querySelector("#renameForm"),
  renameInput: document.querySelector("#renameInput"),
  startHint: document.querySelector("#startHint"),
  startButton: document.querySelector("#startButton"),
  leaveButton: document.querySelector("#leaveButton"),
  startedView: document.querySelector("#startedView"),
  startedMessage: document.querySelector("#startedMessage"),
  startedPlayers: document.querySelector("#startedPlayers"),
  enterGameButton: document.querySelector("#enterGameButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmProgressText: document.querySelector("#confirmProgressText"),
  confirmProgressBar: document.querySelector("#confirmProgressBar"),
  confirmActions: document.querySelector("#confirmActions"),
  confirmedWaiting: document.querySelector("#confirmedWaiting"),
  declineButton: document.querySelector("#declineButton"),
  agreeButton: document.querySelector("#agreeButton"),
  toast: document.querySelector("#toast"),
}

let currentPlayerID = ""
let currentState = null
let inviteURL = window.location.href.split(/[?#]/)[0]
let eventSource = null
let streamErrorCount = 0
let recoveringSession = false
let toastTimer = null
let lastMessageKey = ""
let redirectTarget = ""
let redirectTimer = null

bindEvents()
bootstrap()

function parseRoomCode() {
  const match = window.location.pathname.match(/^\/room\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ""
}

function bindEvents() {
  elements.joinForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    await join(elements.joinName.value)
  })

  elements.renameForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const name = elements.renameInput.value.trim()
    if (!name) return
    try {
      const data = await api("join", { name })
      rememberPlayer(data.playerId, name)
      applyState(data.state)
      showToast("昵称已更新")
    } catch (error) {
      showToast(error.message, true)
    }
  })

  elements.copyButton.addEventListener("click", async () => {
    const copied = await copyText(inviteURL)
    showToast(copied ? "邀请链接已复制" : "复制失败，请手动选择链接", !copied)
  })

  elements.shareButton.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `1726 游戏房间 ${roomCode}`,
          text: "加入我的局域网组队房间",
          url: inviteURL,
        })
        return
      } catch (error) {
        if (error.name === "AbortError") return
      }
    }
    const copied = await copyText(inviteURL)
    showToast(copied ? "邀请链接已复制，可以发给队友了" : "分享失败", !copied)
  })

  elements.startButton.addEventListener("click", async () => {
    setButtonBusy(elements.startButton, true, "正在通知全员…")
    try {
      const data = await api("start")
      applyState(data.state)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      setButtonBusy(elements.startButton, false)
    }
  })

  elements.agreeButton.addEventListener("click", () => respondToConfirmation(true))
  elements.declineButton.addEventListener("click", () => respondToConfirmation(false))

  elements.leaveButton.addEventListener("click", async () => {
    if (!window.confirm("确定离开当前房间吗？")) return
    try {
      await api("leave")
    } catch (error) {
      if (!String(error.message).includes("会话")) {
        showToast(error.message, true)
        return
      }
    }
    clearPlayer()
    closeEvents()
    currentState = null
    currentPlayerID = ""
    showJoinView()
    setConnection("idle", "尚未加入")
  })

  elements.enterGameButton.addEventListener("click", enterConfiguredGame)
  elements.confirmDialog.addEventListener("cancel", (event) => event.preventDefault())
}

async function bootstrap() {
  if (!roomCode) {
    showFatal("房间链接缺少有效的房间号。")
    return
  }

  elements.heroRoomCode.textContent = roomCode
  elements.inviteRoomCode.textContent = roomCode
  elements.qrImage.src = `/api/rooms/${encodeURIComponent(roomCode)}/qr`
  elements.joinView.hidden = false
  setConnection("idle", "读取房间")

  const remembered = readPlayer()
  if (remembered?.name) {
    elements.joinName.value = remembered.name
    elements.renameInput.value = remembered.name
  }

  try {
    const data = await apiBase("")
    setInviteURL(data.inviteUrl)
    currentState = data.state
  } catch (error) {
    showFatal(error.message)
    return
  }

  if (remembered?.playerId && remembered?.name) {
    await join(remembered.name, { silent: true })
  } else {
    showJoinView()
    setConnection("idle", "等待加入")
  }
}

async function join(name, options = {}) {
  const cleanName = name.trim()
  elements.joinError.textContent = ""
  if (!cleanName) {
    elements.joinError.textContent = "请输入玩家昵称"
    return
  }

  setButtonBusy(elements.joinButton, true, "加入中…")
  try {
    const data = await api("join", { name: cleanName })
    currentPlayerID = data.playerId
    setInviteURL(data.inviteUrl)
    rememberPlayer(data.playerId, cleanName)
    elements.renameInput.value = cleanName
    applyState(data.state)
    connectEvents()
  } catch (error) {
    if (options.silent) {
      clearPlayer()
      showJoinView()
    }
    elements.joinError.textContent = error.message
    setConnection("reconnecting", "加入失败")
  } finally {
    setButtonBusy(elements.joinButton, false)
  }
}

function connectEvents() {
  closeEvents()
  setConnection("reconnecting", "连接房间")
  eventSource = new EventSource(`/api/rooms/${encodeURIComponent(roomCode)}/events`)

  eventSource.onopen = () => {
    streamErrorCount = 0
    setConnection("online", "实时同步中")
  }

  eventSource.onmessage = (event) => {
    streamErrorCount = 0
    try {
      const payload = JSON.parse(event.data)
      applyState(payload.state)
      if (payload.message) {
        const messageKey = `${payload.state.revision}:${payload.type}:${payload.message}`
        if (messageKey !== lastMessageKey) {
          lastMessageKey = messageKey
          showToast(payload.message)
        }
      }
    } catch {
      showToast("收到无法识别的房间消息", true)
    }
  }

  eventSource.onerror = () => {
    streamErrorCount += 1
    setConnection("reconnecting", "正在重连")
    if (streamErrorCount >= 2) recoverSession()
  }
}

async function recoverSession() {
  if (recoveringSession) return
  const remembered = readPlayer()
  if (!remembered?.name) return

  recoveringSession = true
  closeEvents()
  await sleep(900)
  try {
    const data = await api("join", { name: remembered.name })
    currentPlayerID = data.playerId
    rememberPlayer(data.playerId, remembered.name)
    setInviteURL(data.inviteUrl)
    applyState(data.state)
    connectEvents()
  } catch (error) {
    setConnection("reconnecting", "等待服务器")
    showToast(error.message, true)
    window.setTimeout(() => {
      recoveringSession = false
      recoverSession()
    }, 2200)
    return
  }
  recoveringSession = false
}

function closeEvents() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function applyState(state) {
  if (!state) return
  currentState = state
  elements.heroRoomCode.textContent = state.code
  elements.inviteRoomCode.textContent = state.code

  const self = state.players.find((player) => player.id === currentPlayerID)
  if (!self) {
    if (currentPlayerID) {
      clearPlayer()
      currentPlayerID = ""
      closeEvents()
      showToast("当前会话已离开房间，请重新加入", true)
    }
    showJoinView()
    return
  }

  elements.joinView.hidden = true
  elements.fatalView.hidden = true
  renderPlayers(state.players)
  renderControls(state, self)
  renderConfirmation(state, self)

  if (state.phase === "started") {
    showStartedView(state)
  } else {
    elements.roomView.hidden = false
    elements.startedView.hidden = true
    redirectTarget = ""
    if (redirectTimer) window.clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

function renderPlayers(players) {
  elements.playerList.replaceChildren()
  elements.playerCount.textContent = `${players.length} 人`

  if (players.length === 0) {
    const empty = document.createElement("li")
    empty.className = "empty-team"
    empty.textContent = "还没有玩家加入"
    elements.playerList.append(empty)
    return
  }

  for (const player of players) {
    const item = document.createElement("li")
    item.className = "player-item"
    if (player.id === currentPlayerID) item.classList.add("player-item--self")

    const avatar = document.createElement("span")
    avatar.className = "player-avatar"
    avatar.textContent = Array.from(player.name)[0] || "玩"

    const main = document.createElement("div")
    main.className = "player-main"

    const nameLine = document.createElement("div")
    nameLine.className = "player-name-line"
    const name = document.createElement("span")
    name.className = "player-name"
    name.textContent = player.name
    nameLine.append(name)

    if (player.id === currentPlayerID) {
      const selfTag = document.createElement("span")
      selfTag.className = "player-tag"
      selfTag.textContent = "我"
      nameLine.append(selfTag)
    }
    if (player.captain) {
      const captainTag = document.createElement("span")
      captainTag.className = "player-tag"
      captainTag.textContent = "队长"
      nameLine.append(captainTag)
    }

    const meta = document.createElement("div")
    meta.className = "player-meta"
    const dot = document.createElement("span")
    dot.className = `status-dot${player.connected ? " status-dot--online" : ""}`
    const status = document.createElement("span")
    status.textContent = player.connected ? "在线" : "离线，等待重连"
    meta.append(dot, status)
    main.append(nameLine, meta)

    const confirmation = document.createElement("span")
    confirmation.className = `confirm-state${player.confirmed ? " confirm-state--yes" : ""}`
    if (currentState?.phase === "confirming" || currentState?.phase === "started") {
      confirmation.textContent = player.confirmed ? "已同意" : "待确认"
    } else {
      confirmation.textContent = player.connected ? "已入队" : "离线"
    }

    item.append(avatar, main, confirmation)
    elements.playerList.append(item)
  }
}

function renderControls(state, self) {
  elements.renameInput.value = self.name
  const offlinePlayers = state.players.filter((player) => !player.connected)
  const canStart = self.captain && state.phase === "waiting" && offlinePlayers.length === 0

  elements.startButton.hidden = !self.captain || state.phase !== "waiting"
  elements.startButton.disabled = !canStart

  if (state.phase === "confirming") {
    elements.startHint.textContent = "已发起确认，等待所有玩家选择。"
  } else if (!self.captain) {
    const captain = state.players.find((player) => player.captain)
    elements.startHint.textContent = captain ? `等待队长 ${captain.name} 发起开局确认。` : "等待系统选出队长。"
  } else if (offlinePlayers.length > 0) {
    elements.startHint.textContent = "有玩家离线，需等待其重连或自动离开后才能开局。"
  } else {
    elements.startHint.textContent = "你是队长。点击按钮后，全员会同时收到确认弹窗。"
  }
}

function renderConfirmation(state, self) {
  if (state.phase !== "confirming") {
    if (elements.confirmDialog.open) elements.confirmDialog.close()
    return
  }

  const total = state.confirmation.total
  const accepted = state.confirmation.accepted
  elements.confirmProgressText.textContent = `${accepted} / ${total}`
  elements.confirmProgressBar.value = total ? accepted / total : 0
  elements.confirmActions.hidden = self.confirmed
  elements.confirmedWaiting.hidden = !self.confirmed

  if (!elements.confirmDialog.open) {
    elements.confirmDialog.showModal()
    if (!self.confirmed) elements.agreeButton.focus()
  }
}

function showStartedView(state) {
  if (elements.confirmDialog.open) elements.confirmDialog.close()
  elements.joinView.hidden = true
  elements.roomView.hidden = true
  elements.startedView.hidden = false
  elements.startedPlayers.replaceChildren()

  for (const player of state.players) {
    const chip = document.createElement("span")
    chip.className = "started-player"
    chip.textContent = `${player.confirmed ? "✓" : "·"} ${player.name}`
    elements.startedPlayers.append(chip)
  }

  if (state.gameUrl) {
    elements.startedMessage.textContent = "所有设备已同步确认，即将进入配置的游戏地址。"
    elements.enterGameButton.hidden = false
    if (redirectTarget !== state.gameUrl) {
      redirectTarget = state.gameUrl
      redirectTimer = window.setTimeout(enterConfiguredGame, 1800)
    }
  } else {
    elements.startedMessage.textContent = "所有设备已经同步进入游戏状态，局域网组队流程完成。"
    elements.enterGameButton.hidden = true
  }
}

async function respondToConfirmation(agree) {
  const button = agree ? elements.agreeButton : elements.declineButton
  setButtonBusy(button, true, agree ? "提交中…" : "取消中…")
  try {
    const data = await api("confirm", { agree })
    applyState(data.state)
  } catch (error) {
    showToast(error.message, true)
  } finally {
    setButtonBusy(button, false)
  }
}

function enterConfiguredGame() {
  if (!currentState?.gameUrl) return
  window.location.assign(currentState.gameUrl)
}

function showJoinView() {
  if (elements.confirmDialog.open) elements.confirmDialog.close()
  elements.fatalView.hidden = true
  elements.roomView.hidden = true
  elements.startedView.hidden = true
  elements.joinView.hidden = false
  window.setTimeout(() => elements.joinName.focus(), 0)
}

function showFatal(message) {
  closeEvents()
  elements.joinView.hidden = true
  elements.roomView.hidden = true
  elements.startedView.hidden = true
  elements.fatalView.hidden = false
  elements.fatalMessage.textContent = message
  setConnection("reconnecting", "连接失败")
}

function setInviteURL(url) {
  if (url) inviteURL = url
  elements.inviteLink.value = inviteURL
}

function setConnection(kind, text) {
  elements.connectionBadge.className = `connection connection--${kind}`
  elements.connectionText.textContent = text
}

function rememberPlayer(playerId, name) {
  currentPlayerID = playerId
  try {
    localStorage.setItem(storageKey, JSON.stringify({ playerId, name }))
  } catch {
    // Private browsing can disable storage; the HttpOnly session cookie still keeps the player connected.
  }
}

function readPlayer() {
  try {
    const value = localStorage.getItem(storageKey)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function clearPlayer() {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore unavailable storage.
  }
}

async function api(action, body) {
  const suffix = action ? `/${action}` : ""
  return apiBase(suffix, body)
}

async function apiBase(suffix, body) {
  const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}${suffix}`, {
    method: body === undefined ? (suffix ? "POST" : "GET") : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error?.message || `请求失败（${response.status}）`)
  }
  return data
}

function setButtonBusy(button, busy, text = "") {
  if (!button.dataset.label) button.dataset.label = button.textContent
  button.disabled = busy
  button.textContent = busy ? text : button.dataset.label
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // LAN pages commonly run on HTTP, where the Clipboard API may be unavailable.
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.className = "copy-helper"
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  return copied
}

function showToast(message, isError = false) {
  if (!message) return
  if (toastTimer) window.clearTimeout(toastTimer)
  elements.toast.textContent = message
  elements.toast.classList.toggle("toast--error", isError)
  elements.toast.hidden = false
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true
  }, 3200)
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
