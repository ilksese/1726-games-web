export default function WoodGrain() {
  return (
    <svg className="wx-wood" aria-hidden="true">
      <filter id="wx-wood-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.28" numOctaves="4" seed="8" result="rings" />
        <feTurbulence type="turbulence" baseFrequency="0.004 0.9" numOctaves="2" seed="2" result="fiber" />
        <feBlend in="rings" in2="fiber" mode="multiply" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0.55 0.2 0 0 0.28 0.28 0.12 0 0 0.14 0.08 0.04 0 0 0.05 0 0 0 0.72 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#wx-wood-grain)" />
    </svg>
  )
}
