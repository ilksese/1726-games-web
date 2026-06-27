export function createRoleSelectScreen({ onCreate, onJoin, error }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4'

  wrap.innerHTML = `
    <h1 class="text-4xl font-bold text-emerald-500 mb-2">数字侦探</h1>
    <p class="text-gray-400 text-lg mb-10">局域网双人数字破译</p>
    <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <button type="button" data-create class="flex-1 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-semibold transition-colors active:scale-95">创建房间</button>
      <button type="button" data-join class="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-semibold transition-colors active:scale-95">加入房间</button>
    </div>
    <p data-error class="mt-6 text-red-400 text-sm text-center max-w-md"></p>
  `

  wrap.querySelector('[data-create]').addEventListener('click', onCreate)
  wrap.querySelector('[data-join]').addEventListener('click', onJoin)
  if (error) wrap.querySelector('[data-error]').textContent = error

  return wrap
}
