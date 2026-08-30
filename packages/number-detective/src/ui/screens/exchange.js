import { renderQr, startScanner } from '../qr.js'
import { createHostPeer, createGuestPeer, applyAnswer } from '../../net/signaling.js'

export function createExchangeScreen({ mode, onConnected, onBack, encodedOffer }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--stack'

  const videoEl = document.createElement('video')
  videoEl.className = 'hidden w-full max-w-sm rounded-2xl mt-4'

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

  async function showAnswerUI(answerSdp) {
    const qrWrap = wrap.querySelector('[data-qr]')
    const linkWrap = wrap.querySelector('[data-link-wrap]')
    const linkInput = wrap.querySelector('[data-link-input]')
    const awaitEl = wrap.querySelector('[data-await]')

    const answerUrl = `${location.origin}${location.pathname}#r=${encodeURIComponent(answerSdp)}`

    // QR code
    const qr = await renderQr(answerUrl, 250)
    qrWrap.innerHTML = ''
    qrWrap.appendChild(qr)
    qrWrap.className = 'flex justify-center mb-4'

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
      <div>
        <h2 class="nd-screen-title">创建游戏房间</h2>
        <p class="nd-screen-subtitle">请对手扫描二维码或打开链接加入</p>
      </div>
      <section class="nd-card nd-panel nd-stack">
        <div data-qr class="flex justify-center"></div>
        <div data-link-wrap class="nd-stack w-full">
          <p class="text-xs text-slate-500">分享链接</p>
          <div class="flex gap-2">
            <input data-link-input type="text" readonly class="nd-input flex-1 text-xs" />
            <button data-copy type="button" class="nd-btn nd-btn--secondary whitespace-nowrap">复制</button>
          </div>
        </div>
      </section>
      <section class="nd-card nd-panel nd-stack">
        <p class="nd-screen-subtitle">收到对手的应答后，粘贴链接或扫码：</p>
        <div class="flex gap-2 w-full">
          <input data-answer-input type="text" placeholder="粘贴对手的应答链接" class="nd-input flex-1" />
          <button data-answer-paste type="button" class="nd-btn nd-btn--primary whitespace-nowrap">确认</button>
        </div>
        <button data-scan type="button" class="nd-btn nd-btn--secondary w-full">扫描对手的应答二维码</button>
        <div data-await class="nd-surface-note text-center whitespace-pre-line hidden">等待对手加入...</div>
        <p data-error class="text-center text-sm text-red-300"></p>
      </section>
      <button data-back type="button" class="nd-btn nd-btn--ghost self-center">&larr; 返回</button>
    `

    // Start WebRTC host flow
    let peer
    createHostPeer().then(async ({ peer: p, signalData }) => {
      peer = p

      if (destroyed) { peer.destroy(); return }

      const linkUrl = `${location.origin}${location.pathname}#s=${encodeURIComponent(signalData)}`

      // QR code
      const qr = await renderQr(linkUrl, 250)
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
          await applyAnswer(peer, answerSdp)
          peer.on('connect', () => {
            if (!destroyed) onConnected({ peer })
          })
        } catch (e) {
          showError(`连接失败: ${e.message}`)
        }
      }

    }).catch((e) => {
      if (!destroyed) showError('连接创建失败')
    })
  }

  // --- GUEST MODE ---
  else {
    wrap.innerHTML = `
      <div>
        <h2 class="nd-screen-title">加入游戏房间</h2>
        <p class="nd-screen-subtitle">粘贴主机分享的链接，或扫描二维码</p>
      </div>
      <div data-guest-init class="nd-card nd-panel nd-stack w-full">
        <p class="nd-screen-subtitle">输入主机分享的链接</p>
        <div class="flex gap-2 w-full">
          <input data-offer-input type="text" placeholder="粘贴主机分享的链接" class="nd-input flex-1" />
          <button data-offer-paste type="button" class="nd-btn nd-btn--primary whitespace-nowrap">确认</button>
        </div>
        <button data-offer-scan type="button" class="nd-btn nd-btn--secondary w-full">扫描主机二维码</button>
      </div>
      <div data-guest-answer class="nd-card nd-panel nd-stack hidden">
        <p class="nd-screen-subtitle">请主机扫描此码或复制链接确认连接</p>
        <div data-qr class="flex justify-center"></div>
        <div data-link-wrap class="nd-stack hidden">
          <p class="text-xs text-slate-500">应答链接</p>
          <div class="flex gap-2">
            <input data-link-input type="text" readonly class="nd-input flex-1 text-xs" />
            <button data-copy type="button" class="nd-btn nd-btn--secondary whitespace-nowrap">复制</button>
          </div>
        </div>
        <div data-await class="nd-surface-note text-center hidden">等待主机确认...</div>
      </div>
      <p data-error class="text-center text-sm text-red-300"></p>
      <button data-back type="button" class="nd-btn nd-btn--ghost self-center">&larr; 返回</button>
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

        createGuestPeer(offerSdp).then(async ({ peer: p, signalData }) => {
          if (destroyed) { p.destroy(); return }
          showAnswerUI(signalData)
          p.on('connect', () => {
            if (!destroyed) onConnected({ peer: p })
          })
        }).catch(() => {
          if (!destroyed) showError('无效的主机链接')
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
