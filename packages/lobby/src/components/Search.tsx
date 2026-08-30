import { useRef } from 'react'

interface SearchProps {
  onQuery: (q: string) => void
}

export function Search({ onQuery }: SearchProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onQuery(value.trim()), 200)
  }

  return (
    <input
      type="text"
      placeholder="搜索游戏..."
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-indigo-500 transition-colors"
      onInput={(e) => handleInput(e.currentTarget.value)}
    />
  )
}
