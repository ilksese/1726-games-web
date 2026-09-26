interface DiscardTileProps {
  name: string
  displayName: string
  player: string
}

export default function DiscardTile({ name, displayName, player }: DiscardTileProps) {
  return (
    <article className="wx-tile" aria-label={`${player} 打出 ${name}`}>
      <span className="wx-tile-seal" aria-hidden="true">{displayName}</span>
      <strong>{name}</strong>
      <span>{player}</span>
    </article>
  )
}
