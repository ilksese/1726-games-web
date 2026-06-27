import QRCode from 'qrcode'

export function renderQr(data, width) {
  const wrapper = document.createElement('div')
  wrapper.className = 'bg-white p-3 rounded-xl'

  const canvas = document.createElement('canvas')
  QRCode.toCanvas(canvas, data, { width: width ?? 250, margin: 1, errorCorrectionLevel: 'M' })
  canvas.className = 'block'

  wrapper.appendChild(canvas)
  return wrapper
}

export function startScanner(videoEl, onDetect, onError) {
  let stopped = false

  ;(async () => {
    let stream
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
      const detector = new BarcodeDetector({ formats: ['qr_code'] })

      while (!stopped) {
        try {
          const barcodes = await detector.detect(videoEl)
          if (barcodes.length > 0) {
            stop()
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
    const stream = videoEl.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    videoEl.srcObject = null
    videoEl.classList.add('hidden')
  }

  return { stop }
}