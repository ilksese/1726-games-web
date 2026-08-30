const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'confirm'],
]

interface KeypadProps {
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
}

export default function Keypad({ onDigit, onClear, onConfirm }: KeypadProps) {
  return (
    <div className="nd-keypad">
      {KEYS.flatMap((row) =>
        row.map((k) => {
          if (k === 'clear') {
            return (
              <button
                key="clear"
                type="button"
                aria-label="删除"
                className="nd-keypad__button nd-keypad__button--clear"
                onClick={onClear}
              >
                ←
              </button>
            )
          }
          if (k === 'confirm') {
            return (
              <button
                key="confirm"
                type="button"
                aria-label="确认"
                className="nd-keypad__button nd-keypad__button--confirm"
                onClick={onConfirm}
              >
                ✓
              </button>
            )
          }
          return (
            <button
              key={k}
              type="button"
              aria-label={`输入 ${k}`}
              className="nd-keypad__button"
              onClick={() => onDigit(k)}
            >
              {k}
            </button>
          )
        }),
      )}
    </div>
  )
}
