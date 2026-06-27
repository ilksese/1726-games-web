import { renderQr, startScanner } from '../qr.js'
import { createOffer, acceptOffer, applyAnswer, encodeSdp } from '../../net/signaling.js'

export function createExchangeScreen({ mode, onConnected, onBack, encodedOffer }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center px-4 py-8'

  const videoEl = document.createElement('video')
  videoEl.className = 'hidden w-full max-w-sm rounded-xl mt-4'

  let scanner = null
  let destroyed = false

  function destroy() {
    destroyed = true
    scanner?.stop()
    scanner = null
  }

  function showError(msg) {
    const el = wrap.querySelector('[data-error]')
    if (el) el.textContent = msg
  }

  function showAnswerUI(answerSdp) {
    const qrWrap = wrap.querySelector('[data-qr]')
    const linkWrap = wrap.querySelector('[data-link-wrap]')
    const linkInput = wrap.querySelector('[data-link-input]')
    const awaitEl = wrap.querySelector('[data-await]')

    const answerUrl = `${location.origin}${location.pathname}#r=${encodeURIComponent(answerSdp)}`

    // QR code
    const qr = renderQr(answerUrl, 250)
    qrWrap.innerHTML = ''
    qrWrap.appendChild(qr)
    qrWrap.className = 'mb-4'

    // Link
    linkInput.value = answerUrl
    linkWrap.classList.remove('hidden')
    linkWrap.querySelector('[data-copy]').onclick = () => {
      navigator.clipboard.writeText(answerUrl).catch(() => {})
    }

    // Waiting text
    awaitEl.textContent = '等待主机确认...'
    awaitEl.classList.remove('hidden')
  }

  // --- HOST MODE ---
  if (mode === 'host') {
    wrap.innerHTML = `
      <h2 class="text-3xl font-semibold text-white mb-2">创建游戏房间</h2>
      <p class="text-gray-400 text-sm mb-2">请对手扫描二维码或打开链接加入</p>
      <div data-qr class="mb-4"></div>
      <div data-link-wrap class="w-full max-w-md mb-8">
        <p class="text-gray-400 text-xs mb-1">分享链接：</p>
        <div class="flex gap-2">
          <input data-link-input type="text" readonly class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs border border-gray-700" />
          <button data-copy type="button" class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">复制</button>
        </div>
      </div>
      <div class="w-full max-w-md border-t border-gray-700 my-4"></div>
      <p class="text-gray-400 text-sm mb-3">收到对手的应答后，粘贴链接或扫码：</p>
      <div class="flex gap-2 w-full max-w-md mb-3">
        <input data-answer-input type="text" placeholder="粘贴对手的应答链接" class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700" />
        <button data-answer-paste type="button" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors">确认</button>
      </div>
      <button data-scan type="button" class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">扫描对手的应答二维码</button>
      <div data-await class="mt-6 text-amber-400 text-lg whitespace-pre-line text-center hidden">等待对手加入...</div>
      <p data-error class="mt-4 text-red-400 text-sm text-center"></p>
      <button data-back type="button" class="mt-8 text-gray-400 hover:text-white text-sm">&larr; 返回</button>
    `

    // Start WebRTC host flow
    let pc, channel
    createOffer().then((result) => {
      pc = result.pc
      channel = result.channel
      const offerSdp = result.offerSdp

      if (destroyed) { pc.close(); return }

      const linkUrl = `${location.origin}${location.pathname}#s=${encodeURIComponent(offerSdp)}`

      // QR code
      const qr = renderQr(linkUrl, 250)
      wrap.querySelector('[data-qr]').appendChild(qr)

      // Link
      const linkInput = wrap.querySelector('[data-link-input]')
      linkInput.value = linkUrl

      wrap.querySelector('[data-copy]').addEventListener('click', () => {
        navigator.clipboard.writeText(linkUrl).catch(() => {})
      })

      // Show waiting
      const awaitEl = wrap.querySelector('[data-await]')
      awaitEl.classList.remove('hidden')

      // Paste answer flow
      wrap.querySelector('[data-answer-paste]').addEventListener('click', async () => {
        const raw = wrap.querySelector('[data-answer-input]').value.trim()
        if (!raw) return
        await applyRemoteAnswer(raw)
      })

      // Scan answer flow
      const scanBtn = wrap.querySelector('[data-scan]')
      scanBtn.addEventListener('click', () => {
        scanBtn.classList.add('hidden')
        wrap.insertBefore(videoEl, wrap.querySelector('[data-error]'))
        scanner = startScanner(videoEl,
          (raw) => { scanner = null; applyRemoteAnswer(raw) },
          (err) => { showError(err); scanBtn.classList.remove('hidden') },
        )
      })

      async function applyRemoteAnswer(raw) {
        try {
          let answerSdp
          if (raw.startsWith(location.origin)) {
            const idx = raw.indexOf('#r=')
            if (idx === -1) { showError('无效的应答链接'); return }
            answerSdp = decodeURIComponent(raw.slice(idx + 3))
          } else {
            answerSdp = raw
          }
          await applyAnswer(pc, answerSdp)
          channel.onopen = () => {
            if (!destroyed) onConnected({ pc, channel })
          }
        } catch (e) {
          showError(`连接失败: ${e.message}`)
        }
      }

    }).catch((e) => {
      if (!destroyed) showError(e.message)
    })
  }

  // --- GUEST MODE ---
  else {
    wrap.innerHTML = `
      <h2 class="text-3xl font-semibold text-white mb-6">加入游戏房间</h2>
      <div data-guest-init class="w-full max-w-md">
        <p class="text-gray-400 text-sm mb-3">粘贴主机分享的链接，或扫描二维码：</p>
        <div class="flex gap-2 mb-4">
          <input data-offer-input type="text" placeholder="粘贴主机分享的链接" class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-700" />
          <button data-offer-paste type="button" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors">确认</button>
        </div>
        <button data-offer-scan type="button" class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">扫描主机二维码</button>
      </div>
      <div data-guest-answer class="w-full max-w-md hidden">
        <p class="text-gray-400 text-sm mb-2">请主机扫描此码或复制链接确认连接</p>
        <div data-qr class="mb-4"></div>
        <div data-link-wrap class="w-full max-w-md mb-8 hidden">
          <p class="text-gray-400 text-xs mb-1">应答链接：</p>
          <div class="flex gap-2">
            <input data-link-input type="text" readonly class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs border border-gray-700" />
            <button data-copy type="button" class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">复制</button>
          </div>
        </div>
        <div data-await class="text-amber-400 text-lg text-center hidden">等待主机确认...</div>
      </div>
      <p data-error class="mt-4 text-red-400 text-sm text-center"></p>
      <button data-back type="button" class="mt-8 text-gray-400 hover:text-white text-sm">&larr; 返回</button>
    `

    function handleOffer(raw) {
      let offerSdp
      try {
        if (raw.startsWith(location.origin)) {
          const idx = raw.indexOf('#s=')
          if (idx === -1) { showError('无效的主机链接'); return }
          offerSdp = decodeURIComponent(raw.slice(idx + 3))
        } else {
          offerSdp = raw
        }

        wrap.querySelector('[data-guest-init]').classList.add('hidden')
        const answerSection = wrap.querySelector('[data-guest-answer]')
        answerSection.classList.remove('hidden')

        acceptOffer(offerSdp).then(({ pc, channel, answerSdp }) => {
          if (destroyed) { pc.close(); return }
          showAnswerUI(answerSdp)
          channel.onopen = () => {
            if (!destroyed) onConnected({ pc, channel })
          }
        }).catch((e) => {
          if (!destroyed) showError(e.message)
        })
      } catch (e) {
        showError('无效的主机链接')
      }
    }

    // Paste offer
    wrap.querySelector('[data-offer-paste]').addEventListener('click', () => {
      const raw = wrap.querySelector('[data-offer-input]').value.trim()
      if (!raw) return
      handleOffer(raw)
    })

    // Scan offer
    wrap.querySelector('[data-offer-scan]').addEventListener('click', () => {
      const scanBtn = wrap.querySelector('[data-offer-scan]')
      scanBtn.classList.add('hidden')
      wrap.querySelector('[data-guest-init]').insertBefore(videoEl, scanBtn.nextSibling)
      scanner = startScanner(videoEl,
        (raw) => { scanner = null; handleOffer(raw) },
        (err) => { showError(err); scanBtn.classList.remove('hidden') },
      )
    })

    // Auto-handle if opened via link with #s=<offer>
    if (encodedOffer) {
      handleOffer(encodedOffer)
    }
  }

  wrap.querySelector('[data-back]')?.addEventListener('click', () => {
    destroy()
    onBack()
  })

  return { element: wrap, destroy }
}