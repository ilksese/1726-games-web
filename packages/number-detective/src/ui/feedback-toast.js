export function createFeedbackToast() {
  const el = document.createElement('div')
  el.className = 'fixed inset-0 flex items-center justify-center pointer-events-none z-50 opacity-0 transition-opacity duration-300'
  el.innerHTML = '<div class="px-6 py-4 rounded-xl text-2xl font-bold shadow-2xl"></div>'

  const inner = el.querySelector('div')
  let timer = null

  function show(text, kind) {
    const color = kind === 'win' ? 'bg-emerald-600'
      : kind === 'lose' ? 'bg-red-600'
        : kind === 'match' ? 'bg-amber-500'
          : 'bg-gray-700'
    inner.className = `px-6 py-4 rounded-xl text-2xl font-bold shadow-2xl text-white ${color}`
    inner.textContent = text
    el.classList.remove('opacity-0')
    el.classList.add('opacity-100')
    clearTimeout(timer)
    timer = setTimeout(() => {
      el.classList.remove('opacity-100')
      el.classList.add('opacity-0')
    }, 1500)
  }

  return { element: el, show }
}
