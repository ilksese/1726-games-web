export function createHistoryInline() {
  const wrap = document.createElement('div')
  wrap.className = 'w-full max-w-[280px] mx-auto'
  wrap.innerHTML = `
    <div class="flex border-b border-gray-700">
      <button type="button" data-tab="mine" class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-emerald-500 text-white">我对对手</button>
      <button type="button" data-tab="opp" class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-white">对手对我</button>
    </div>
    <div data-list class="overflow-y-auto max-h-48 p-2 space-y-1.5"></div>
  `

  let myEntries = []
  let oppEntries = []
  let activeTab = 'mine'

  const listEl = wrap.querySelector('[data-list]')
  const tabMine = wrap.querySelector('[data-tab="mine"]')
  const tabOpp = wrap.querySelector('[data-tab="opp"]')

  function renderList() {
    const entries = activeTab === 'mine' ? myEntries : oppEntries
    listEl.innerHTML = ''
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-center py-6 text-sm">暂无记录</p>'
      return
    }
    entries.forEach((entry) => {
      const row = document.createElement('div')
      const color = entry.red
        ? 'text-red-400'
        : entry.resultText === '对 ✓' ? 'text-emerald-400' : 'text-white'
      row.className = `flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 ${color}`
      row.innerHTML = `<span class="font-mono text-lg">${entry.guess}</span><span class="text-sm">${entry.resultText}</span>`
      listEl.appendChild(row)
    })
  }

  function setMyEntries(entries) { myEntries = entries; renderList() }
  function setOppEntries(entries) { oppEntries = entries; renderList() }

  tabMine.addEventListener('click', () => {
    activeTab = 'mine'
    tabMine.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-emerald-500 text-white'
    tabOpp.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-white'
    renderList()
  })
  tabOpp.addEventListener('click', () => {
    activeTab = 'opp'
    tabOpp.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-emerald-500 text-white'
    tabMine.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-white'
    renderList()
  })

  return { element: wrap, setMyEntries, setOppEntries }
}