import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { toastAtom } from '../store'

export default function FeedbackToast() {
  const toast = useAtomValue(toastAtom)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [toast])

  const color = !toast
    ? ''
    : toast.kind === 'win'
      ? 'nd-toast__inner--win'
      : toast.kind === 'lose'
        ? 'nd-toast__inner--lose'
        : toast.kind === 'match'
          ? 'nd-toast__inner--warn'
          : 'nd-toast__inner--info'

  return (
    <div className={visible ? 'nd-toast nd-toast--visible' : 'nd-toast'}>
      <div className={`nd-toast__inner ${color}`}>{toast ? toast.text : ''}</div>
    </div>
  )
}
