// Detailed C4 (in-game look): tan explosive bricks taped together, electronic unit with a green
// LCD, keypad, LEDs and wires. Parts are grouped (.c4-p1..p5) so CSS can assemble / break it.
// `id` keeps gradient ids unique when several C4s are on the page. viewBox is 0 0 120 80.
// Code on the C4 display, typed in step by step: progress 0 -> '*******', 1 -> '7355608'
export const C4_CODE = '7355608'
export const c4Code = (progress) => {
  const n = Math.max(0, Math.min(7, Math.floor(progress * 7 + 0.0001)))
  return C4_CODE.slice(0, n) + '*'.repeat(7 - n)
}

// FPG-style C4: upright line-art (outline only, colored by CSS), same part groups as c4Svg so the
// planting / defused animations work on it too. viewBox is 0 0 60 80.
export function c4FpgSvg() {
  const keys = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) keys.push(`<rect x="${19 + c * 8}" y="${40 + r * 7}" width="6" height="5" rx="1" />`)
  return `
<svg class="c4 c4-fpg" viewBox="0 0 60 80" aria-hidden="true">
  <g class="c4-p c4-p1"><rect x="10" y="12" width="40" height="64" rx="4" /></g>
  <g class="c4-p c4-p2"><path d="M6 32 H54 M6 62 H54" /></g>
  <g class="c4-p c4-p3"><rect x="15" y="16" width="30" height="16" rx="2" /><text class="c4-lcd" x="30" y="27" text-anchor="middle">7355608</text></g>
  <g class="c4-p c4-p4">${keys.join('')}</g>
  <g class="c4-p c4-p5"><path d="M40 12 C41 5, 47 3, 50 6" /><circle cx="44" cy="36" r="1.6" class="c4-led" /></g>
  <g class="c4-sparks"><path d="M2 4 L8 10 L4 11 L10 18" /><path d="M58 18 L52 24 L56 25 L50 32" /><path d="M30 0 L33 5 L29 6 L32 11" /></g>
</svg>`
}

export function c4Svg(id,{ wires = true, cls = 'c4', attrs = '' } = {}) {
  const g = (n) => `${id}-${n}`
  const keys = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      keys.push(`<rect x="${37.5 + c * 11.5}" y="${31 + r * 8.5}" width="8.5" height="6" rx="1.4" />`)
  return `
<svg class="${cls}" viewBox="0 0 120 80" ${attrs} aria-hidden="true">
  <defs>
    <linearGradient id="${g('brick')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3d2a4" /><stop offset="0.55" stop-color="#c7b07a" /><stop offset="1" stop-color="#9c8452" />
    </linearGradient>
    <linearGradient id="${g('dev')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a6153" /><stop offset="1" stop-color="#2d312a" />
    </linearGradient>
    <linearGradient id="${g('key')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1f3ea" /><stop offset="1" stop-color="#b9bdb0" />
    </linearGradient>
  </defs>
  <g class="c4-p c4-p1">
    <rect x="4" y="20" width="112" height="56" rx="7" fill="url(#${g('brick')})" stroke="#5b4a26" stroke-width="2" />
    <path d="M41 21 V75 M79 21 V75" stroke="#8a7445" stroke-width="1.6" />
    <path d="M8 26 H112" stroke="#f3e6c2" stroke-width="2" opacity="0.6" />
  </g>
  <g class="c4-p c4-p2">
    <rect x="16" y="17" width="9" height="62" rx="2" fill="#262626" />
    <rect x="95" y="17" width="9" height="62" rx="2" fill="#262626" />
    <path d="M17 30 H24 M17 52 H24 M96 30 H103 M96 52 H103" stroke="#3d3d3d" stroke-width="1.2" />
  </g>
  <g class="c4-p c4-p3">
    <rect x="31" y="8" width="58" height="54" rx="5" fill="url(#${g('dev')})" stroke="#1a1d18" stroke-width="2" />
    <rect x="36" y="13" width="48" height="13" rx="2" fill="#0a1d0c" stroke="#111" stroke-width="1.2" />
    <text class="c4-lcd" x="60" y="23" text-anchor="middle">7355608</text>
  </g>
  <g class="c4-p c4-p4" fill="url(#${g('key')})">${keys.join('')}</g>
  <g class="c4-p c4-p5">
    ${
      wires
        ? `<path d="M31 22 C18 20, 14 8, 6 12" class="c4-w c4-w-red" />
    <path d="M89 20 C102 16, 106 6, 114 10" class="c4-w c4-w-yellow" />
    <path d="M60 62 C58 70, 46 72, 44 78" class="c4-w c4-w-blue" />`
        : ''
    }
    <circle cx="85" cy="12" r="2.4" class="c4-led" />
    <circle cx="85" cy="19" r="2" class="c4-led2" />
  </g>
  <g class="c4-sparks"><path d="M4 6 L12 14 L7 15 L15 24" /><path d="M116 22 L108 30 L113 31 L105 40" /><path d="M58 0 L62 7 L57 8 L61 15" /></g>
</svg>`
}
