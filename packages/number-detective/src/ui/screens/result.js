export function createResultScreen({ won, onRematch, onLeave }) {
  const wrap = document.createElement('div')
  wrap.className = 'nd-shell nd-shell--centered'

  wrap.innerHTML = `
    <div class="nd-card nd-panel nd-stack">
      <div>
        <h2 class="nd-screen-title ${won ? 'text-[#59d98a]' : 'text-[#ff9aaa]'}">${won ? '你赢了' : '你输了'}</h2>
        <p class="nd-screen-subtitle">${won ? '本局对局已结束' : '这局已经结束，准备下一局'}</p>
      </div>
      <div class="flex gap-3">
        <button type="button" data-rematch class="nd-btn nd-btn--success flex-1">再来一局</button>
        <button type="button" data-leave class="nd-btn nd-btn--secondary flex-1">返回大厅</button>
      </div>
    </div>
  `

  wrap.querySelector('[data-rematch]').addEventListener('click', onRematch)
  wrap.querySelector('[data-leave]').addEventListener('click', onLeave)

  return wrap
}
