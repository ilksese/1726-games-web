export function createCreateRoomScreen({ code, onBack }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4'

  wrap.innerHTML = `
    <h2 class="text-3xl font-semibold text-white mb-8">房间已创建</h2>
    <div class="text-6xl font-mono font-bold text-emerald-500 tracking-[0.3em] mb-3">${code}</div>
    <p class="text-gray-400 text-base mb-2">将此口令告知对方</p>
    <p class="text-amber-400 text-xl mt-6 mb-10">等待对手加入...</p>
    <button type="button" data-back class="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-base transition-colors active:scale-95">取消</button>
  `

  wrap.querySelector('[data-back]').addEventListener('click', onBack)

  return wrap
}
