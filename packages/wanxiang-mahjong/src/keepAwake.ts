export function keepAwake(): () => void {
  let sentinel: WakeLockSentinel | null = null
  let stopped = false

  const request = async () => {
    if (stopped || document.visibilityState !== 'visible' || !navigator.wakeLock) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void request()
  }

  void request()
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisible)
    void sentinel?.release()
  }
}
