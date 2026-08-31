export const COPY_POOL = [
  '这杯酒，敬你的好运！',
  '酒是粮食精，越喝越年轻～',
  '是时候展示真正的酒量了！',
  '推杯换盏，友谊长存！',
  '一杯下肚，烦恼全无！',
  '这一杯，躲是躲不掉的～',
  '酒杯一响，黄金万两！',
  '干了这杯，好运翻倍！',
  '酒逢知己千杯少，先干为敬！',
  '好手气！这杯请你笑纳～',
  '感情深，一口闷，敬伯乐！',
  '酒樽不空，情谊不散！',
]

export const SVG_GLASS = `
<svg viewBox="0 0 64 64" class="wd-glass-svg" aria-hidden="true">
  <defs>
    <linearGradient id="wg-wine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c6283a"/>
      <stop offset="1" stop-color="#6d0f1e"/>
    </linearGradient>
    <linearGradient id="wg-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d58a"/>
      <stop offset="1" stop-color="#b8863d"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-8 32 32)">
    <path d="M14 8h34l-4 40a3 3 0 0 1-3 2.7H21a3 3 0 0 1-3-2.7L14 8z" fill="none" stroke="url(#wg-gold)" stroke-width="2.4"/>
    <path d="M17.5 14c0 8 6 12 13 12s13-4 13-12z" fill="url(#wg-wine)"/>
    <path d="M12 8h38" stroke="url(#wg-gold)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="32" cy="14" rx="13" ry="3.4" fill="#f2d5a0" opacity="0.85"/>
    <path d="M31 2.5a1.5 1.5 0 0 1 2 0l1.4 3.4h-4.8z" fill="url(#wg-gold)"/>
  </g>
</svg>`

export const SVG_SAFE = `
<svg viewBox="0 0 64 64" class="wd-safe-svg" aria-hidden="true">
  <defs>
    <linearGradient id="wg-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3726"/>
      <stop offset="1" stop-color="#2b1f14"/>
    </linearGradient>
  </defs>
  <g transform="rotate(8 32 32)">
    <path d="M32 8c5 4 13 5 13 12 0 12-13 22-13 22S19 32 19 20c0-7 8-8 13-12z" fill="url(#wg-ink)" opacity="0.28"/>
    <path d="M32 10c4.4 3.6 11.5 4.6 11.5 10.5 0 10.2-11.5 19-11.5 19S20.5 30.7 20.5 20.5C20.5 14.6 27.6 13.6 32 10z" fill="none" stroke="#c9a15f" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 26l-6-6.5 1.8-1.6L32 22.4l6.2-5.5 1.8 1.6z" fill="#c9a15f"/>
  </g>
</svg>`

export const SVG_BACK = `
<svg viewBox="0 0 64 64" class="wd-back-svg" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="7" fill="none" stroke="#d8b877" stroke-width="2"/>
  <rect x="7" y="7" width="50" height="50" rx="4" fill="none" stroke="#d8b877" stroke-width="1" opacity="0.7"/>
  <circle cx="32" cy="32" r="15" fill="none" stroke="#d8b877" stroke-width="1.4" opacity="0.85"/>
  <circle cx="32" cy="32" r="8" fill="none" stroke="#d8b877" stroke-width="1.2" opacity="0.7"/>
  <path d="M32 24v16M24 32h16" stroke="#d8b877" stroke-width="1.6" stroke-linecap="round"/>
</svg>`

export const SVG_BACK_BAR = SVG_BACK.replace('class="wd-back-svg"', 'class="wd-back-svg wd-bar-icon"')
