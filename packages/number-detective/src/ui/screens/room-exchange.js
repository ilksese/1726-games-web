import { createHostPeer, createGuestPeer, applyAnswer } from '../../net/signaling.js'
import { createRoom, pollAnswer, closeRoom, getOffer, submitAnswer, normalizeRoomCode } from '../../net/room-api.js'

export function createRoomExchangeScreen({ mode, onConnected, onBack }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--stack'

  let destroyed = false
  let roomCode = null
  let abortController = null
  let matched = false

  function destroy() {
    destroyed = true
    abortController?.abort()
    if (roomCode && !matched) closeRoom(roomCode).catch(() => {})
  }

  function showError(msg) {
    const el = wrap.querySelector('[data-error]')
    if (el) el.textContent = msg
  }

  if (mode === 'host-cloudflare') {
    renderHost()
  } else {
    renderGuest()
  }

  wrap.querySelector('[data-back]')?.addEventListener('click', () => {
    destroy()
    onBack()
  })

  return { element: wrap, destroy }

  function renderHost() {
    wrap.innerHTML = `
      <div>
        <h2 class="nd-screen-title">创建房间（Cloudflare）</h2>
        <p class="nd-screen-subtitle">把房间码告诉对手，对手输入后会自动连接</p>
      </div>
      <section class="nd-card nd-panel nd-stack text-center">
        <p class="text-sm text-slate-500">房间码</p>
        <div data-room-code class="min-h-[4rem] flex items-center justify-center text-4xl font-bold tracking-[0.35em] text-[#59d98a]">------</div>
        <p data-await class="nd-surface-note whitespace-pre-line">创建中...</p>
      </section>
      <p data-error class="text-center text-sm text-red-300"></p>
      <button data-back type="button" class="nd-btn nd-btn--ghost self-center">&larr; 返回</button>
    `

    createHostPeer().then(async ({ peer, signalData }) => {
      if (destroyed) { peer.destroy(); return }

      roomCode = await createRoom(signalData)
      if (destroyed) { peer.destroy(); return }

      wrap.querySelector('[data-room-code]').textContent = roomCode
      wrap.querySelector('[data-await]').textContent = '等待访客输入房间码...'

      abortController = new AbortController()
      const answerSdp = await pollAnswer(roomCode, { signal: abortController.signal })
      if (destroyed) { peer.destroy(); return }

      matched = true
      applyAnswer(peer, answerSdp)
      wrap.querySelector('[data-await]').textContent = '匹配成功，正在建立连接...'
      peer.on('connect', () => {
        if (!destroyed) onConnected({ peer })
      })
    }).catch((e) => {
      if (!destroyed) showError(e.message || '连接创建失败')
    })
  }

  function renderGuest() {
    wrap.innerHTML = `
      <div>
        <h2 class="nd-screen-title">加入房间（Cloudflare）</h2>
        <p class="nd-screen-subtitle">输入房主显示的 6 位房间码</p>
      </div>
      <section data-guest-init class="nd-card nd-panel nd-stack">
        <input data-room-input inputmode="numeric" maxlength="6" placeholder="例如 482913" class="nd-input text-center text-2xl tracking-[0.25em]" />
        <button data-join-room type="button" class="nd-btn nd-btn--primary w-full">加入房间</button>
      </section>
      <div data-await class="nd-surface-note text-center hidden">正在连接房主...</div>
      <p data-error class="text-center text-sm text-red-300"></p>
      <button data-back type="button" class="nd-btn nd-btn--ghost self-center">&larr; 返回</button>
    `

    const input = wrap.querySelector('[data-room-input]')
    input.addEventListener('input', () => {
      input.value = normalizeRoomCode(input.value)
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') joinRoom(input.value)
    })
    wrap.querySelector('[data-join-room]').addEventListener('click', () => {
      joinRoom(input.value)
    })
  }

  async function joinRoom(rawCode) {
    const code = normalizeRoomCode(rawCode)
    if (code.length !== 6) {
      showError('请输入 6 位房间码')
      return
    }

    try {
      showError('')
      wrap.querySelector('[data-guest-init]').classList.add('hidden')
      wrap.querySelector('[data-await]').classList.remove('hidden')

      const offerSdp = await getOffer(code)
      const { peer, signalData } = await createGuestPeer(offerSdp)
      if (destroyed) { peer.destroy(); return }

      await submitAnswer(code, signalData)
      matched = true
      wrap.querySelector('[data-await]').textContent = '匹配成功，正在建立连接...'

      peer.on('connect', () => {
        if (!destroyed) onConnected({ peer })
      })
    } catch (e) {
      wrap.querySelector('[data-guest-init]')?.classList.remove('hidden')
      wrap.querySelector('[data-await]')?.classList.add('hidden')
      showError(e.message || '加入房间失败')
    }
  }
}
