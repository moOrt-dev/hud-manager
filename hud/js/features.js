// Killfeed, freezetime economy, sponsor carousel, map veto screen.
import { asset } from './api.js'
import { weaponIcon, uiIcon } from './state.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const icon = (src, cls = '') => (src ? `<i class="ic ${cls}" style="--src:url('${src}')"></i>` : '')
const MAPS_DIR = new URL('../maps/', import.meta.url).href
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`

// ---------- Killfeed ----------
// GSI has no kill events, so kills are derived by diffing match_stats between updates:
// killers = players whose kills went up, victims = players whose deaths went up.
const KILL_TTL = 7000
const KILL_MAX = 5

// ---------- Jump kills (space or a fall from a ledge) ----------
// GSI has no "on ground" flag, so the killer's height around the kill decides (see isAirborne).
// h: [[ms, z], ...] sorted by time; true if the player was in the air at `ms`.
// GSI arrives in bursts (two frames with one time stamp, 6 units in 10 ms), so instead of fitting the exact
// parabola the flight is judged on a coarser scale (a live recording: stair steps are humps of <= 15 units):
//  - jump: a hump >= 30 units up AND >= 30 down, the whole flight <= 1.1 s (a CS2 jump: ~55 units, ~0.7 s);
//  - fall from a ledge: >= 40 units down in <= 0.5 s, speeding up (2nd half of the drop >= 1.5x the 1st, ~2x in free fall;
//    walking down stairs goes evenly).
// The kill has to be inside the flight.
export function isAirborne(h, ms) {
  const span = (from, to) => h.filter(([t]) => t >= from && t <= to)
  // jump: the highest point near the kill and the levels before / after it
  const near = span(ms - 700, ms + 700)
  if (near.length >= 5) {
    const [apexT, apexZ] = near.reduce((m, p) => (p[1] > m[1] ? p : m))
    const before = span(apexT - 650, apexT - 40)
    const after = span(apexT + 40, apexT + 750)
    if (before.length && after.length) {
      const z0 = Math.min(...before.map(([, z]) => z))
      const z1 = Math.min(...after.map(([, z]) => z))
      if (apexZ - z0 >= 30 && apexZ - z1 >= 30) {
        const up = [...before].reverse().find(([, z]) => z <= z0 + 3) // take-off
        const down = after.find(([, z]) => z <= z1 + 3) // landing
        if (up && down && down[0] - up[0] <= 1100 && ms >= up[0] - 40 && ms <= down[0] + 40) return true
      }
    }
  }
  // fall from a ledge: look for the top of the drop before the kill and the bottom after it
  const pre = span(ms - 500, ms)
  const post = span(ms, ms + 500)
  if (pre.length >= 2 && post.length >= 2) {
    // the drop itself: from the last point at the top level to the first one at the bottom level
    const maxZ = Math.max(...pre.map(([, z]) => z))
    const minZ = Math.min(...post.map(([, z]) => z))
    const [botT, botZ] = post.find(([, z]) => z <= minZ + 1)
    // start of the drop: the last point still at the top level (it can be after the kill: then he
    // was still standing when he killed)
    const [topT, topZ] = span(ms - 500, botT).reverse().find(([, z]) => z >= maxZ - 2)
    const drop = maxZ - minZ
    // a jump of the position between two frames is a teleport (round restart, demo seek), not a fall
    const leap = h.some(([t, z], i) => i && t > topT && t <= botT && Math.abs(z - h[i - 1][1]) > 30)
    if (drop >= 40 && botT - topT <= 500 && topT <= ms && !leap) {
      const midT = (topT + botT) / 2
      const mid = h.reduce((m, p) => (Math.abs(p[0] - midT) < Math.abs(m[0] - midT) ? p : m))
      const first = topZ - mid[1]
      const second = mid[1] - botZ
      if (second >= 1.5 * Math.max(first, 1)) return true
    }
  }
  return false
}

export function createKillfeed(root) {
  const list = document.createElement('div')
  list.className = 'kf'
  root.appendChild(list)

  let prev = null // steamid -> snapshot
  let prevMap = ''

  const snap = (p) => ({
    kills: p.stats.kills ?? 0,
    deaths: p.stats.deaths ?? 0,
    assists: p.stats.assists ?? 0,
    hs: p.roundKillHs ?? 0,
    weapon: (p.active && p.active.type !== 'Grenade' ? p.active : p.primary || p.secondary)?.name,
    side: p.side,
    name: p.name,
    hp: p.hp,
    gun: p.active?.name,
    ammo: p.active?.ammo_clip
  })

  const add = ({ killer, victim, weapon, headshot, assister }) => {
    const e = document.createElement('div')
    e.className = 'kf-item'
    e.innerHTML = `
      ${killer ? `<span class="kf-name" data-side="${killer.side}">${esc(killer.name)}</span>` : ''}
      ${assister ? `<span class="kf-plus">+</span><span class="kf-name kf-assist" data-side="${assister.side}">${esc(assister.name)}</span>` : ''}
      ${icon(weapon ? weaponIcon(weapon) : uiIcon('suicide'), 'kf-weapon')}
      ${headshot ? icon(uiIcon('headshot'), 'kf-hs') : ''}
      <span class="kf-name" data-side="${victim.side}">${esc(victim.name)}</span>`
    list.append(e) // top to bottom: the newest kill goes under the previous ones
    requestAnimationFrame(() => e.classList.add('show'))
    setTimeout(() => {
      e.classList.remove('show')
      setTimeout(() => e.remove(), 400)
    }, KILL_TTL)
    while (list.children.length > KILL_MAX) list.firstElementChild.remove() // drop the oldest (top)
    return e
  }

  const zHist = {} // steamid -> [[ms, z], ...] for the last ~2 s (jump kills, see isAirborne)
  const airborne = (killerId, ms) => isAirborne(zHist[killerId] || [], ms)
  function markJump(row, killerId, ms) {
    setTimeout(() => {
      if (airborne(killerId, ms) && row.isConnected) {
        row.querySelector('.kf-weapon')?.insertAdjacentHTML('beforebegin', icon(uiIcon('wing'), 'kf-wing')) // wing on the weapon, as in the game
      }
    }, 800) // the landing has to be known: a kill right after the take-off lands ~0.7 s later
  }
  // Grenade kills: the weapon in hand is wrong for them (after an HE the killer already holds a knife / rifle).
  // Remember every player's last HE (position, time) and fire, and credit the kill to the grenade
  // when it went off right next to the victim just before the kill.
  const frags = {} // owner steamid -> { at, pos }
  const fires = {} // owner steamid -> { at, pts: [[x,y,z], ...] }
  const near = (a, b, r) => a && b && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < r
  const vec3 = (s) => (typeof s === 'string' ? s.split(',').map(Number) : null)
  // a killer who just fired his gun killed with it, not with a grenade
  const shotAt = {} // steamid -> ms of the last shot (ammo in the clip of the same gun went down)
  function grenadeWeapon(killer, victim, ms) {
    if (ms - (shotAt[killer.id] || 0) < 600) return ''
    const f = frags[killer.id]
    if (f && ms - f.at < 1500 && near(f.pos, victim.pos, 400)) return 'weapon_hegrenade'
    // fire finishes off slowly: only a victim who was already low (<= 30 hp) and stood in the killer's fire
    const fire = fires[killer.id]
    if (fire && ms - fire.at < 1500 && victim.burning && victim.hpBefore <= 30 && fire.pts.some((q) => near(q, victim.pos, 250)))
      return killer.side === 'CT' ? 'weapon_incgrenade' : 'weapon_molotov'
    return ''
  }

  return (st) => {
    const ms = Date.now()
    for (const g of Object.values(st.grenades || {})) {
      if (!g.owner) continue
      if (g.type === 'frag' && g.position) frags[g.owner] = { at: ms, pos: vec3(g.position) }
      if (g.type === 'inferno') fires[g.owner] = { at: ms, pts: Object.values(g.flames || {}).map(vec3) }
    }
    for (const p of st.players) {
      if (!p.pos || p.hp <= 0) continue
      const h = (zHist[p.steamid] ||= [])
      h.push([ms, p.pos[2]])
      while (h.length && ms - h[0][0] > 2000) h.shift()
    }
    const now = Object.fromEntries(st.players.map((p) => [p.steamid, { ...snap(p), pos: p.pos, burning: p.burning }]))
    if (!prev || st.mapName !== prevMap) {
      prev = now
      prevMap = st.mapName
      return
    }
    const killers = []
    const victims = []
    const assisters = []
    for (const [id, cur] of Object.entries(now)) {
      const old = prev[id]
      if (!old) continue
      const dk = cur.kills - old.kills
      const hs = Math.max(0, cur.hs - old.hs)
      for (let i = 0; i < dk; i++) killers.push({ ...cur, id, headshot: i < hs, weapon: cur.weapon || old.weapon })
      if (cur.deaths > old.deaths) victims.push({ ...cur, id })
      if (cur.assists > old.assists) assisters.push({ ...cur, id })
    }
    const before = prev
    for (const [id, cur] of Object.entries(now)) {
      const old = before[id]
      if (old && cur.gun && cur.gun === old.gun && cur.ammo < old.ammo) shotAt[id] = ms
    }
    prev = now
    // Demo seek / reconnect produce huge jumps — don't flood the feed
    if (victims.length > 5 || killers.length > 5) return

    for (const victim of victims) {
      const i = killers.findIndex((k) => k.side !== victim.side)
      const killer = i >= 0 ? killers.splice(i, 1)[0] : killers.shift() // teamkill fallback
      const assister = killer && assisters.find((a) => a.side === killer.side && a.id !== killer.id)
      // victim's position from the frame before (at death GSI may already move him to a respawn / spectator spot)
      const v = { ...victim, pos: before[victim.id]?.pos || victim.pos, burning: victim.burning || before[victim.id]?.burning, hpBefore: before[victim.id]?.hp ?? 100 }
      const nade = killer ? grenadeWeapon(killer, v, ms) : ''
      // no killer and the bomb went off: C4 instead of the "suicide" icon
      const weapon = nade || killer?.weapon || (!killer && st.bomb?.state === 'exploded' ? 'weapon_c4' : '')
      const row = add({ killer, victim, weapon, headshot: !nade && killer?.headshot, assister })
      if (killer && !nade) markJump(row, killer.id, ms)
    }
  }
}

// ---------- Economy (freezetime) ----------
const buyType = (team) => {
  const alive = team.players.length || 1
  const avg = team.players.reduce((s, p) => s + p.money + p.equipValue, 0) / alive
  return avg < 2000 ? 'ECO' : avg < 3800 ? 'HALF BUY' : 'FULL BUY'
}

export function createEconomy(root) {
  const box = document.createElement('div')
  box.className = 'eco'
  root.appendChild(box)
  // eco-name / eco-util / eco-vals: the PGL-style panel (team name bar, grenade counts by type,
  // big loss bonus + equipment value); hidden in the other themes (hud.css)
  const col = (pos) => `
    <div class="eco-team ${pos}" data-f="${pos}">
      <div class="eco-name" data-f="${pos}Name"></div>
      <div class="eco-util" data-f="${pos}Util"></div>
      <div class="eco-vals">
        <div><b data-f="${pos}LossBig"></b><small>Loss bonus</small></div>
        <div><b data-f="${pos}EquipBig"></b><small>Equipment value</small></div>
      </div>
      <div class="eco-buy" data-f="${pos}Buy"></div>
      <div class="eco-row"><span>Team money</span><b data-f="${pos}Money"></b></div>
      <div class="eco-row"><span>Equipment</span><b data-f="${pos}Equip"></b></div>
      <div class="eco-row"><span>Loss bonus</span><b data-f="${pos}Loss"></b></div>
    </div>`
  box.innerHTML = col('left') + col('right')
  const f = {}
  box.querySelectorAll('[data-f]').forEach((e) => (f[e.dataset.f] = e))

  // Appears economy_delay seconds (default 2.5) after freezetime starts, fades out when it ends.
  // A timer is used because GSI may not send an update exactly at that moment.
  let inFreeze = false
  let timer = null
  // #hud.eco-show also reveals the loss-bonus strip under the top bar (see hud.css)
  const hud = document.getElementById('hud')
  const setShown = (on) => {
    box.classList.toggle('show', on)
    hud.classList.toggle('eco-show', on)
  }

  return (st, cfg) => {
    const freeze = st.phase === 'freezetime' && !cfg.hide_economy
    if (freeze && !inFreeze) {
      const delay = Number(cfg.economy_delay)
      timer = setTimeout(() => setShown(true), (Number.isFinite(delay) && cfg.economy_delay !== '' ? delay : 2.5) * 1000)
    } else if (!freeze && inFreeze) {
      clearTimeout(timer)
      setShown(false)
    }
    inFreeze = freeze
    if (!freeze) return
    for (const pos of ['left', 'right']) {
      const t = st[pos]
      f[pos].dataset.side = t.side
      f[pos + 'Buy'].textContent = buyType(t)
      f[pos + 'Money'].textContent = money(t.players.reduce((s, p) => s + p.money, 0))
      f[pos + 'Equip'].textContent = money(t.players.reduce((s, p) => s + p.equipValue, 0))
      f[pos + 'Loss'].textContent = money(t.lossBonus)
      f[pos + 'Name'].textContent = t.name
      f[pos + 'LossBig'].textContent = money(t.lossBonus)
      f[pos + 'EquipBig'].textContent = money(t.players.reduce((s, p) => s + p.equipValue, 0))
      // grenade counts by type (a flashbang can be carried twice: ammo_reserve)
      const n = { molotov: 0, smokegrenade: 0, flashbang: 0, hegrenade: 0 }
      for (const p of t.players)
        for (const g of p.grenades) {
          const k = String(g.name || '').replace('weapon_', '').replace('incgrenade', 'molotov')
          if (k in n) n[k] += k === 'flashbang' ? Math.max(1, Number(g.ammo_reserve) || 1) : 1
        }
      const total = Object.values(n).reduce((a, b) => a + b, 0)
      const grade = total <= 4 ? 'Poor' : total <= 9 ? 'Good' : 'Full'
      const html =
        `<span class="eco-grade">${grade}<small>utility</small></span>` +
        Object.entries(n)
          .map(([k, v]) => `<span class="eco-n ${v ? '' : 'zero'}">${v}x${icon(weaponIcon(k === 'molotov' && t.side === 'CT' ? 'incgrenade' : k))}</span>`)
          .join('')
      if (f[pos + 'Util'].dataset.key !== html) {
        f[pos + 'Util'].dataset.key = html
        f[pos + 'Util'].innerHTML = html
      }
    }
  }
}

// ---------- Sponsors carousel ----------
export function createSponsors(root) {
  const box = document.createElement('div')
  box.className = 'sp'
  root.appendChild(box)
  let key = ''
  let rotate = null
  let index = 0
  let prevPhase = ''
  let roundUntil = 0 // ms timestamp: shown until then after a round starts
  let hideTimer = null

  // When on screen: always during warmup, and sponsor_round seconds (default 8) when a round starts
  // (freezetime begins). Several logos take turns every sponsor_interval seconds while the block is shown.
  // The card's width follows the shape of the logo on screen (square logo -> square card, wide banner ->
  // wide card, never wider than the sponsor area); the width change is animated in CSS
  const PAD_X = 24
  const PAD_Y = 16
  const fit = () => {
    const img = box.children[index]
    if (!img) return
    if (!img.naturalWidth) {
      img.addEventListener('load', fit, { once: true })
      return
    }
    const area = root.clientWidth || 300
    const h = Math.max(10, (root.clientHeight || box.clientHeight) - PAD_Y)
    const natural = Math.round((h * img.naturalWidth) / img.naturalHeight) + PAD_X
    const w = Math.min(area, natural)
    box.style.width = `${w}px`
    // a banner wider than the area: the card gets lower instead of leaving empty bands above / below
    box.style.height = natural > area ? `${Math.round(((area - PAD_X) * img.naturalHeight) / img.naturalWidth) + PAD_Y}px` : ''
  }
  // area resized (radar size changed) -> fit again
  new ResizeObserver(fit).observe(root)

  const next = () => {
    const imgs = box.children
    if (imgs.length < 2) return
    imgs[index].classList.remove('show')
    index = (index + 1) % imgs.length
    imgs[index].classList.add('show')
    fit()
  }

  return (cfg, st) => {
    const urls = (Array.isArray(cfg.sponsors) ? cfg.sponsors : []).filter(Boolean)
    const seconds = Math.max(2, Number(cfg.sponsor_interval) || 8)
    const k = urls.join('|') + seconds
    if (k !== key) {
      key = k
      clearInterval(rotate)
      index = 0
      box.innerHTML = urls.map((u, i) => `<img src="${esc(asset(u))}" class="${i === 0 ? 'show' : ''}" />`).join('')
      box.hidden = !urls.length
      if (urls.length > 1) rotate = setInterval(next, seconds * 1000)
      fit()
    }
    const phase = st?.phase || ''
    if (phase === 'freezetime' && prevPhase !== 'freezetime') {
      const roundSecs = cfg.sponsor_round === '' || cfg.sponsor_round == null ? 8 : Math.max(0, Number(cfg.sponsor_round) || 0)
      roundUntil = Date.now() + roundSecs * 1000
      // re-render when the time is up even if no game update arrives
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => box.classList.add('off'), roundSecs * 1000)
    }
    prevPhase = phase
    // panel: sponsor_always -> on screen all the time; otherwise warmup + sponsor_round seconds at round start
    const on = !!cfg.sponsor_always || phase === 'warmup' || Date.now() < roundUntil
    box.classList.toggle('off', !on)
  }
}

// ---------- Map veto ----------
export function createVeto(root) {
  const box = document.createElement('div')
  box.className = 'veto'
  root.appendChild(box)
  let key = ''

  const render = (st, match, teams) => {
    const vetos = match?.vetos || []
    const teamName = (id) => teams[id]?.shortName || teams[id]?.name || ''
    const current = st?.mapName
    const rows = vetos
      .filter((v) => v.mapName)
      .map((v) => {
        const type = v.type === 'decider' ? 'DECIDER' : v.type === 'ban' ? 'BAN' : 'PICK'
        const by = v.type === 'decider' ? '' : teamName(v.teamId)
        const score = v.score ? Object.entries(v.score) : []
        // finished map: "WINNER 13 : 8" (winner's rounds first), live map: LIVE
        let scoreText = v.mapName === current && v.type !== 'ban' && !v.mapEnd ? 'LIVE' : ''
        if (v.mapEnd && score.length === 2) {
          const [a, b] = [...score].sort((x, y) => Number(y[1]) - Number(x[1]))
          const winnerId = v.winner || a[0]
          const w = score.find((s) => s[0] === winnerId) || a
          const l = score.find((s) => s[0] !== w[0]) || b
          scoreText = `${teamName(w[0])} ${w[1]} : ${l[1]}`
        }
        const cls = [v.type, v.mapName === current && v.type !== 'ban' ? 'current' : '', v.mapEnd ? 'done' : '']
        return `
          <div class="veto-row ${cls.join(' ')}" style="--img:url('${MAPS_DIR}${v.mapName}.png')">
            <span class="veto-type">${type}</span>
            <span class="veto-map">${esc(v.mapName.replace(/^de_/, '').toUpperCase())}</span>
            <span class="veto-by">${esc(by)}${v.type === 'pick' && v.side && v.side !== 'NO' ? ` · ${v.side} side` : ''}</span>
            <span class="veto-score">${esc(scoreText)}</span>
          </div>`
      })
    const left = teams[match?.left?.id]
    const right = teams[match?.right?.id]
    return `
      <div class="veto-head">
        <span>${esc(left?.name || '')}</span>
        <b>${match?.left?.wins ?? 0} : ${match?.right?.wins ?? 0}</b>
        <span>${esc(right?.name || '')}</span>
      </div>
      <div class="veto-title">MAP VETO · ${(match?.matchType || '').toUpperCase()}</div>
      ${rows.join('') || '<div class="veto-empty">No veto in the current match</div>'}`
  }

  return (st, ctx, visible) => {
    box.classList.toggle('show', visible)
    if (!visible) return
    const html = render(st, ctx.match, ctx.teams)
    if (html !== key) {
      key = html
      box.innerHTML = html
    }
  }
}

// ---------- Map series strip above the radar: "ANCIENT ▶ (logo) MIRAGE ▶ (logo) DUST2" ----------
// Picks + decider of the current match in veto order; logo = team that picked the map,
// finished maps show their score, the map being played is highlighted.
export function createSeries(root) {
  const box = document.createElement('div')
  box.className = 'series'
  root.appendChild(box)
  let key = ''
  return (st, ctx, cfg) => {
    const maps = (ctx.match?.vetos || []).filter((v) => v.mapName && v.type !== 'ban')
    const show = maps.length >= 2 && !cfg.hide_series
    document.getElementById('hud').classList.toggle('has-series', show)
    box.hidden = !show
    if (!show) return
    const logo = (id) => {
      const t = ctx.teams[id]
      return t?.logo ? `<img src="${esc(asset(t.logo))}" alt="" />` : ''
    }
    const html = maps
      .map((v) => {
        const current = v.mapName === st?.mapName
        const score = v.mapEnd && v.score ? Object.values(v.score).join(':') : ''
        return `<span class="series-map ${current ? 'current' : ''} ${v.mapEnd ? 'done' : ''}">
          ${v.type === 'pick' ? logo(v.teamId) : ''}${esc(v.mapName.replace(/^de_/, '').toUpperCase())}${score ? `<small>${score}</small>` : ''}
        </span>`
      })
      .join('<i class="series-sep">▶</i>')
    if (html !== key) {
      key = html
      box.innerHTML = html
    }
  }
}
