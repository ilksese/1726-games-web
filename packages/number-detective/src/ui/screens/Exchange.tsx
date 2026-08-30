import { useEffect, useRef, useState } from 'react'
import type Peer from 'simple-peer'
import { renderQr, startScanner } from '../../net/qr'
import { createHostPeer, createGuestPeer, applyAnswer } from '../../net/signaling'

interface ExchangeProps {
  mode: 'host' | 'guest'
  encodedOffer: string | null
  onConnected: (peer: Peer) => void
  onBack: () => void
}

export default function Exchange({ mode, encodedOffer, onConnected, onBack }: ExchangeProps) {
  const [error, setError] = useState('')
  const [linkValue, setLinkValue] = useState('')
  const [showLinkWrap, setShowLinkWrap] = useState(mode === 'host')
  const [showAwait, setShowAwait] = useState(false)
  const [awaitText, setAwaitText] = useState('')
  const [scanHidden, setScanHidden] = useState(false)
  const [guestInitHidden, setGuestInitHidden] = useState(false)
  const [guestAnswerShown, setGuestAnswerShown] = useState(false)

  const qrRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const offerInputRef = useRef<HTMLInputElement>(null)
  const pendingPeerRef = useRef<Peer | null>(null)
  const scannerRef = useRef<{ stop: () => void } | null>(null)
  const destroyedRef = useRef(false)
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected

  const showError = (msg: string) => setError(msg)
  const doCopy = () => navigator.clipboard.writeText(linkValue).catch(() => {})

  async function applyRemoteAnswer(raw: string) {
    const peer = pendingPeerRef.current
    if (!peer) return
    try {
      let answerSdp: string
      if (raw.startsWith(location.origin)) {
        const idx = raw.indexOf('#r=')
        if (idx === -1) {
          showError('无效的应答链接')
          return
        }
        answerSdp = decodeURIComponent(raw.slice(idx + 3))
      } else {
        answerSdp = raw
      }
      await applyAnswer(peer, answerSdp)
      peer.on('connect', () => {
        if (!destroyedRef.current) onConnectedRef.current(peer)
      })
    } catch (e) {
      showError(`连接失败: ${(e as Error).message}`)
    }
  }

  function handleOffer(raw: string) {
    let offerSdp: string
    try {
      if (raw.startsWith(location.origin)) {
        const idx = raw.indexOf('#s=')
        if (idx === -1) {
          showError('无效的主机链接')
          return
        }
        offerSdp = decodeURIComponent(raw.slice(idx + 3))
      } else {
        offerSdp = raw
      }

      setGuestInitHidden(true)
      setGuestAnswerShown(true)

      createGuestPeer(offerSdp)
        .then(async ({ peer, signalData }) => {
          if (destroyedRef.current) {
            peer.destroy()
            return
          }
          pendingPeerRef.current = peer
          const answerUrl = `${location.origin}${location.pathname}#r=${encodeURIComponent(signalData)}`

          const qr = await renderQr(answerUrl, 250)
          if (destroyedRef.current) {
            peer.destroy()
            return
          }
          if (qrRef.current) {
            qrRef.current.innerHTML = ''
            qrRef.current.appendChild(qr)
          }
          setLinkValue(answerUrl)
          setShowLinkWrap(true)
          setAwaitText('等待主机确认...')
          setShowAwait(true)

          peer.on('connect', () => {
            if (!destroyedRef.current) onConnectedRef.current(peer)
          })
        })
        .catch(() => {
          if (!destroyedRef.current) showError('无效的主机链接')
        })
    } catch {
      showError('无效的主机链接')
    }
  }

  // --- HOST: create offer peer + QR ---
  useEffect(() => {
    if (mode !== 'host') return
    createHostPeer()
      .then(async ({ peer, signalData }) => {
        if (destroyedRef.current) {
          peer.destroy()
          return
        }
        pendingPeerRef.current = peer
        const linkUrl = `${location.origin}${location.pathname}#s=${encodeURIComponent(signalData)}`

        const qr = await renderQr(linkUrl, 250)
        if (destroyedRef.current) {
          peer.destroy()
          return
        }
        qrRef.current?.appendChild(qr)
        setLinkValue(linkUrl)
        setAwaitText('等待对手加入...')
        setShowAwait(true)
      })
      .catch(() => {
        if (!destroyedRef.current) showError('连接创建失败')
      })
  }, [mode])

  // --- GUEST: auto-handle invite link (#s=...) ---
  useEffect(() => {
    if (mode === 'guest' && encodedOffer) {
      handleOffer(encodedOffer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, encodedOffer])

  useEffect(() => {
    return () => {
      destroyedRef.current = true
      scannerRef.current?.stop()
    }
  }, [])

  const startResponseScan = () => {
    setScanHidden(true)
    scannerRef.current = startScanner(
      videoRef.current!,
      (raw) => {
        scannerRef.current = null
        applyRemoteAnswer(raw)
      },
      (err) => {
        showError(err)
        setScanHidden(false)
      },
    )
  }

  const startOfferScan = () => {
    setScanHidden(true)
    scannerRef.current = startScanner(
      videoRef.current!,
      (raw) => {
        scannerRef.current = null
        handleOffer(raw)
      },
      (err) => {
        showError(err)
        setScanHidden(false)
      },
    )
  }

  if (mode === 'host') {
    return (
      <div className="nd-shell nd-shell--stack">
        <div>
          <h2 className="nd-screen-title">创建游戏房间</h2>
          <p className="nd-screen-subtitle">请对手扫描二维码或打开链接加入</p>
        </div>
        <section className="nd-card nd-panel nd-stack">
          <div ref={qrRef} className="flex justify-center"></div>
          <div className="nd-stack w-full">
            <p className="text-xs text-slate-500">分享链接</p>
            <div className="flex gap-2">
              <input type="text" readOnly className="nd-input flex-1 text-xs" value={linkValue} />
              <button type="button" className="nd-btn nd-btn--secondary whitespace-nowrap" onClick={doCopy}>
                复制
              </button>
            </div>
          </div>
        </section>
        <section className="nd-card nd-panel nd-stack">
          <p className="nd-screen-subtitle">收到对手的应答后，粘贴链接或扫码：</p>
          <div className="flex gap-2 w-full">
            <input
              type="text"
              placeholder="粘贴对手的应答链接"
              className="nd-input flex-1"
              ref={answerInputRef}
            />
            <button
              type="button"
              className="nd-btn nd-btn--primary whitespace-nowrap"
              onClick={() => {
                const raw = answerInputRef.current?.value.trim() || ''
                if (!raw) return
                applyRemoteAnswer(raw)
              }}
            >
              确认
            </button>
          </div>
          <button
            type="button"
            className={`nd-btn nd-btn--secondary w-full${scanHidden ? ' hidden' : ''}`}
            onClick={startResponseScan}
          >
            扫描对手的应答二维码
          </button>
          <div className={`nd-surface-note text-center whitespace-pre-line${showAwait ? '' : ' hidden'}`}>
            等待对手加入...
          </div>
          <video ref={videoRef} className="hidden w-full max-w-sm rounded-2xl mt-4" />
          <p className="text-center text-sm text-red-300">{error}</p>
        </section>
        <button type="button" className="nd-btn nd-btn--ghost self-center" onClick={onBack}>
          ← 返回
        </button>
      </div>
    )
  }

  return (
    <div className="nd-shell nd-shell--stack">
      <div>
        <h2 className="nd-screen-title">加入游戏房间</h2>
        <p className="nd-screen-subtitle">粘贴主机分享的链接，或扫描二维码</p>
      </div>
      <div className={`nd-card nd-panel nd-stack w-full${guestInitHidden ? ' hidden' : ''}`}>
        <p className="nd-screen-subtitle">输入主机分享的链接</p>
        <div className="flex gap-2 w-full">
          <input
            type="text"
            placeholder="粘贴主机分享的链接"
            className="nd-input flex-1"
            ref={offerInputRef}
          />
          <button
            type="button"
            className="nd-btn nd-btn--primary whitespace-nowrap"
            onClick={() => {
              const raw = offerInputRef.current?.value.trim() || ''
              if (!raw) return
              handleOffer(raw)
            }}
          >
            确认
          </button>
        </div>
        <button
          type="button"
          className={`nd-btn nd-btn--secondary w-full${scanHidden ? ' hidden' : ''}`}
          onClick={startOfferScan}
        >
          扫描主机二维码
        </button>
        <video ref={videoRef} className="hidden w-full max-w-sm rounded-2xl mt-4" />
      </div>
      <div className={`nd-card nd-panel nd-stack${guestAnswerShown ? '' : ' hidden'}`}>
        <p className="nd-screen-subtitle">请主机扫描此码或复制链接确认连接</p>
        <div ref={qrRef} className="flex justify-center"></div>
        <div className={`nd-stack${showLinkWrap ? '' : ' hidden'}`}>
          <p className="text-xs text-slate-500">应答链接</p>
          <div className="flex gap-2">
            <input type="text" readOnly className="nd-input flex-1 text-xs" value={linkValue} />
            <button type="button" className="nd-btn nd-btn--secondary whitespace-nowrap" onClick={doCopy}>
              复制
            </button>
          </div>
        </div>
        <div className={`nd-surface-note text-center${showAwait ? '' : ' hidden'}`}>{awaitText}</div>
      </div>
      <p className="text-center text-sm text-red-300">{error}</p>
      <button type="button" className="nd-btn nd-btn--ghost self-center" onClick={onBack}>
        ← 返回
      </button>
    </div>
  )
}
