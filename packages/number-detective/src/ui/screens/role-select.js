import { icons } from '../icons.js'

export function createRoleSelectScreen({ onCreateLan, onJoinLan, onCreateCloudflare, onJoinCloudflare, error }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--centered'

  wrap.innerHTML = `
    <div class="nd-stack">
      <div>
        <h1 class="nd-screen-title">数字侦探</h1>
        <p class="nd-screen-subtitle">局域网双人数字破译</p>
      </div>
      <div class="nd-card nd-panel nd-stack">
        <button type="button" data-create class="nd-btn nd-btn--primary w-full">创建房间</button>
        <button type="button" data-join class="nd-btn nd-btn--secondary w-full">加入房间</button>
      </div>
      <p data-error class="text-center text-sm text-red-300 min-h-[1.25rem]"></p>
    </div>
  `

  const dialog = document.createElement('dialog')
  dialog.className = 'nd-modal'
  dialog.innerHTML = `
    <div class="nd-modal__sheet nd-card">
      <div class="nd-modal__head">
        <div>
          <div data-modal-title class="nd-modal__title"></div>
          <p data-modal-subtitle class="nd-screen-subtitle nd-modal__subtitle"></p>
        </div>
        <button type="button" data-modal-close class="nd-icon-button nd-modal__close" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div class="nd-stack">
        <button type="button" data-modal-lan class="nd-btn nd-btn--primary w-full">局域网</button>
        <button type="button" data-modal-cloudflare class="nd-btn nd-btn--secondary w-full">Cloudflare</button>
      </div>
    </div>
  `

  wrap.appendChild(dialog)

  const errorEl = wrap.querySelector('[data-error]')
  const createBtn = wrap.querySelector('[data-create]')
  const joinBtn = wrap.querySelector('[data-join]')
  const modalTitle = dialog.querySelector('[data-modal-title]')
  const modalSubtitle = dialog.querySelector('[data-modal-subtitle]')
  const modalClose = dialog.querySelector('[data-modal-close]')
  const modalLan = dialog.querySelector('[data-modal-lan]')
  const modalCloudflare = dialog.querySelector('[data-modal-cloudflare]')

  function closeModal() {
    if (dialog.open) {
      dialog.close()
    }
  }

  function openModal(mode) {
    const isCreate = mode === 'create'
    modalTitle.textContent = isCreate ? '创建房间' : '加入房间'
    modalSubtitle.textContent = isCreate ? '选择创建方式' : '选择加入方式'
    modalLan.onclick = () => {
      closeModal()
      if (isCreate) onCreateLan()
      else onJoinLan()
    }
    modalCloudflare.onclick = () => {
      closeModal()
      if (isCreate) onCreateCloudflare()
      else onJoinCloudflare()
    }
    if (!dialog.open) {
      dialog.showModal()
    }
  }

  createBtn.addEventListener('click', () => openModal('create'))
  joinBtn.addEventListener('click', () => openModal('join'))
  modalClose.addEventListener('click', closeModal)
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    closeModal()
  })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeModal()
    }
  })

  if (error && errorEl) errorEl.textContent = error

  return wrap
}
