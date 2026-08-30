import QRCode from 'qrcode'

export async function renderQr(data: string, width?: number): Promise<HTMLDivElement> {
  const wrapper = document.createElement('div')
  wrapper.className = 'nd-qr-shell'

  const canvas = document.createElement('canvas')
  try {
    await QRCode.toCanvas(canvas, data, { width: width ?? 250, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    wrapper.textContent = '二维码生成失败'
    wrapper.className = 'nd-qr-shell nd-qr-shell--error text-sm'
    return wrapper
  }
  canvas.className = 'block'

  wrapper.appendChild(canvas)
  return wrapper
}

export function startScanner(
  videoEl: HTMLVideoElement,
  onDetect: (raw: string) => void,
  onError: (msg: string) => void,
): { stop: () => void } {
  let stopped = false

  ;(async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
    } catch {
      onError('无法访问摄像头')
      return
    }

    videoEl.srcObject = stream
    videoEl.classList.remove('hidden')
    await videoEl.play()

    try {
      const BarcodeDetectorCtor = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector as
        | (new (options: { formats: string[] }) => { detect: (source: unknown) => Promise<Array<{ rawValue: string }>> })
        | undefined
      if (!BarcodeDetectorCtor) throw new Error('unsupported')
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })

      while (!stopped) {
        try {
          const barcodes = await detector.detect(videoEl)
          if (barcodes.length > 0) {
            return barcodes[0].rawValue
          }
        } catch {
          // detect throws occasionally on some frames, ignore and retry
        }
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch {
      // BarcodeDetector not available
      stop()
      onError('此浏览器不支持二维码扫描，请使用复制链接方式')
      return
    }
  })().then((raw) => {
    if (raw && !stopped) {
      stop()
      onDetect(raw)
    }
  })

  function stop() {
    stopped = true
    const stream = videoEl.srcObject as MediaStream | null
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    videoEl.srcObject = null
    videoEl.classList.add('hidden')
  }

  return { stop }
}
