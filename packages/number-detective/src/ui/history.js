import { Container, Text } from 'pixi.js'

const COL_W = 300

function createColumn(title, x) {
  const container = new Container()
  container.position.set(x, 0)

  const header = new Text({
    text: title,
    style: { fontSize: 16, fill: 0x9ca3af, fontFamily: 'system-ui' },
  })
  header.y = 0
  container.addChild(header)

  const rows = new Container()
  rows.position.set(0, 22)
  container.addChild(rows)

  function setEntries(entries) {
    rows.removeChildren()
    entries.forEach((entry, i) => {
      const color = entry.red ? 0xff4444 : entry.resultText === '对 ✓' ? 0x22c55e : 0xffffff
      const line = new Text({
        text: `${entry.guess}  →  ${entry.resultText}`,
        style: { fontSize: 14, fill: color, fontFamily: 'monospace' },
      })
      line.y = i * 20
      rows.addChild(line)
    })
  }

  return { container, setEntries }
}

export function createHistory() {
  const container = new Container()

  const myCol = createColumn('我对对手', 0)
  const oppCol = createColumn('对手对我', 340)
  container.addChild(myCol.container, oppCol.container)

  return {
    container,
    setMyEntries: myCol.setEntries,
    setOppEntries: oppCol.setEntries,
  }
}
