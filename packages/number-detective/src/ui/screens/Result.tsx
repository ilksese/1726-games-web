interface ResultProps {
  won: boolean
  onRematch: () => void
  onLeave: () => void
}

export default function Result({ won, onRematch, onLeave }: ResultProps) {
  return (
    <div className="nd-shell nd-shell--centered">
      <div className="nd-card nd-panel nd-stack">
        <div>
          <h2 className={`nd-screen-title ${won ? 'text-[#59d98a]' : 'text-[#ff9aaa]'}`}>
            {won ? '你赢了' : '你输了'}
          </h2>
          <p className="nd-screen-subtitle">{won ? '本局对局已结束' : '这局已经结束，准备下一局'}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="nd-btn nd-btn--success flex-1" onClick={onRematch}>
            再来一局
          </button>
          <button type="button" className="nd-btn nd-btn--secondary flex-1" onClick={onLeave}>
            返回大厅
          </button>
        </div>
      </div>
    </div>
  )
}
