import { useRef, useState } from 'react'
import { icons } from '../icons'

interface RoleSelectProps {
  onCreateLan: () => void
  onJoinLan: () => void
  onCreateCloudflare: () => void
  onJoinCloudflare: () => void
  error: string
}

export default function RoleSelect({
  onCreateLan,
  onJoinLan,
  onCreateCloudflare,
  onJoinCloudflare,
  error,
}: RoleSelectProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null)

  const closeModal = () => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
  }

  const openModal = (mode: 'create' | 'join') => {
    setModalMode(mode)
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }

  const pick = (lan: boolean) => {
    closeModal()
    if (lan) {
      if (modalMode === 'create') onCreateLan()
      else onJoinLan()
    } else {
      if (modalMode === 'create') onCreateCloudflare()
      else onJoinCloudflare()
    }
  }

  const isCreate = modalMode === 'create'

  return (
    <div className="nd-shell nd-shell--centered">
      <div className="nd-stack">
        <div>
          <h1 className="nd-screen-title">数字侦探</h1>
          <p className="nd-screen-subtitle">局域网双人数字破译</p>
        </div>
        <div className="nd-card nd-panel nd-stack">
          <button
            type="button"
            className="nd-btn nd-btn--primary w-full"
            onClick={() => openModal('create')}
          >
            创建房间
          </button>
          <button
            type="button"
            className="nd-btn nd-btn--secondary w-full"
            onClick={() => openModal('join')}
          >
            加入房间
          </button>
        </div>
        <p className="text-center text-sm text-red-300 min-h-[1.25rem]">{error}</p>
      </div>

      <dialog
        ref={dialogRef}
        className="nd-modal"
        onCancel={(e) => {
          e.preventDefault()
          closeModal()
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeModal()
        }}
      >
        <div className="nd-modal__sheet nd-card">
          <div className="nd-modal__head">
            <div>
              <div className="nd-modal__title">{isCreate ? '创建房间' : '加入房间'}</div>
              <p className="nd-screen-subtitle nd-modal__subtitle">
                {isCreate ? '选择创建方式' : '选择加入方式'}
              </p>
            </div>
            <button
              type="button"
              className="nd-icon-button nd-modal__close"
              aria-label="关闭"
              onClick={closeModal}
            >
              {icons.close}
            </button>
          </div>
          <div className="nd-stack">
            <button type="button" className="nd-btn nd-btn--primary w-full" onClick={() => pick(true)}>
              局域网
            </button>
            <button
              type="button"
              className="nd-btn nd-btn--secondary w-full"
              onClick={() => pick(false)}
            >
              Cloudflare
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
