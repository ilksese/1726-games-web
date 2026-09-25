const roomCode = parseRoomCode()
const storageKey = roomCode ? `@games/server/name/${roomCode}` : ""

const elements = {
  heroRoomCode: document.querySelector("#heroRoomCode"),
  connectionBadge: document.querySelector("#connectionBadge"),
  connectionText: document.querySelector("#connectionText"),
  inviteRoomCode: document.querySelector("#inviteRoomCode"),
  inviteLink: document.querySelector("#inviteLink"),
  inviteAddresses: document.querySelector("#inviteAddresses"),
  mdnsLink: document.querySelector("#mdnsLink"),
  ipLink: document.querySelector("#ipLink"),
  fatalView: document.querySelector("#fatalView"),
  fatalMessage: document.querySelector("#fatalMessage"),
  joinView: document.querySelector("#joinView"),
  joinForm: document.querySelector("#joinForm"),
  joinName: document.querySelector("#joinName"),
  joinButton: document.querySelector("#joinButton"),
  joinError: document.querySelector("#joinError"),
  roomView: document.querySelector("#roomView"),
  qrImage: document.querySelector("#qrImage"),
  copyButton: document.querySelector("#copyButton"),
  shareButton: document.querySelector("#shareButton"),
  playerCount: document.querySelector("#playerCount"),
  playerList: document.querySelector("#playerList"),
  configPanel: document.querySelector("#configPanel"),
  configForm: document.querySelector("#configForm"),
  configTotal: document.querySelector("#configTotal"),
  configDrinks: document.querySelector("#configDrinks"),
  configSaveButton: document.querySelector("#configSaveButton"),
  configHint: document.querySelector("#configHint"),
  renameInput: document.querySelector("#renameInput"),
  startHint: document.querySelector("#startHint"),
  startButton: document.querySelector("#startButton"),
  leaveButton: document.querySelector("#leaveButton"),
  gameSelectView: document.querySelector("#gameSelectView"),
  whoDrinksOption: document.querySelector("#whoDrinksOption"),
  wanxiangOption: document.querySelector("#wanxiangOption"),
  gameSelectHint: document.querySelector("#gameSelectHint"),
  cancelStartButton: document.querySelector("#cancelStartButton"),
  startedView: document.querySelector("#startedView"),
  startedMessage: document.querySelector("#startedMessage"),
  startedPlayers: document.querySelector("#startedPlayers"),
  enterGameButton: document.querySelector("#enterGameButton"),
  finishedView: document.querySelector("#finishedView"),
  finishedMessage: document.querySelector("#finishedMessage"),
  reopenButton: document.querySelector("#reopenButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmProgressText: document.querySelector("#confirmProgressText"),
  confirmProgressBar: document.querySelector("#confirmProgressBar"),
  confirmActions: document.querySelector("#confirmActions"),
  confirmedWaiting: document.querySelector("#confirmedWaiting"),
  declineButton: document.querySelector("#declineButton"),
  agreeButton: document.querySelector("#agreeButton"),
  toast: document.querySelector("#toast"),
}

let currentPlayerName = ""
let currentPlayerKey = ""
let currentState = null
let inviteURL = window.location.href.split(/[?#]/)[0]
let inviteLinks = { primary: inviteURL, ip: "", mdns: "" }
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

  elements.configForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const total = Number(elements.configTotal.value)
    const drinks = Number(elements.configDrinks.value)
    try {
      const data = await api("config", { total, drinks })
      applyState(data.state)
      showToast("游戏配置已保存")
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

  elements.cancelStartButton.addEventListener("click", async () => {
    setButtonBusy(elements.cancelStartButton, true, "取消中…")
    try {
      const data = await api("cancel-start")
      applyState(data.state)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      setButtonBusy(elements.cancelStartButton, false)
    }
  })

  elements.whoDrinksOption.addEventListener("click", async () => {
    setButtonBusy(elements.whoDrinksOption, true, "准备游戏…")
    try {
      const data = await api("select-game", { gameId: "who-drinks" })
      applyState(data.state)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      setButtonBusy(elements.whoDrinksOption, false)
    }
  })

  elements.wanxiangOption.addEventListener("click", async () => {
    setButtonBusy(elements.wanxiangOption, true, "准备游戏…")
    try {
      const data = await api("select-game", { gameId: "wanxiang-mahjong" })
      applyState(data.state)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      setButtonBusy(elements.wanxiangOption, false)
    }
  })

  elements.agreeButton.addEventListener("click", () => respondToConfirmation(true))
  elements.declineButton.addEventListener("click", () => respondToConfirmation(false))

  elements.leaveButton.addEventListener("click", async () => {
    if (!window.confirm("确定离开当前房间吗？")) return
    try {
      await api("leave")
    } catch (error) {
      if (error.code !== "UNAUTHORIZED") {
        showToast(error.message, true)
        return
      }
    }
    clearSeat()
    closeEvents()
    currentState = null
    currentPlayerName = ""
    currentPlayerKey = ""
    showJoinView()
    setConnection("idle", "尚未加入")
  })

  elements.enterGameButton.addEventListener("click", enterConfiguredGame)
  elements.reopenButton.addEventListener("click", async () => {
    setButtonBusy(elements.reopenButton, true, "重新开启中…")
    try {
      const data = await api("reopen")
      applyState(data.state)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      setButtonBusy(elements.reopenButton, false)
    }
  })
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

  const remembered = readSeat()
  if (remembered.name) {
    elements.joinName.value = remembered.name
    elements.renameInput.textContent = remembered.name
  }

  try {
    const data = await apiBase("")
    setInviteInfo(data)
    currentState = data.state
  } catch (error) {
    showFatal(error.message)
    return
  }

  if (remembered.name && remembered.key) {
    await join(remembered.name, { silent: true, key: remembered.key })
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
    const data = await api("join", { name: cleanName, key: options.key || "" })
    currentPlayerName = data.name
    currentPlayerKey = data.key
    setInviteInfo(data)
    rememberSeat(data.name, data.key)
    elements.renameInput.textContent = data.name
    applyState(data.state)
    connectEvents()
  } catch (error) {
    if (options.silent) {
      clearSeat()
      currentPlayerName = ""
      currentPlayerKey = ""
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
  const eventsURL = new URL(`/api/rooms/${encodeURIComponent(roomCode)}/events`, window.location.href)
  eventsURL.searchParams.set("name", currentPlayerName)
  eventsURL.searchParams.set("key", currentPlayerKey)
  eventSource = new EventSource(eventsURL)

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
  const remembered = readSeat()
  if (!remembered.name || !remembered.key) return

  recoveringSession = true
  closeEvents()
  await sleep(900)
  try {
    const data = await api("join", { name: remembered.name, key: remembered.key })
    currentPlayerName = data.name
    currentPlayerKey = data.key
    setInviteInfo(data)
    rememberSeat(data.name, data.key)
    applyState(data.state)
    connectEvents()
  } catch (error) {
    if (["UNAUTHORIZED", "NAME_TAKEN", "ROOM_LOCKED", "ROOM_FULL"].includes(error.code)) {
      clearSeat()
      currentPlayerName = ""
      currentPlayerKey = ""
      showJoinView()
      setConnection("idle", "请重新加入")
      elements.joinError.textContent = error.message
      recoveringSession = false
      return
    }
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
  if (currentState && state.revision < currentState.revision) return
  currentState = state
  elements.heroRoomCode.textContent = state.code
  elements.inviteRoomCode.textContent = state.code

  const self = state.players.find((player) => player.name === currentPlayerName)
  if (!self) {
    if (currentPlayerName) {
      clearSeat()
      currentPlayerName = ""
      currentPlayerKey = ""
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
  renderConfig(state, self)
  renderConfirmation(state, self)
  renderGameSelect(state, self)

  if (state.phase === "started") {
    showStartedView(state)
  } else if (state.phase === "finished") {
    showFinishedView(state, self)
  } else {
    showRoomView(state.phase === "game-select")
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
    if (player.name === currentPlayerName) item.classList.add("player-item--self")

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

    if (player.name === currentPlayerName) {
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
    if (currentState?.phase === "confirming" || currentState?.phase === "game-select") {
      confirmation.textContent = player.confirmed ? "已同意" : "待确认"
    } else if (currentState?.phase === "started" || currentState?.phase === "finished") {
      confirmation.textContent = player.confirmed ? "已准备" : "未确认"
    } else {
      confirmation.textContent = player.connected ? "已入队" : "离线"
    }

    item.append(avatar, main, confirmation)
    elements.playerList.append(item)
  }
}

function renderControls(state, self) {
  elements.renameInput.textContent = self.name
  const offlinePlayers = state.players.filter((player) => !player.connected)
  const canStart = self.captain && state.phase === "waiting" && state.players.length >= 2 && offlinePlayers.length === 0

  elements.startButton.hidden = !self.captain || state.phase !== "waiting"
  elements.startButton.disabled = !canStart

  if (state.phase === "confirming") {
    elements.startHint.textContent = "已发起确认，等待所有玩家选择。"
  } else if (state.phase === "game-select") {
    elements.startHint.textContent = self.captain ? "全员已同意，请选择本局游戏。" : "全员已同意，等待队长选择游戏。"
  } else if (state.phase === "started") {
    elements.startHint.textContent = "游戏已开始，正在同步所有玩家。"
  } else if (state.phase === "finished") {
    elements.startHint.textContent = self.captain ? "本局已结束，可以重新开启房间。" : "本局已结束，等待队长重新开启房间。"
  } else if (!self.captain) {
    const captain = state.players.find((player) => player.captain)
    elements.startHint.textContent = captain ? `等待队长 ${captain.name} 发起开局确认。` : "等待系统选出队长。"
  } else if (state.players.length < 2) {
    elements.startHint.textContent = "至少需要 2 名玩家才能发起开局确认。"
  } else if (offlinePlayers.length > 0) {
    elements.startHint.textContent = "有玩家离线，需等待其重连或自动离开后才能开局。"
  } else {
    elements.startHint.textContent = "你是队长。保存配置后，发起全员开局确认。"
  }
}

function renderConfig(state, self) {
  const isWaiting = state.phase === "waiting"
  const isCaptain = self.captain
  elements.configPanel.hidden = !isWaiting
  elements.configTotal.value = state.config?.total ?? 12
  elements.configDrinks.value = state.config?.drinks ?? 3
  elements.configTotal.disabled = !isCaptain
  elements.configDrinks.disabled = !isCaptain
  elements.configSaveButton.disabled = !isCaptain
  elements.configHint.textContent = isCaptain ? "调整配置后，所有玩家会看到最新设置。" : "只有队长可以修改谁喝酒的配置。"
}

function renderGameSelect(state, self) {
  const selecting = state.phase === "game-select"
  elements.gameSelectView.hidden = !selecting
  if (!selecting) return

  const option = state.availableGames?.find((game) => game.id === "who-drinks")
  elements.whoDrinksOption.disabled = !self.captain || !option
  const wanxiang = state.availableGames?.find((game) => game.id === "wanxiang-mahjong")
  if (elements.wanxiangOption) elements.wanxiangOption.disabled = !self.captain || !wanxiang
  elements.gameSelectHint.textContent = self.captain
    ? "选择后所有玩家会进入同一个谁喝酒牌局。"
    : "等待队长选择谁喝酒。"
  elements.cancelStartButton.hidden = !self.captain
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

function showRoomView(gameSelectVisible = false) {
  elements.joinView.hidden = true
  elements.roomView.hidden = false
  elements.gameSelectView.hidden = !gameSelectVisible
  elements.startedView.hidden = true
  elements.finishedView.hidden = true
  redirectTarget = ""
  if (redirectTimer) window.clearTimeout(redirectTimer)
  redirectTimer = null
}

function showStartedView(state) {
  if (elements.confirmDialog.open) elements.confirmDialog.close()
  elements.joinView.hidden = true
  elements.roomView.hidden = true
  elements.gameSelectView.hidden = true
  elements.startedView.hidden = false
  elements.finishedView.hidden = true
  elements.startedPlayers.replaceChildren()

  for (const player of state.players) {
    const chip = document.createElement("span")
    chip.className = "started-player"
    chip.textContent = `${player.confirmed ? "✓" : "·"} ${player.name}`
    elements.startedPlayers.append(chip)
  }

  if (state.gameUrl) {
    const gameName = state.selectedGame?.name || "游戏"
    elements.startedMessage.textContent = `所有玩家已确认，正在进入${gameName}…`
    elements.enterGameButton.hidden = false
    if (redirectTarget !== state.gameUrl) {
      redirectTarget = state.gameUrl
      redirectTimer = window.setTimeout(enterConfiguredGame, 1200)
    }
  } else {
    elements.startedMessage.textContent = "游戏已开始，但暂未配置游戏前端地址。"
    elements.enterGameButton.hidden = true
  }
}

function showFinishedView(state, self) {
  if (elements.confirmDialog.open) elements.confirmDialog.close()
  elements.joinView.hidden = true
  elements.roomView.hidden = false
  elements.gameSelectView.hidden = true
  elements.startedView.hidden = true
  elements.finishedView.hidden = false
  elements.finishedMessage.textContent = self.captain
    ? "本局已经结束，你可以重新开启房间，让队伍开始下一局。"
    : "本局已经结束，等待队长重新开启房间。"
  elements.reopenButton.hidden = !self.captain
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
  const gameURL = new URL(resolveGameURL(currentState.gameUrl), window.location.href)
  if (currentPlayerName) gameURL.searchParams.set("name", currentPlayerName)
  if (currentPlayerKey) gameURL.searchParams.set("key", currentPlayerKey)
  window.location.assign(gameURL.toString())
}

function resolveGameURL(value) {
  try {
    const gameURL = new URL(value, window.location.href)
    const knownHosts = new Set(
      [inviteLinks.primary, inviteLinks.ip, inviteLinks.mdns]
        .filter(Boolean)
        .map((link) => new URL(link).hostname),
    )
    if (knownHosts.has(gameURL.hostname)) {
      gameURL.hostname = window.location.hostname
    }

    const serverValue = gameURL.searchParams.get("server")
    if (serverValue) {
      const serverURL = new URL(serverValue)
      if (knownHosts.has(serverURL.hostname)) {
        gameURL.searchParams.set("server", window.location.origin)
      }
    }
    return gameURL.toString()
  } catch {
    return value
  }
}

function showJoinView() {
  if (elements.confirmDialog.open) elements.confirmDialog.close()
  elements.fatalView.hidden = true
  elements.roomView.hidden = true
  elements.gameSelectView.hidden = true
  elements.startedView.hidden = true
  elements.finishedView.hidden = true
  elements.joinView.hidden = false
  window.setTimeout(() => elements.joinName.focus(), 0)
}

function showFatal(message) {
  closeEvents()
  elements.joinView.hidden = true
  elements.roomView.hidden = true
  elements.gameSelectView.hidden = true
  elements.startedView.hidden = true
  elements.finishedView.hidden = true
  elements.fatalView.hidden = false
  elements.fatalMessage.textContent = message
  setConnection("reconnecting", "连接失败")
}

function setInviteInfo(data) {
  if (!data) return
  if (data.invites) {
    inviteLinks = {
      primary: data.invites.primary || data.inviteUrl || inviteURL,
      ip: data.invites.ip || "",
      mdns: data.invites.mdns || "",
    }
  } else if (data.inviteUrl) {
    inviteLinks.primary = data.inviteUrl
  }
  inviteURL = data.inviteUrl || inviteLinks.primary || inviteURL
  elements.inviteLink.value = inviteURL
  renderAddressLink(elements.mdnsLink, inviteLinks.mdns, "mDNS 地址")
  renderAddressLink(elements.ipLink, inviteLinks.ip, "IP 备用地址")
  elements.inviteAddresses.hidden = !inviteLinks.mdns && !inviteLinks.ip
}

function renderAddressLink(element, value, label) {
  if (!value) {
    element.hidden = true
    element.removeAttribute("href")
    return
  }
  element.hidden = false
  element.href = value
  element.textContent = `${label}：${value.replace(/^https?:\/\//, "")}`
}

function setConnection(kind, text) {
  elements.connectionBadge.className = `connection connection--${kind}`
  elements.connectionText.textContent = text
}

function rememberSeat(name, key) {
  currentPlayerName = name
  currentPlayerKey = key
  try {
    localStorage.setItem(storageKey, JSON.stringify({ name, key }))
  } catch {
    // Private browsing can disable storage. The in-memory seat still works for this page.
  }
}

function readSeat() {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return { name: "", key: "" }
    if (value.startsWith("{")) return JSON.parse(value)
    return { name: value, key: "" }
  } catch {
    return { name: "", key: "" }
  }
}

function clearSeat() {
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
  const endpoint = new URL(`/api/rooms/${encodeURIComponent(roomCode)}${suffix}`, window.location.origin)
  if (currentPlayerName) endpoint.searchParams.set("name", currentPlayerName)
  if (currentPlayerKey) endpoint.searchParams.set("key", currentPlayerKey)
  const response = await fetch(endpoint, {
    method: body === undefined ? (suffix ? "POST" : "GET") : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error?.message || `请求失败（${response.status}）`)
    error.code = data.error?.code || ""
    throw error
  }
  return data
}

function setButtonBusy(button, busy, text = "") {
  if (!button.dataset.content) button.dataset.content = button.innerHTML
  button.disabled = busy
  if (busy) button.textContent = text
  else button.innerHTML = button.dataset.content
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
