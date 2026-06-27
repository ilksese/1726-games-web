export function createHistoryModal() {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-2 sm:inset-0 z-40 hidden items-center justify-center bg-black/60'
  overlay.innerHTML = `
    <div class="w-full max-w-lg h-full sm:h-auto sm:max-h-[80vh] bg-gray-900 rounded-xl sm:rounded-xl border border-gray-700 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 class="text-lg font-semibold text-white">发言记录</h3>
        <button type="button" data-close class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
      </div>
      <div class="flex border-b border-gray-700">
        <button type="button" data-tab="mine" class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-emerald-500 text-white">我对对手</button>
        <button type="button" data-tab="opp" class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-white">对手对我</button>
      </div>
      <div data-list class="flex-1 overflow-y-auto p-4 space-y-2"></div>
    </div>
  `

  let myEntries = []
  let oppEntries = []
  let activeTab = 'mine'

  const listEl = overlay.querySelector('[data-list]')
  const tabMine = overlay.querySelector('[data-tab="mine"]')
  const tabOpp = overlay.querySelector('[data-tab="opp"]')
  const closeBtn = overlay.querySelector('[data-close]')

  function renderList() {
    const entries = activeTab === 'mine' ? myEntries : oppEntries
    listEl.innerHTML = ''
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500 text-center py-8">暂无记录</p>'
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

  function open() {
    overlay.classList.remove('hidden')
    overlay.classList.add('flex')
    renderList()
  }
  function close() {
    overlay.classList.add('hidden')
    overlay.classList.remove('flex')
  }

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
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })

  return { element: overlay, open, close, setMyEntries, setOppEntries }
}
