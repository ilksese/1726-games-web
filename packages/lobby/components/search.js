export function createSearch(onQuery) {
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = '搜索游戏...'
  input.className = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-indigo-500 transition-colors'

  let timer = null
  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => onQuery(input.value.trim()), 200)
  })

  return { element: input }
}