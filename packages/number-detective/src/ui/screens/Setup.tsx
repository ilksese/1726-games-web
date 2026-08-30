import { useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { validateSecret } from '../../game/validate'
import { secretAtom, myReadyAtom, oppReadyAtom } from '../../store'
import Keypad from '../Keypad'

export default function Setup({ onReady }: { onReady: () => void }) {
  const [secret, setSecret] = useAtom(secretAtom)
  const myReady = useAtomValue(myReadyAtom)
  const oppReady = useAtomValue(oppReadyAtom)

  const status = myReady ? '已设置，等待对手...' : oppReady ? '对手已就绪，等你设置' : ''

  const confirm = () => {
    if (validateSecret(secret)) return
    onReady()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (myReady) return
      if (e.key >= '0' && e.key <= '9') {
        if (secret.length < 4) setSecret(secret + e.key)
      } else if (e.key === 'Backspace') {
        setSecret(secret.slice(0, -1))
      } else if (e.key === 'Enter') {
        if (!validateSecret(secret)) onReady()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  return (
    <div className="nd-shell nd-shell--stack">
      <div>
        <h2 className="nd-screen-title">设置谜底</h2>
        <p className="nd-screen-subtitle">输入 4 位不重复的数字</p>
      </div>
      <section className="nd-card nd-panel nd-stack">
        <div className="nd-secret-grid">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < secret.length
            return (
              <div key={i} className={filled ? 'nd-secret-cell nd-secret-cell--filled' : 'nd-secret-cell'}>
                {filled ? secret[i] : '_'}
              </div>
            )
          })}
        </div>
        <p className="min-h-[24px] text-center text-sm text-amber-300">{status}</p>
      </section>
      <Keypad
        onDigit={(d) => {
          if (!myReady && secret.length < 4) setSecret(secret + d)
        }}
        onClear={() => {
          if (!myReady) setSecret(secret.slice(0, -1))
        }}
        onConfirm={confirm}
      />
    </div>
  )
}
