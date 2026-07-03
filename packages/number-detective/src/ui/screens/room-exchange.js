import { createHostPeer, createGuestPeer, applyAnswer } from '../../net/signaling.js'
import { createRoom, pollAnswer, closeRoom, getOffer, submitAnswer, normalizeRoomCode } from '../../net/room-api.js'

export function createRoomExchangeScreen({ mode, onConnected, onBack }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center px-4 pt-16 pb-8'

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

  if (mode === 'host-beta') {
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
      <h2 class="text-3xl font-semibold text-white mb-2">创建房间（beta）</h2>
      <p class="text-gray-400 text-sm mb-6 text-center">把房间码告诉对手，对手输入后会自动连接</p>
      <div class="w-full max-w-md rounded-2xl bg-gray-900/80 border border-gray-700 p-6 text-center">
        <p class="text-gray-400 text-sm mb-3">房间码</p>
        <div data-room-code class="text-5xl tracking-[0.35em] font-bold text-emerald-400 min-h-[4rem] flex items-center justify-center">------</div>
        <p data-await class="mt-5 text-amber-400 text-base whitespace-pre-line">创建中...</p>
      </div>
      <p data-error class="mt-4 text-red-400 text-sm text-center"></p>
      <button data-back type="button" class="mt-8 text-gray-400 hover:text-white text-sm">&larr; 返回</button>
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
      <h2 class="text-3xl font-semibold text-white mb-6">加入房间（beta）</h2>
      <div data-guest-init class="w-full max-w-md rounded-2xl bg-gray-900/80 border border-gray-700 p-6">
        <p class="text-gray-400 text-sm mb-3">输入房主显示的 6 位房间码：</p>
        <input data-room-input inputmode="numeric" maxlength="6" placeholder="例如 482913" class="w-full px-4 py-4 rounded-xl bg-gray-800 text-white text-2xl tracking-[0.25em] text-center border border-gray-700 mb-4" />
        <button data-join-room type="button" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold transition-colors active:scale-95">加入房间</button>
      </div>
      <div data-await class="mt-6 text-amber-400 text-lg text-center hidden">正在连接房主...</div>
      <p data-error class="mt-4 text-red-400 text-sm text-center"></p>
      <button data-back type="button" class="mt-8 text-gray-400 hover:text-white text-sm">&larr; 返回</button>
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
