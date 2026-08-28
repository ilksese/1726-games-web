import { icons } from '../icons.js'

export function createRoleSelectScreen({ onCreateLan, onJoinLan, onCreateCloudflare, onJoinCloudflare, error }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--centered'

  let step = 'home'

  function render() {
    wrap.innerHTML = `
      <div class="nd-stack">
        <div>
          <h1 class="nd-screen-title">数字侦探</h1>
          <p class="nd-screen-subtitle">局域网双人数字破译</p>
        </div>
        ${step === 'home' ? renderHome() : renderMethodPicker(step)}
        <p data-error class="text-center text-sm text-red-300 min-h-[1.25rem]"></p>
      </div>
    `

    const errorEl = wrap.querySelector('[data-error]')
    if (error && errorEl) errorEl.textContent = error

    if (step === 'home') {
      wrap.querySelector('[data-create]').addEventListener('click', () => {
        step = 'create'
        render()
      })
      wrap.querySelector('[data-join]').addEventListener('click', () => {
        step = 'join'
        render()
      })
      return
    }

    wrap.querySelector('[data-back]').addEventListener('click', () => {
      step = 'home'
      render()
    })

    const isCreate = step === 'create'
    wrap.querySelector('[data-lan]').addEventListener('click', () => {
      if (isCreate) onCreateLan()
      else onJoinLan()
    })
    wrap.querySelector('[data-cloudflare]').addEventListener('click', () => {
      if (isCreate) onCreateCloudflare()
      else onJoinCloudflare()
    })
  }

  function renderHome() {
    return `
      <div class="nd-card nd-panel nd-stack">
        <button type="button" data-create class="nd-btn nd-btn--primary w-full">创建房间</button>
        <button type="button" data-join class="nd-btn nd-btn--secondary w-full">加入房间</button>
      </div>
    `
  }

  function renderMethodPicker(mode) {
    const title = mode === 'create' ? '创建房间' : '加入房间'
    const subtitle = mode === 'create'
      ? '选择创建方式'
      : '选择加入方式'

    return `
      <div class="nd-card nd-panel nd-stack">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="nd-panel__title">${title}</div>
            <p class="nd-screen-subtitle">${subtitle}</p>
          </div>
          <button type="button" data-back class="nd-btn nd-btn--ghost text-sm shrink-0">
            <span aria-hidden="true">${icons.back}</span>
            <span>返回</span>
          </button>
        </div>
        <button type="button" data-lan class="nd-btn nd-btn--primary w-full">局域网</button>
        <button type="button" data-cloudflare class="nd-btn nd-btn--secondary w-full">Cloudflare</button>
      </div>
    `
  }

  render()

  return wrap
}
