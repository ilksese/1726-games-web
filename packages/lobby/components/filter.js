export function createFilter(tags, activeTag, onSelect) {
  const container = document.createElement('div')
  container.className = 'flex gap-2 flex-wrap'

  tags.forEach(tag => {
    const btn = document.createElement('button')
    btn.className = `px-3 py-1 rounded-lg text-sm border transition-colors ${
      tag === activeTag
        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
        : 'border-gray-700 text-gray-400 hover:border-gray-500'
    }`
    btn.textContent = tag === 'all' ? '全部' : tag
    btn.addEventListener('click', () => onSelect(tag))
    container.appendChild(btn)
  })

  return { element: container }
}
