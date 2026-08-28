export function createFeedbackToast() {
  const el = document.createElement('div')
  el.className = 'nd-toast'
  el.innerHTML = '<div class="nd-toast__inner"></div>'

  const inner = el.querySelector('div')
  let timer = null

  function show(text, kind) {
    const color = kind === 'win' ? 'nd-toast__inner--win'
      : kind === 'lose' ? 'nd-toast__inner--lose'
        : kind === 'match' ? 'nd-toast__inner--warn'
          : 'nd-toast__inner--info'
    inner.className = `nd-toast__inner ${color}`
    inner.textContent = text
    el.classList.add('nd-toast--visible')
    clearTimeout(timer)
    timer = setTimeout(() => {
      el.classList.remove('nd-toast--visible')
    }, 1500)
  }

  return { element: el, show }
}
