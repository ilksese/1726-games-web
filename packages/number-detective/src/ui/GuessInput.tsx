export default function GuessInput({ digits }: { digits: string }) {
  const cells = [0, 1, 2, 3]
  return (
    <div className="nd-entry-grid">
      {cells.map((i) => {
        const filled = i < digits.length
        return (
          <div key={i} className={filled ? 'nd-entry-cell nd-entry-cell--filled' : 'nd-entry-cell'}>
            {filled ? digits[i] : '_'}
          </div>
        )
      })}
    </div>
  )
}
