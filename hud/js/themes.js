// Color/typography presets. Picked in the manager panel ("Theme"), individual colors can still be
// overridden by the panel fields. Each key maps to a CSS variable in hud.css (:root).
// "...-style" presets are color palettes inspired by big tournament broadcasts, not official branding.

export const FONTS = {
  rajdhani: "'Rajdhani', sans-serif",
  oswald: "'Oswald', sans-serif",
  barlow: "'Barlow Condensed', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  teko: "'Teko', sans-serif"
}

export const THEMES = {
  default: {
    money: '#7fd17f',
    ct: '#5b9bd5', t: '#e0a13a', accent: '#5b9bd5',
    bg: 'rgba(12, 14, 20, 0.88)', bgLight: 'rgba(32, 36, 48, 0.9)',
    text: '#f2f4f8', muted: '#9aa3b2', onSide: '#0b0d12', radius: '6px', font: 'rajdhani'
  },
  blast: {
    // by the BLAST Premier World Final 2024 broadcast (reference frames: _ref/blast-yt, kept locally)
    money: '#7be495',
    ct: '#4d6cfa', t: '#ec3a5f', accent: '#4d6cfa',
    bg: 'rgba(13, 17, 66, 0.92)', bgLight: 'rgba(22, 28, 92, 0.95)',
    text: '#ffffff', muted: '#a3a9d6', onSide: '#ffffff', radius: '4px', font: 'montserrat'
  },
  esl: {
    money: '#9be37a',
    ct: '#4a8fe7', t: '#ef7d1a', accent: '#f5c518',
    bg: 'rgba(14, 14, 14, 0.9)', bgLight: 'rgba(34, 34, 34, 0.92)',
    text: '#ffffff', muted: '#9c9c9c', onSide: '#0e0e0e', radius: '2px', font: 'oswald'
  },
  iem: {
    money: '#6fe3b0',
    ct: '#00b2ff', t: '#ffb000', accent: '#00b2ff',
    bg: 'rgba(6, 16, 32, 0.9)', bgLight: 'rgba(14, 32, 60, 0.92)',
    text: '#eaf4ff', muted: '#8aa2c0', onSide: '#061020', radius: '4px', font: 'oswald'
  },
  pgl: {
    // by the PGL Bucharest 2026 broadcast (reference frames: _ref/pgl-yt, kept locally)
    money: '#7fd88a',
    ct: '#1fa6ff', t: '#f5891f', accent: '#d7dbe2',
    bg: 'rgba(24, 27, 34, 0.88)', bgLight: 'rgba(42, 47, 58, 0.92)',
    text: '#ffffff', muted: '#9aa1ad', onSide: '#0d1016', radius: '8px', font: 'barlow'
  },
  faceit: {
    money: '#8fdc8f',
    ct: '#5aa9ff', t: '#ff5500', accent: '#ff5500',
    bg: 'rgba(20, 20, 20, 0.9)', bgLight: 'rgba(38, 38, 38, 0.92)',
    text: '#f5f5f5', muted: '#a0a0a0', onSide: '#141414', radius: '4px', font: 'rajdhani'
  },
  neon: {
    money: '#b6ff00',
    ct: '#00e5ff', t: '#ff2bd6', accent: '#b6ff00',
    bg: 'rgba(8, 4, 20, 0.9)', bgLight: 'rgba(24, 12, 48, 0.92)',
    text: '#ffffff', muted: '#9d8fc4', onSide: '#080414', radius: '10px', font: 'teko'
  },
  fpg: {
    money: '#7ee07e',
    ct: '#3d8bff', t: '#f5a623', accent: '#e9edf5',
    bg: 'rgba(26, 28, 34, 0.9)', bgLight: 'rgba(44, 47, 56, 0.92)',
    text: '#ffffff', muted: '#a7adba', onSide: '#0f1115', radius: '8px', font: 'montserrat'
  },
  light: {
    money: '#137a36',
    ct: '#1f6fd1', t: '#d98200', accent: '#1f6fd1',
    bg: 'rgba(246, 247, 250, 0.94)', bgLight: 'rgba(226, 230, 238, 0.96)',
    text: '#12151c', muted: '#5d6675', onSide: '#ffffff', radius: '6px', font: 'montserrat'
  },
  ewc: {
    // by the Esports World Cup 2026 broadcast (reference frames: _ref/ewc-yt, kept locally)
    money: '#9be37a',
    ct: '#3546d1', t: '#c9a227', accent: '#ffffff',
    bg: 'rgba(18, 18, 22, 0.88)', bgLight: 'rgba(244, 244, 244, 0.97)',
    text: '#ffffff', muted: '#c9c9c9', onSide: '#ffffff', radius: '0px', font: 'barlow'
  },
  starladder: {
    // by the StarLadder StarSeries Fall 2026 broadcast (reference frames: _ref/sl-yt, kept locally)
    money: '#ff6a5f',
    ct: '#2f63d6', t: '#c8352f', accent: '#ffffff',
    bg: 'rgba(22, 26, 44, 0.92)', bgLight: 'rgba(32, 38, 64, 0.95)',
    text: '#ffffff', muted: '#9aa3c0', onSide: '#ffffff', radius: '2px', font: 'oswald'
  }
}

// Names/descriptions for the preset gallery (presets.html)
export const THEME_INFO = {
  default: { label: 'Default', text: 'Neutral dark, soft corners, Rajdhani' },
  blast: { label: 'BLAST-style', text: 'Navy panels, blue / red sides, score box with side bars, photo cards in a row at the bottom, Montserrat' },
  esl: { label: 'ESL-style', text: 'Black / yellow, yellow header bands, Oswald' },
  iem: { label: 'IEM-style', text: 'Navy / cyan, thin glowing lines, Oswald' },
  pgl: { label: 'PGL-style', text: 'One-piece score bar with team-color edges, cyan / orange, compact tiles with HP bars, Barlow Condensed' },
  faceit: { label: 'FACEIT-style', text: 'Graphite / orange accents, orange timer' },
  neon: { label: 'NEON', text: 'Purple night, cyan / pink sides, glow, Teko' },
  fpg: { label: 'FPG-style', text: 'Player photos, HP header bars, damage popups, ROUND WINNER takeover' },
  light: { label: 'Light', text: 'Light panels, dark text, Montserrat' },
  starladder: { label: 'StarLadder-style', text: 'Side-colored team blocks with series stars, photo cards with HP on the photo, map tabs over the radar, Oswald' },
  ewc: { label: 'EWC-style', text: 'White slanted score plate, logos only, gold / blue edge-to-edge tiles with photos, alive counter, Barlow Condensed' }
}

const VARS = {
  ct: '--ct', t: '--t', accent: '--accent', bg: '--bg', bgLight: '--bg-light',
  text: '--text', muted: '--muted', onSide: '--on-side', radius: '--radius', money: '--money'
}

const hex = (v) => (/^#?[0-9a-f]{3,8}$/i.test(v || '') ? (v.startsWith('#') ? v : '#' + v) : '')

// cfg = display_settings from the panel
export function applyTheme(cfg) {
  const theme = { ...THEMES.default, ...(THEMES[cfg.theme] || {}) }
  if (hex(cfg.ct_color)) theme.ct = hex(cfg.ct_color)
  if (hex(cfg.t_color)) theme.t = hex(cfg.t_color)
  if (hex(cfg.accent_color)) theme.accent = hex(cfg.accent_color)
  if (cfg.sharp_corners) theme.radius = '0px'
  if (FONTS[cfg.font]) theme.font = cfg.font

  // theme name on <html data-theme="..."> for per-theme shapes in hud.css
  document.documentElement.dataset.theme = THEMES[cfg.theme] ? cfg.theme : 'default'
  const style = document.documentElement.style
  for (const [k, v] of Object.entries(VARS)) style.setProperty(v, theme[k])
  style.setProperty('--font', FONTS[theme.font] || FONTS.rajdhani)
}
