export function createHistoryInline() {
  const wrap = document.createElement('section')
  wrap.className = 'nd-card nd-panel nd-animate'
  wrap.innerHTML = `
    <div class="nd-panel__head">
      <div class="nd-panel__title">猜测记录</div>
      <div data-round class="nd-round-chip">第 1 轮</div>
    </div>
    <div class="nd-history-tabs">
      <button type="button" data-tab="mine" class="nd-history-tab" aria-pressed="true">我方</button>
      <button type="button" data-tab="opp" class="nd-history-tab" aria-pressed="false">对手</button>
    </div>
    <div data-list class="nd-history-list"></div>
  `

  let myEntries = []
  let oppEntries = []
  let activeTab = 'mine'

  const listEl = wrap.querySelector('[data-list]')
  const tabMine = wrap.querySelector('[data-tab="mine"]')
  const tabOpp = wrap.querySelector('[data-tab="opp"]')
  const roundEl = wrap.querySelector('[data-round]')

  function getBadge(entry) {
    const text = entry.resultText || ''

    if (text.includes('等待反馈')) {
      return { label: '等待中', tone: 'muted' }
    }

    if (text === '对 ✓') {
      return { label: '命中 4', tone: 'good' }
    }

    if (text === '错 ✗') {
      return { label: '未命中', tone: 'danger' }
    }

    const match = text.match(/(\d)位正确/)
    if (match) {
      const hits = Number(match[1])
      return {
        label: `命中 ${hits}`,
        tone: hits >= 4 ? 'good' : 'accent',
      }
    }

    return { label: text || '未命中', tone: 'muted' }
  }

  function setActiveTab(tab) {
    activeTab = tab
    tabMine.setAttribute('aria-pressed', String(tab === 'mine'))
    tabOpp.setAttribute('aria-pressed', String(tab === 'opp'))
    renderList()
  }

  function renderList() {
    const entries = activeTab === 'mine' ? myEntries : oppEntries
    const round = Math.max(myEntries.length, oppEntries.length) || 1
    roundEl.textContent = `第 ${round} 轮`
    listEl.innerHTML = ''
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="py-6 text-center text-sm text-slate-500">暂无记录</p>'
      return
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('div')
      const badge = getBadge(entry)
      row.className = 'nd-history-row'
      if (entry.red) row.classList.add('nd-history-row--highlight')
      row.innerHTML = `
        <span class="nd-history-index">${index + 1}</span>
        <div class="nd-digits"></div>
        <span class="nd-result-badge nd-result-badge--${badge.tone}">${badge.label}</span>
      `
      const digitsEl = row.querySelector('.nd-digits')
      const digits = String(entry.guess || '').slice(0, 4).split('')
      digits.forEach((digit) => {
        const chip = document.createElement('span')
        chip.className = 'nd-digit-chip'
        chip.textContent = digit
        digitsEl.appendChild(chip)
      })
      listEl.appendChild(row)
    })
  }

  function setMyEntries(entries) { myEntries = entries; renderList() }
  function setOppEntries(entries) { oppEntries = entries; renderList() }
  function showMine() { setActiveTab('mine') }
  function showOpp() { setActiveTab('opp') }

  tabMine.addEventListener('click', () => {
    setActiveTab('mine')
  })
  tabOpp.addEventListener('click', () => {
    setActiveTab('opp')
  })

  return { element: wrap, setMyEntries, setOppEntries, showMine, showOpp }
}
