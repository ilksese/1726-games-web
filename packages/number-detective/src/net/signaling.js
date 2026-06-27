const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const ICE_TIMEOUT_MS = 5000

function waitForIceComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return Promise.race([
    new Promise((resolve) => {
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve()
      }
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('ICE收集超时，请重试')), ICE_TIMEOUT_MS)
    ),
  ])
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

export async function createOffer() {
  const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
  const channel = pc.createDataChannel('game')

  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceComplete(pc)

    return { pc, channel, offerSdp: encodeSdp(pc.localDescription) }
  } catch (e) {
    pc.close()
    throw e
  }
}

export async function acceptOffer(encodedOffer) {
  const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
  const channelPromise = new Promise((resolve) => {
    pc.ondatachannel = (e) => resolve(e.channel)
  })

  try {
    const offer = decodeSdp(encodedOffer)
    await pc.setRemoteDescription(offer)

    const channel = await channelPromise
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await waitForIceComplete(pc)

    return { pc, channel, answerSdp: encodeSdp(pc.localDescription) }
  } catch (e) {
    pc.close()
    throw e
  }
}

export async function applyAnswer(pc, encodedAnswer) {
  const answer = decodeSdp(encodedAnswer)
  await pc.setRemoteDescription(answer)
}