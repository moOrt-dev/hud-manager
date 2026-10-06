// Defuse popup (bottom center, above the observed card): animated C4 + pliers that close while
// the defuse progresses and cut the wire when it succeeds. Shows defuse time vs time to explosion.
// Uses st.bombInfo computed by the top bar (render.js) so both show the same numbers.

// how long "DEFUSED" / "EXPLODED" stays on screen (&hold=1 keeps it, for screenshots)
import { c4Svg, c4Code } from './c4.js'

const RESULT_MS = new URLSearchParams(location.search).has('hold') ? 1e9 : 2600

const svg = `
<svg class="df-art" viewBox="0 0 170 120" aria-hidden="true">
  <!-- wires (the red one gets cut) -->
  <path class="df-wire df-wire-blue" d="M34 58 C30 30, 60 22, 66 58" />
  <path class="df-wire df-wire-yellow" d="M104 58 C110 34, 140 34, 136 58" />
  <g class="df-cut-l"><path class="df-wire df-wire-red" d="M52 58 C52 26, 78 16, 86 16" /></g>
  <g class="df-cut-r"><path class="df-wire df-wire-red" d="M86 16 C94 16, 120 26, 120 58" /></g>
  <!-- detailed C4 (js/c4.js), its own wires off: the wires above are the ones that get cut -->
  ${c4Svg('df', { wires: false, cls: 'df-c4svg', attrs: 'x="22" y="46" width="126" height="76"' })}
  <!-- pliers: local coords, pivot at 0,0, jaws point to -x (the wire), handles to +x.
       Outer transform puts the jaw tips on the cut point (86,16). -->
  <g transform="translate(103 14) rotate(-8)">
    <g class="df-pliers-move">
      <g class="df-jaw df-jaw-a">
        <path class="df-metal" d="M3 -1 L-17 -2.5 Q-19.5 -3.5 -17.5 -6 L1 -6.5 Z" />
        <path class="df-handle" d="M2 -4.5 Q17 -9 41 -14 Q46 -15 45.5 -9.5 Q21 -3 4 1 Z" />
      </g>
      <g class="df-jaw df-jaw-b">
        <path class="df-metal" d="M3 1 L-17 2.5 Q-19.5 3.5 -17.5 6 L1 6.5 Z" />
        <path class="df-handle" d="M2 4.5 Q17 9 41 14 Q46 15 45.5 9.5 Q21 3 4 -1 Z" />
      </g>
      <circle r="3.6" class="df-pivot" />
      <circle r="1.4" class="df-pivot-dot" />
    </g>
  </g>  <circle class="df-flash" cx="86" cy="40" r="10" />
</svg>`

export function createDefusePopup(root) {
  const box = document.createElement('div')
  box.className = 'df'
  box.innerHTML = `
    ${svg}
    <div class="df-info">
      <div class="df-title" data-f="title">DEFUSING</div>
      <div class="df-who"><b data-f="name"></b><span class="df-kit" data-f="kit">KIT</span></div>
      <div class="df-row df-row-defuse"><span>Defuse</span><div class="df-bar"><i data-f="defuseBar"></i></div><b data-f="defuseTime"></b></div>
      <div class="df-row df-row-bomb"><span>Bomb</span><div class="df-bar"><i data-f="bombBar"></i></div><b data-f="bombTime"></b></div>
      <div class="df-verdict" data-f="verdict"></div>
    </div>`
  root.appendChild(box)
  const f = {}
  box.querySelectorAll('[data-f]').forEach((e) => (f[e.dataset.f] = e))

  let phase = '' // '' | 'defusing' | 'defused' | 'exploded'
  let hideTimer = null
  let full = 10

  const setPhase = (p) => {
    if (p === phase) return
    phase = p
    box.dataset.phase = p
    clearTimeout(hideTimer)
    box.classList.toggle('show', !!p)
    if (p === 'defused' || p === 'exploded') {
      f.title.textContent = p === 'defused' ? 'DEFUSED' : 'EXPLODED'
      hideTimer = setTimeout(() => setPhase(''), RESULT_MS)
    }
  }

  const lcd = box.querySelector('.c4-lcd')
  const setCode = (text) => {
    if (lcd.textContent !== text) lcd.textContent = text
  }
  const rowDefuse = f.defuseBar.closest('.df-row')
  const rowBomb = f.bombBar.closest('.df-row')
  const showBomb = (explode) => {
    rowBomb.hidden = explode === null
    if (explode === null) return
    f.bombBar.style.width = `${Math.min(100, (explode / 40) * 100)}%`
    f.bombTime.textContent = explode.toFixed(1)
  }

  // Shown only while someone defuses. A quick "tap" on the bomb must not flash the window:
  // it appears only if the defuse lasts SHOW_DELAY_MS, and after a stop it stays for STOP_GRACE_MS
  // (marked "DEFUSE STOPPED") so a re-grab continues smoothly instead of hiding and showing again.
  const SHOW_DELAY_MS = 300
  const STOP_GRACE_MS = 1100
  let showTimer = null
  let stopTimer = null

  const fill = (st, b) => {
    const defuser = st.players.find((p) => p.steamid === b.player)
    const siteText = b.site ? `${b.site} SITE` : ''
    if (phase !== 'defusing') full = defuser?.defuseKit ? 5 : 10
    f.title.textContent = 'DEFUSING'
    box.dataset.side = defuser?.side || 'CT'
    f.name.textContent = [defuser?.name, siteText].filter(Boolean).join(' · ')
    f.kit.hidden = !defuser?.defuseKit
    rowDefuse.hidden = false
    const left = b.countdown ?? full
    const progress = Math.min(1, Math.max(0, 1 - left / full))
    box.style.setProperty('--p', progress.toFixed(3)) // drives the pliers in CSS
    setCode(c4Code(progress)) // the code is typed in while the defuse goes on
    f.defuseBar.style.width = `${(left / full) * 100}%`
    f.defuseTime.textContent = left.toFixed(1)
    showBomb(b.explode)
    const late = b.explode !== null && b.explode < left
    box.classList.toggle('late', late)
    f.verdict.textContent = late ? 'NO TIME' : ''
  }

  return (st) => {
    const b = st.bombInfo || {}
    if (b.defusing) {
      clearTimeout(stopTimer)
      stopTimer = null
      box.classList.remove('stopped')
      fill(st, b)
      if (phase === 'defusing') return
      if (!showTimer) {
        showTimer = setTimeout(() => {
          showTimer = null
          setPhase('defusing')
        }, SHOW_DELAY_MS)
      }
      return
    }
    // not defusing (any more)
    clearTimeout(showTimer)
    showTimer = null
    if (phase !== 'defusing') return
    if (b.state === 'defused') {
      clearTimeout(stopTimer)
      box.classList.remove('stopped')
      setPhase('defused')
      setCode(c4Code(1))
    } else if (b.state === 'exploded') {
      clearTimeout(stopTimer)
      box.classList.remove('stopped')
      setPhase('exploded')
    } else if (!stopTimer) {
      // defuser let go / died: short grace, then fade out
      box.classList.add('stopped')
      f.title.textContent = 'DEFUSE STOPPED'
      stopTimer = setTimeout(() => {
        stopTimer = null
        box.classList.remove('stopped')
        setPhase('')
      }, STOP_GRACE_MS)
    }
  }
}