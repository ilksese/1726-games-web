export function createRoleSelectScreen({ onCreate, onJoin, onCreateBeta, onJoinBeta, error }) {
  const wrap = document.createElement('div')
  wrap.className = 'min-h-screen flex flex-col items-center justify-center px-4'

  wrap.innerHTML = `
    <h1 class="text-4xl font-bold text-emerald-500 mb-2">数字侦探</h1>
    <p class="text-gray-400 text-lg mb-10">局域网双人数字破译</p>
    <div class="w-full max-w-md space-y-3">
      <div class="flex flex-col sm:flex-row gap-3">
        <button type="button" data-create class="flex-1 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-semibold transition-colors active:scale-95">创建房间</button>
        <button type="button" data-join class="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-semibold transition-colors active:scale-95">加入房间</button>
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <button type="button" data-create-beta class="flex-1 py-3 rounded-xl border border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-base font-semibold transition-colors active:scale-95">创建房间（beta）</button>
        <button type="button" data-join-beta class="flex-1 py-3 rounded-xl border border-indigo-500/60 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 text-base font-semibold transition-colors active:scale-95">加入房间（beta）</button>
      </div>
    </div>
    <p data-error class="mt-6 text-red-400 text-sm text-center max-w-md"></p>
  `

  wrap.querySelector('[data-create]').addEventListener('click', onCreate)
  wrap.querySelector('[data-join]').addEventListener('click', onJoin)
  wrap.querySelector('[data-create-beta]').addEventListener('click', onCreateBeta)
  wrap.querySelector('[data-join-beta]').addEventListener('click', onJoinBeta)
  if (error) wrap.querySelector('[data-error]').textContent = error

  return wrap
}
