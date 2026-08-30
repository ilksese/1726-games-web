declare module 'qrcode' {
  const QRCode: {
    toCanvas(
      canvas: HTMLCanvasElement,
      text: string,
      options?: Record<string, unknown>,
    ): Promise<HTMLCanvasElement>
  }
  export default QRCode
}

declare module 'simple-peer' {
  interface SimplePeerOptions {
    initiator?: boolean
    trickle?: boolean
    config?: { iceServers?: unknown[] }
    stream?: unknown
  }

  export interface SignalData {
    sdp?: string
    type?: string
    candidate?: unknown
  }

  class Peer {
    connected: boolean
    constructor(options?: SimplePeerOptions)
    signal(data: unknown): void
    send(data: string | Uint8Array | ArrayBuffer): void
    destroy(): void
    on(event: string, listener: (...args: any[]) => void): this
    once(event: string, listener: (...args: any[]) => void): this
    off(event: string, listener: (...args: any[]) => void): this
  }

  export default Peer
}
