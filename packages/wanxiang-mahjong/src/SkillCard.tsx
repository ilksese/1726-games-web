interface SkillCardProps {
  name: string
  displayName: string
  effect?: string
}

export default function SkillCard({ name, displayName, effect }: SkillCardProps) {
  const title = name.includes('禁止') ? name.split('禁止') : [name]
  return (
    <svg className="wx-face" viewBox="0 0 180 252" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="wx-lacquer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e2428" />
          <stop offset="1" stopColor="#2b1012" />
        </linearGradient>
        <linearGradient id="wx-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="0.4" stopColor="#c8923a" />
          <stop offset="1" stopColor="#f0d48a" />
        </linearGradient>
        <linearGradient id="wx-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#243246" />
          <stop offset="1" stopColor="#101820" />
        </linearGradient>
        <pattern id="wx-brocade" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 12 L12 0 M-3 3 L3 -3 M9 15 L15 9" stroke="#e2c27a" strokeWidth="0.4" opacity="0.28" />
        </pattern>
      </defs>
      <rect width="180" height="252" rx="14" fill="url(#wx-lacquer)" />
      <rect width="180" height="252" rx="14" fill="url(#wx-brocade)" />
      <rect x="5" y="5" width="170" height="242" rx="11" fill="none" stroke="url(#wx-gold)" strokeWidth="3" />
      <rect x="11" y="11" width="158" height="230" rx="8" fill="none" stroke="#8a6730" strokeWidth="1" />
      <rect x="24" y="28" width="132" height="168" rx="8" fill="url(#wx-ink)" stroke="#c6a15a" />
      <circle cx="90" cy="112" r="40" fill="none" stroke="#e2c27a" strokeWidth="1.4" />
      <circle cx="90" cy="112" r="32" fill="none" stroke="#8a6730" />
      <text className="wx-face-seal" x="90" y="132">{displayName}</text>
      {title.length === 2 ? (
        <>
          <text className="wx-face-name" x="90" y="216">{title[0]}</text>
          <text className="wx-face-name" x="90" y="234">禁止{title[1]}</text>
        </>
      ) : (
        <text className="wx-face-name" x="90" y="226">{name}</text>
      )}
      {effect ? <title>{effect}</title> : null}
    </svg>
  )
}
