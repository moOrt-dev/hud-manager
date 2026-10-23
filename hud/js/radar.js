// Radar: players, bomb, smokes (with countdown), molotov flames, grenades in flight.
// Map images + calibration come from the lexogrine csgo/cs2-react-hud radar (MIT), same as the built-in JTs HUD.
import { vec, uiIcon, weaponIcon } from './state.js'
import { asset } from './api.js'

import { agentOf } from './render.js'

const RADAR = new URL('../radar/', import.meta.url).href
const SIZE = 1024 // radar image size in px; all coordinates below are in this space

const cfg = (x, y, ux, uy) => ({ origin: { x, y }, pxPerUX: ux, pxPerUY: uy })
const MAPS = {
  de_mirage: { config: cfg(645.7196725473384, 340.2921393569175, 0.20118507589946494, -0.20138282875746794) },
  de_cache: { config: cfg(361.7243823603619, 579.553558767951, 0.1830927328891829, -0.17650705879909936) },
  de_dust2: { config: cfg(563.1339320329055, 736.9535330430065, 0.2278315639654376, -0.22776482548619972) },
  de_inferno: { config: cfg(426.51386123945593, 790.7266981544722, 0.2041685571162696, -0.20465735943851654) },
  de_train: { config: cfg(557.7279495268139, 507.83243734804853, 0.22712933753943218, -0.23013108811174968) },
  de_overpass: { config: cfg(927.3988878244819, 343.8221009185496, 0.1923720959212443, -0.19427507725530338) },
  de_ancient: { config: cfg(583.2590342775677, 428.92222042149115, 0.1983512056034216, -0.20108163914549304) },
  de_anubis: { config: cfg(540, 640, 0.1983512056034216, -0.20108163914549304) },
  de_nuke: {
    layers: [
      { config: cfg(473.1284773048749, 190, 0.14376095926926907 * 1.25, -0.14736670935219626 * 1.25), visible: (z) => z >= -495 },
      { config: cfg(100, 570, 0.1436068746398272 * 1.25, -0.14533406508526941 * 1.25), visible: (z) => z < -495 }
    ]
  },
  de_vertigo: {
    layers: [
      { config: cfg(784.4793452283254, 255.42597837029027, 0.19856123172015677, -0.19820052722907044), visible: (z) => z >= 11700 },
      { config: cfg(780.5145858437052, 695.4259783702903, 0.1989615567841087, -0.19820052722907044), visible: (z) => z < 11700 }
    ]
  }
}

// Bombsite centers in radar-image pixels (red site boxes found on the radar images)
const SITES = {
  de_mirage: { A: [553, 781], B: [230, 294] },
  de_cache: { A: [316, 270], B: [353, 832] },
  de_dust2: { A: [817, 170], B: [210, 128] },
  de_inferno: { A: [834, 701], B: [496, 221] },
  de_train: { A: [647, 536], B: [549, 804] },
  de_overpass: { A: [497, 204], B: [721, 324] },
  de_ancient: { A: [303, 262], B: [751, 420] },
  de_anubis: { A: [770, 256], B: [331, 505] },
  de_nuke: { A: [599, 314], B: [207, 743] },
  de_vertigo: { A: [717, 376], B: [331, 99] }
}

// "A" / "B" for a game position (nearest site on the radar), or "" for unknown maps
export function siteOf(mapName, pos) {
  const map = MAPS[mapName]
  const sites = SITES[mapName]
  if (!map || !sites || !pos) return ''
  const [x, y] = project(map, pos)
  const d = (s) => (s[0] - x) ** 2 + (s[1] - y) ** 2
  return d(sites.A) <= d(sites.B) ? 'A' : 'B'
}

const SMOKE_TIME = 21 // seconds the radar cloud drains over: matches how long the smoke stays in the game
const SMOKE_RADIUS = 144 // game units

const layersOf = (m) => m.layers || [{ config: m.config, visible: () => true }]
const configFor = (m, z) => (layersOf(m).find((l) => l.visible(z ?? 0)) || layersOf(m)[0]).config
const project = (m, pos) => {
  const c = configFor(m, pos[2])
  return [c.origin.x + pos[0] * c.pxPerUX, c.origin.y + pos[1] * c.pxPerUY]
}
const unitsToPx = (m, units) => units * Math.abs(layersOf(m)[0].config.pxPerUX)

// Keyed pool of absolutely positioned elements; removes the ones not seen this frame
function pool(parent, create) {
  const items = new Map()
  return {
    get(key) {
      let e = items.get(key)
      if (!e) {
        e = create()
        parent.appendChild(e)
        items.set(key, e)
      }
      e._seen = true
      return e
    },
    sweep() {
      for (const [k, e] of items) {
        if (!e._seen) {
          e.remove()
          items.delete(k)
        } else e._seen = false
      }
    }
  }
}

// --iz (set on .rd-inner) = 1 / clutch zoom: icons keep their on-screen size when the map is zoomed.
// The scale goes after the translate, so it shrinks the icon around its own center, not its position.
const place = (e, [x, y], extra = '', keepSize = true) => {
  e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${extra}${keepSize ? ' scale(var(--iz, 1))' : ''}`
}

// GSI grenade type -> weapon icon (firebomb = molotov for T, incendiary for CT)
const nadeIcon = (type, side) =>
  weaponIcon(
    {
      flashbang: 'weapon_flashbang',
      frag: 'weapon_hegrenade',
      smoke: 'weapon_smokegrenade',
      decoy: 'weapon_decoy',
      firebomb: side === 'CT' ? 'weapon_incgrenade' : 'weapon_molotov'
    }[type] || 'weapon_hegrenade'
  )

// Cartoon icons for the radar (drawn in radar-image pixels, colored by CSS)
const CLOUD_SVG = `<svg class="rd-cloud" viewBox="0 0 64 40" aria-hidden="true"><path d="M14 38 C5 38 1 31 4 25 C1 17 9 11 16 14 C18 5 30 1 37 8 C43 2 55 6 55 15 C62 16 65 25 60 31 C60 36 55 38 50 38 Z" /></svg>`
const FLAME_SVG = `<svg class="rd-flame-ico" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1 C19 10 28 14 28 25 C28 33 22 39 16 39 C10 39 4 33 4 25 C4 19 8 16 10 11 C11 16 13 18 15 18 C13 12 14 6 16 1 Z" /><path class="rd-flame-core" d="M16 18 C18 23 22 25 22 30 C22 34 19 37 16 37 C13 37 10 34 10 30 C10 26 13 25 14 21 C15 24 16 24 16 18 Z" /></svg>`
const BURST_SVG = `<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M30 2 L35 22 L55 12 L40 28 L58 38 L37 37 L40 58 L29 40 L16 56 L20 36 L2 34 L20 25 L8 8 L26 20 Z" /></svg>`

export function createRadar(root) {
  root.innerHTML = `
    <div class="rd">
      <div class="rd-inner">
        <img class="rd-map" />
        <div class="rd-layer rd-effects"></div>
        <div class="rd-layer rd-bursts"></div>
        <div class="rd-layer rd-players"></div>
      </div>
    </div>`
  const box = root.querySelector('.rd')
  const inner = root.querySelector('.rd-inner')
  const img = root.querySelector('.rd-map')
  const burstLayer = root.querySelector('.rd-bursts')
  const effects = pool(root.querySelector('.rd-effects'), () => document.createElement('div'))
  const players = pool(root.querySelector('.rd-players'), () => {
    const e = document.createElement('div')
    e.className = 'rd-player'
    e.innerHTML = '<i class="rd-dir"></i><img class="rd-photo" alt="" /><span class="rd-num"></span><i class="rd-badge"></i>'
    return e
  })
  const angles = {} // steamid -> continuous angle, so rotation never spins through 360
  let lastNades = {} // id -> { type, xy } to pop a burst when a flash / HE disappears (= exploded)
  const nadeSides = new Map() // grenade id -> 'CT' | 'T' (thrower's side, kept for the grenade's whole life)
  let burstDone = new Set() // grenades that already got their burst
  let mapName = ''

  const burst = (type, xy) => {
    const e = document.createElement('div')
    e.className = `rd-burst rd-burst-${type}`
    e.innerHTML = BURST_SVG
    place(e, xy)
    burstLayer.appendChild(e)
    setTimeout(() => e.remove(), 900)
  }

  // Clutch zoom: in a 1 vs N the radar flies to the area of the players still alive (+ a planted bomb)
  // and follows them; back to the whole map when the clutch ends. The view only moves on a real change,
  // so the CSS transition does not restart on every GSI frame.
  let view = { x: 0, y: 0, side: SIZE }
  function zoomView(st, map, conf) {
    const live = /live|bomb|defuse/.test(st.phase)
    const alive = st.players.filter((p) => p.hp > 0 && p.pos)
    const ct = alive.filter((p) => p.side === 'CT').length
    const t = alive.length - ct
    const clutch = live && !conf.no_clutch_zoom && ((ct === 1 && t >= 1) || (t === 1 && ct >= 1))
    if (!clutch) return { x: 0, y: 0, side: SIZE }
    const pts = alive.map((p) => project(map, p.pos))
    const bp = st.bomb && /planted|defusing/.test(st.bomb.state) && vec(st.bomb.position)
    if (bp) pts.push(project(map, bp))
    const xs = pts.map((q) => q[0])
    const ys = pts.map((q) => q[1])
    const pad = 170
    let side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 2 * pad
    side = Math.min(SIZE, Math.max(460, side)) // at most ~2.2x closer
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2
    const clamp = (v) => Math.min(SIZE - side, Math.max(0, v))
    return { x: clamp(cx - side / 2), y: clamp(cy - side / 2), side }
  }

  return (st, conf) => {
    const map = MAPS[st.mapName]
    const size = Number(conf.radar_size) || 380
    box.hidden = !map || !!conf.hide_radar
    if (!map) return
    box.style.width = box.style.height = `${size}px`
    const next = zoomView(st, map, conf)
    if (Math.abs(next.side - view.side) > view.side * 0.08 || Math.hypot(next.x - view.x, next.y - view.y) > 30 || (next.side === SIZE) !== (view.side === SIZE)) view = next
    const z = SIZE / view.side
    inner.style.setProperty('--iz', (1 / z).toFixed(4))
    inner.style.transform = `scale(${((size / SIZE) * z).toFixed(4)}) translate(${(-view.x).toFixed(1)}px, ${(-view.y).toFixed(1)}px)`
    box.classList.toggle('photos', !!conf.radar_avatars)
    if (mapName !== st.mapName) {
      // new map / first frame: jump to the view at once, animate only later changes
      inner.classList.remove('anim')
      setTimeout(() => inner.classList.add('anim'), 100)
      view = { x: 0, y: 0, side: SIZE }
      mapName = st.mapName
      img.src = `${RADAR}${st.mapName}.png`
      lastNades = {}
      burstDone = new Set()
    }

    // --- players ---
    // standing inside a burning smoke: the dot is drawn semi-transparent (2D distance in game units)
    const smokes = Object.values(st.grenades)
      .filter((g) => g.type === 'smoke' && g.effecttime !== undefined && g.effecttime !== '' && Number(g.effecttime) < SMOKE_TIME)
      .map((g) => vec(g.position))
      .filter(Boolean)
    const inSmoke = (pos) => smokes.some((s) => Math.hypot(s[0] - pos[0], s[1] - pos[1]) < SMOKE_RADIUS)
    const defuserId = st.bomb?.state === 'defusing' ? st.bomb.player : null
    for (const p of st.players) {
      if (!p.pos) continue
      const e = players.get(p.steamid)
      const dead = p.hp <= 0
      e.dataset.side = p.side
      e.classList.toggle('dead', dead)
      e.classList.toggle('observed', p.observed)
      e.classList.toggle('bomb', p.hasBomb)
      e.classList.toggle('flashed', p.flashed > 35)
      e.classList.toggle('kit', p.defuseKit && !dead)
      e.classList.toggle('defusing', p.steamid === defuserId)
      e.classList.toggle('in-smoke', !dead && inSmoke(p.pos))
      e.querySelector('.rd-num').textContent = dead ? '' : (p.slot ?? '')
      const photo = e.querySelector('.rd-photo')
      const src = p.avatar ? asset(p.avatar) : agentOf(p.side, p.steamid)
      if (conf.radar_avatars && photo.getAttribute('src') !== src) photo.src = src

      let angle = angles[p.steamid] ?? 0
      if (p.forward && !dead) {
        const c = configFor(map, p.pos[2])
        const target = (Math.atan2(p.forward[1] * Math.sign(c.pxPerUY), p.forward[0] * Math.sign(c.pxPerUX)) * 180) / Math.PI
        angle += ((((target - angle) % 360) + 540) % 360) - 180
        angles[p.steamid] = angle
      }
      e.querySelector('.rd-dir').style.transform = `rotate(${angle}deg)`
      place(e, project(map, p.pos))
    }
    players.sweep()

    // --- grenades ---
    const sideOf = (steamid) => st.players.find((p) => p.steamid === steamid)?.side || ''
    const nowNades = {}
    for (const [id, g] of Object.entries(st.grenades)) {
      // the thrower's side is remembered per grenade: GSI may drop / change the owner while the smoke burns
      const side = sideOf(g.owner) || nadeSides.get(id) || ''
      if (side) nadeSides.set(id, side)
      if (g.type === 'inferno') {
        // molotov / incendiary: a flickering flame on every fire point
        for (const [fid, fpos] of Object.entries(g.flames || {})) {
          const pos = vec(fpos)
          if (!pos) continue
          const e = effects.get(`${id}_${fid}`)
          if (e.className !== 'rd-flame') {
            e.className = 'rd-flame'
            e.innerHTML = FLAME_SVG
            e.style.setProperty('--delay', `${-(Math.random() * 0.8).toFixed(2)}s`)
          }
          e.dataset.side = side
          place(e, project(map, pos))
        }
        continue
      }
      const pos = vec(g.position)
      if (!pos) continue
      const xy = project(map, pos)
      // a flash / HE that already went off stays in GSI for a while -> hide it, burst once
      const life = Number(g.lifetime || 0)
      if ((g.type === 'flashbang' && life >= 1.45) || (g.type === 'frag' && life >= 1.6)) {
        if (!burstDone.has(id)) {
          burstDone.add(id)
          burst(g.type, xy)
        }
        continue
      }
      // a smoke that has burnt out: gone from the radar (effecttime is only sent once it has detonated)
      const detonated = g.effecttime !== undefined && g.effecttime !== ''
      if (g.type === 'smoke' && detonated && Number(g.effecttime) >= SMOKE_TIME) continue
      nowNades[id] = { type: g.type, xy }
      const e = effects.get(id)
      e.dataset.side = side
      const effect = Number(g.effecttime || 0)
      if (g.type === 'smoke' && effect > 0) {
        // smoke: area disc with a draining countdown + a cartoon cloud in the thrower's color
        if (e.className !== 'rd-smoke') {
          e.className = 'rd-smoke'
          // outline always whole, the filled cloud drains from the top (CSS clip by --left)
          e.innerHTML = `<i class="rd-smoke-area"></i>${CLOUD_SVG.replace('rd-cloud', 'rd-cloud rd-cloud-outline')}${CLOUD_SVG}`
        }
        e.style.setProperty('--r', `${unitsToPx(map, SMOKE_RADIUS)}px`)
        e.style.setProperty('--left', Math.max(0, 1 - effect / SMOKE_TIME).toFixed(3))
      } else {
        // grenade in flight (or a decoy on the ground): icon of its type in the thrower's color
        const cls = `rd-nade rd-nade-${g.type}`
        if (e.className !== cls) {
          e.className = cls
          e.innerHTML = `<i class="ic rd-nade-ico" style="--src:url('${nadeIcon(g.type, side)}')"></i>`
        }
      }
      place(e, xy, '', !(g.type === 'smoke' && effect > 0)) // a smoke keeps its real area on the map
    }
    // flash / HE vanished from GSI = it went off: short burst at its last position
    for (const [id, n] of Object.entries(lastNades)) {
      if (!nowNades[id] && !burstDone.has(id) && (n.type === 'flashbang' || n.type === 'frag')) burst(n.type, n.xy)
    }
    lastNades = nowNades
    for (const id of nadeSides.keys()) if (!st.grenades[id]) nadeSides.delete(id)

    // --- bomb (when not carried: dropped / planted / defusing) ---
    const bomb = st.bomb
    const bombPos = bomb && bomb.state !== 'carried' && vec(bomb.position)
    if (bombPos) {
      const e = effects.get('bomb')
      // dark disc with a red ring + the C4 icon inside (a mask on the element itself would cut off any outline)
      e.className = `rd-bomb ${bomb.state}`
      if (!e.firstChild) e.innerHTML = `<i class="ic" style="--src:url('${uiIcon('icon_c4_default')}')"></i>`
      place(e, project(map, bombPos))
    }
    effects.sweep()
  }
}