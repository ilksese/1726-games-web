export function createResultScreen({ won, onRematch, onLeave }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4'

  wrap.innerHTML = `
    <h2 class="text-5xl font-bold mb-12 ${won ? 'text-emerald-500' : 'text-red-500'}">${won ? '你赢了!' : '你输了'}</h2>
    <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <button type="button" data-rematch class="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-semibold transition-colors active:scale-95">再来一局</button>
      <button type="button" data-leave class="flex-1 py-3.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-lg font-semibold transition-colors active:scale-95">返回大厅</button>
    </div>
  `

  wrap.querySelector('[data-rematch]').addEventListener('click', onRematch)
  wrap.querySelector('[data-leave]').addEventListener('click', onLeave)

  return wrap
}
