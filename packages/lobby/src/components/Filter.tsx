interface FilterProps {
  tags: string[]
  activeTag: string
  onSelect: (tag: string) => void
}

export function Filter({ tags, activeTag, onSelect }: FilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tags.map((tag) => (
        <button
          key={tag}
          className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
            tag === activeTag
              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
              : 'border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
          onClick={() => onSelect(tag)}
        >
          {tag === 'all' ? '全部' : tag}
        </button>
      ))}
    </div>
  )
}
