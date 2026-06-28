import Peer from 'simple-peer'

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const ICE_TIMEOUT_MS = 30000

function firstSignal(peer) {
  return new Promise((resolve, reject) => {
    const onSignal = (data) => {
      peer.off('error', onError)
      clearTimeout(timer)
      resolve(data)
    }
    const onError = (err) => {
      peer.off('signal', onSignal)
      clearTimeout(timer)
      reject(err)
    }
    const timer = setTimeout(() => {
      peer.off('signal', onSignal)
      peer.off('error', onError)
      reject(new Error('ICE收集超时，请重试'))
    }, ICE_TIMEOUT_MS)
    peer.once('signal', onSignal)
    peer.once('error', onError)
  })
}

export function encodeSdp(sessionDescription) {
  return btoa(JSON.stringify(sessionDescription))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function decodeSdp(encoded) {
  let s = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return JSON.parse(atob(s))
}

export async function createHostPeer() {
  const peer = new Peer({
    initiator: true,
    trickle: false,
    config: { iceServers: STUN_SERVERS },
  })
  try {
    const signalData = await firstSignal(peer)
    return { peer, signalData: encodeSdp(signalData) }
  } catch (e) {
    peer.destroy()
    throw e
  }
}

export async function createGuestPeer(encodedOffer) {
  const peer = new Peer({
    trickle: false,
    config: { iceServers: STUN_SERVERS },
  })
  try {
    peer.signal(decodeSdp(encodedOffer))
    const signalData = await firstSignal(peer)
    return { peer, signalData: encodeSdp(signalData) }
  } catch (e) {
    peer.destroy()
    throw e
  }
}

export function applyAnswer(peer, encodedAnswer) {
  peer.signal(decodeSdp(encodedAnswer))
}