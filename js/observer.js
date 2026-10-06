// Auto observer: picks the player worth watching from the GSI data and switches the CS2 camera.
// Commands go to the manager: POST /api/huds/newHud/action { action: 'telnet', data: { cmd, port } },
// the manager passes them to the CS2 console (CS2 started with -netconport <port>).
// Settings live in config.observer (control page, "Auto camera"); status goes back to the
// control page as hud_action { action: 'obsStatus', data }.
import { BASE } from './api.js'

const ACTION_URL = `${BASE}/api/huds/newHud/action`
// mode: 'auto' = switches the camera, 'suggest' = only reports who it would pick (control page), sends nothing
// helper: use the key helper (helper/newhud-key-helper.ps1) when the CS2 console is closed (method 'auto' / 'keys')
export const OBSERVER_DEFAULTS = { auto: false, mode: 'auto', hold: 4, manual_pause: 8, port: 2020, method: 'auto', first_person: true, helper: true }
const STEAM64_BASE = 76561197960265728n

const post = (action, data) =>
  fetch(ACTION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) })

const vec = (s) => (typeof s === 'string' ? s.split(',').map(Number) : null)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * 0.5) // height counts less
const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v))

export function createObserver() {
  let cfg = { ...OBSERVER_DEFAULTS }
  const hist = {} // steamid -> { hp, kills, weapon, ammo, hurtAt, killAt, shotAt }
  let target = null // steamid the last command switched to
  let sentAt = 0
  let switchedAt = 0 // when the camera got onto the current player
  let deadSince = 0 // the watched player died at
  let pausedUntil = 0 // the operator switched by hand -> hands off for a while
  let hand = false // hotkey "manual control": hands off until pressed again
  let clockVal // round clock of the last frame and when it last changed (a paused demo)
  let clockAt = 0
  let lastObserved
  let status = {}
  let statusSentAt = 0

  function setStatus(next) {
    const key = JSON.stringify(next)
    if (key === JSON.stringify(status) && Date.now() - statusSentAt < 10000) return
    status = next
    statusSentAt = Date.now()
    post('obsStatus', { ...next, at: Date.now() }).catch(() => {})
  }

  // spec_player "<nick>" by default. spec_lock_to_accountid only when chosen in the control page:
  // it LOCKS the camera on the player, so the operator's own keys may stop working while it holds.
  // A nick the console cannot take (quotes, \, ;) -> '' = that player is skipped
  // 'auto' (default): the CS2 console while it answers; when it does not (CS2 without -insecure keeps
  // -netconport closed), the key helper, and the console is tried again every 20 s
  let consoleDownAt = 0
  const viaKeys = () => cfg.method === 'keys' || (cfg.method === 'auto' && cfg.helper !== false && Date.now() - consoleDownAt < 20000)

  function command(p) {
    // keys: no console at all, the key helper presses the observer slot number (1..9, 0)
    if (viaKeys()) return p.observer_slot >= 0 && p.observer_slot <= 9 ? `key ${p.observer_slot}` : ''
    const lines = []
    const name = String(p.name || '')
    if (cfg.method !== 'accountid' && (!name || /["\\;]/.test(name))) return ''
    if (cfg.method === 'accountid') {
      try {
        lines.push(`spec_lock_to_accountid ${BigInt(p.steamid) - STEAM64_BASE}`)
      } catch {
        return ''
      }
    } else lines.push(`spec_player "${name}"`)
    if (cfg.first_person) lines.push('spec_mode 1')
    return lines.join('\n')
  }

  let roundInfo = {} // { round, clock } of the current frame, for the decision log in the control page
  let helperAt = 0 // last heartbeat of the key helper (helper/newhud-key-helper.ps1)

  async function switchTo(p, reason, now) {
    const cmd = command(p)
    if (!cmd) return
    if (cfg.mode === 'suggest') {
      // as if the camera had switched: the next decisions start from this player
      target = p.steamid
      sentAt = switchedAt = now
      return setStatus({ state: 'suggest', name: p.name, reason, ...roundInfo })
    }
    // the same player again: the previous command did not take (wrong name?) -> retry slowly
    if (p.steamid === target && now - sentAt < 4000) return
    target = p.steamid
    sentAt = now
    const byKeys = () => {
      if (cfg.helper === false) return setStatus({ state: 'helperoff' })
      if (Date.now() - helperAt > 15000) return setStatus({ state: 'nohelper' })
      post('obsKey', { slot: p.observer_slot }).catch(() => {})
      return setStatus({ state: 'on', name: p.name, reason, via: 'keys', ...roundInfo })
    }
    if (viaKeys()) return byKeys()
    try {
      const res = await post('telnet', { cmd, port: num(cfg.port, 2020) })
      const body = await res.json().catch(() => ({}))
      // a manager without the telnet action just broadcasts the action and answers { ok: true }
      if (res.ok && !('out' in body)) return setStatus({ state: 'nopatch' })
      if (!res.ok) {
        // CS2 does not answer on the telnet port: in 'auto' switch by keys right away
        if (cfg.method === 'auto' && cfg.helper !== false && res.status === 502 && p.observer_slot >= 0 && p.observer_slot <= 9) {
          consoleDownAt = Date.now()
          return byKeys()
        }
        return setStatus({ state: 'error', error: body.error || String(res.status) })
      }
      setStatus({ state: 'on', name: p.name, reason, via: 'console', ...roundInfo })
    } catch (e) {
      setStatus({ state: 'error', error: e.message })
    }
  }

  // per-player memory: damage taken, kills and shots (ammo in the clip going down) with timestamps
  function track(id, p, now) {
    const s = p.state || {}
    const active = Object.values(p.weapons || {}).find((w) => w.state === 'active' || w.state === 'reloading')
    const h = (hist[id] ||= { hp: s.health ?? 0, kills: s.round_kills ?? 0, hurtAt: 0, killAt: 0, shotAt: 0 })
    const hp = s.health ?? 0
    if (hp < h.hp && hp > 0) h.hurtAt = now
    if ((s.round_kills ?? 0) > h.kills) {
      h.killAt = now
      // kill times for streaks (a double / triple kill in progress)
      ;(h.killTimes ||= []).push(...Array((s.round_kills ?? 0) - h.kills).fill(now))
    }
    if ((s.round_kills ?? 0) < h.kills) h.killTimes = [] // new round
    if (active && active.name === h.weapon && active.ammo_clip < h.ammo && active.type !== 'Grenade') h.shotAt = now
    h.hp = hp
    h.kills = s.round_kills ?? 0
    h.weapon = active?.name
    h.ammo = active?.ammo_clip
    h.awp = active?.name === 'weapon_awp'
    return h
  }

  function score(me, all, raw, now, observedId) {
    const h = hist[me.id]
    const s = me.p.state || {}
    const enemies = all.filter((o) => o.p.team !== me.p.team && o.alive)
    const mates = all.filter((o) => o.p.team === me.p.team && o.alive)
    let v = 0
    let reason = ''
    const add = (pts, why) => {
      v += pts
      if (pts >= 15 && !reason) reason = why
    }
    // bomb events first: they are what the round is about
    const bomb = raw.bomb
    if (bomb?.player === me.id && bomb.state === 'defusing') add(70, 'defusing')
    if (bomb?.player === me.id && bomb.state === 'planting') add(60, 'planting')
    if (mates.length === 1 && enemies.length) add(40 + 5 * enemies.length, 'clutch')
    // a streak in progress: 2+ kills within 6 s -> the round's key moment, the camera goes there and stays
    const streak = (h.killTimes || []).filter((t) => now - t < 6000).length
    if (streak >= 2) add(60 + 15 * (streak - 2), 'multikill') // outweighs a duel elsewhere (~90 with the hold bonus)
    if (now - h.killAt < 4000) add(20 + 8 * (s.round_kills ?? 0), 'kills')
    if (now - h.shotAt < 2000) add(30, 'shooting')
    if (now - h.hurtAt < 3000) add(25, 'hurt')
    // "in a fight right now": the camera should not leave him for another fight
    let engaged = now - h.shotAt < 2500 || now - h.hurtAt < 3000 || now - h.killAt < 4000 || streak >= 2
    let early = false // crosshairs on target: the shot comes in about a second -> cut a bit sooner
    const pos = vec(me.p.position)
    if (pos) {
      let near = Infinity
      let facing = false // he looks at an enemy
      let aimMe = 0 // enemies whose crosshair is right on him (<= ~10 deg): a shot is about to come
      let aimIt = false // his crosshair is right on an enemy
      let duel = false // both at once: the two are about to shoot each other
      let crowd = 0 // enemies that look his way (<= ~21 deg): a rush on him / a double peek
      const fwd = vec(me.p.forward)
      for (const e of enemies) {
        const ep = vec(e.p.position)
        if (!ep) continue
        const d = dist(pos, ep)
        if (d < near) near = d
        const dx = ep[0] - pos[0]
        const dy = ep[1] - pos[1]
        const dz = ep[2] - pos[2]
        const len = Math.hypot(dx, dy) || 1
        const len3 = Math.hypot(dx, dy, dz) || 1
        if (fwd && d < 2200 && (fwd[0] * dx + fwd[1] * dy) / len > 0.85) facing = true
        // GSI "forward" is the 3D view direction: compare it with the direction to the other player
        const mine = fwd ? (fwd[0] * dx + fwd[1] * dy + (fwd[2] || 0) * dz) / len3 : 0
        const ef = vec(e.p.forward)
        const theirs = ef ? -(ef[0] * dx + ef[1] * dy + (ef[2] || 0) * dz) / len3 : 0
        if (d < 3000 && mine > 0.985) aimIt = true
        if (d < 3000 && theirs > 0.985) aimMe++
        if (d < 3000 && mine > 0.985 && theirs > 0.985) duel = true
        if (d < 2500 && theirs > 0.93) crowd++
      }
      if (near < 2000) add(Math.round(30 * (1 - near / 2000)), 'enemy')
      // closing in: the gap to the nearest enemy shrinks fast over the last ~1.5 s -> a fight is about to start
      const nh = (h.nearHist ||= [])
      nh.push([now, near])
      while (nh.length && now - nh[0][0] > 1500) nh.shift()
      const [t0, d0] = nh[0]
      const closing = now - t0 > 400 && Number.isFinite(d0) && Number.isFinite(near) ? (d0 - near) / ((now - t0) / 1000) : 0
      if (near < 2200 && closing > 120) add(20, 'contact')
      if (facing && near < 2200) add(crowd ? 18 : 10, 'contact') // eye to eye: the first shot is near
      // ~1 s before the kill: crosshairs already on the target
      if (duel) add(40, 'duel')
      else if (aimMe || aimIt) add(22, 'aim')
      // two or more enemies look his way: a rush onto him / a double peek -> show him and stay with him
      if (crowd >= 2) add(10 + 22 * (crowd - 1), 'crowd')
      if (crowd >= 2 && me.id === observedId) v += 30
      if ((facing && near < 1200) || crowd >= 2 || duel || aimMe) engaged = true
      early = duel || aimMe > 0 || aimIt
      const bp = bomb?.state === 'planted' || bomb?.state === 'defusing' ? vec(bomb.position) : null
      if (bp) {
        const d = dist(pos, bp)
        if (me.p.team === 'CT' && d < 1500) add(Math.round(25 * (1 - d / 1500)), 'retake')
        if (me.p.team === 'T' && d < 1200) add(8, 'retake')
      }
    }
    if (bomb?.state === 'carried' && bomb.player === me.id) add(8, 'bomb')
    if (h.awp) add(4, 'enemy')
    if ((s.health ?? 0) <= 25 && (now - h.hurtAt < 5000 || v > 20)) add(8, 'hurt')
    if ((s.flashed ?? 0) > 200) v -= 10
    // tie-breakers: who is having a good game
    v += (me.p.match_stats?.kills ?? 0) * 0.3 + (s.round_totaldmg ?? 0) * 0.02
    if (me.id === observedId) v += 15 // keep the current player unless someone else is clearly better
    return { v, reason: reason || 'best', engaged, early }
  }

  // ---------- bomb camera (Alt+B): free camera looking at the bomb from above; again = back ----------
  let lastRaw = null
  let bombCam = null // { prev: steamid watched before } while the bomb camera is on

  const tel = (cmd) => post('telnet', { cmd, port: num(cfg.port, 2020) }).catch(() => {})
  const r1 = (n) => (Math.round(n * 10) / 10).toFixed(1)

  function startBombCam() {
    if (viaKeys()) return setStatus({ state: 'nokeys' }) // a free camera needs the CS2 console
    const raw = lastRaw
    const bomb = raw?.bomb
    const players = Object.entries(raw?.allplayers || {}).map(([id, p]) => ({ id, p, pos: vec(p.position), alive: (p.state?.health ?? 0) > 0 }))
    const carrier = bomb?.state === 'carried' ? players.find((o) => o.id === bomb.player) : null
    const bp = carrier ? carrier.pos : vec(bomb?.position)
    if (!bp) return setStatus({ state: 'nobomb' })
    // The camera may only stand where there is surely free space (no map geometry in GSI):
    //  - a living player near the bomb (< 600 units): on his spot, a bit above his head, looking at the bomb;
    //  - otherwise right above the bomb (a player stood there when it was dropped / planted): 70 units aside, 100 up;
    //  - carried: just behind the carrier, above his head.
    const flat = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
    let cam
    if (carrier) {
      const f = vec(carrier.p.forward) || [1, 0, 0]
      const fl = Math.hypot(f[0], f[1]) || 1
      cam = [bp[0] - (f[0] / fl) * 50, bp[1] - (f[1] / fl) * 50, bp[2] + 100]
    } else {
      const near = players
        .filter((o) => o.alive && o.pos && flat(o.pos, bp) > 60 && flat(o.pos, bp) < 600)
        .sort((a, b) => flat(a.pos, bp) - flat(b.pos, bp))[0]
      if (near) cam = [near.pos[0], near.pos[1], near.pos[2] + 90]
      else {
        const any = players.filter((o) => o.pos && flat(o.pos, bp) > 1).sort((a, b) => flat(a.pos, bp) - flat(b.pos, bp))[0]
        const d = any ? [any.pos[0] - bp[0], any.pos[1] - bp[1]] : [1, 0]
        const dl = Math.hypot(d[0], d[1]) || 1
        cam = [bp[0] + (d[0] / dl) * 70, bp[1] + (d[1] / dl) * 70, bp[2] + 100]
      }
    }
    const horiz = Math.max(1, flat(cam, bp))
    const pitch = (Math.atan2(cam[2] - bp[2], horiz) * 180) / Math.PI
    const yaw = (Math.atan2(bp[1] - cam[1], bp[0] - cam[0]) * 180) / Math.PI
    bombCam = { prev: raw.player?.team ? raw.player.steamid : target }
    setStatus({ state: 'bomb', ...roundInfo })
    post('telnet', { cmd: `spec_goto ${r1(cam[0])} ${r1(cam[1])} ${r1(cam[2])} ${r1(pitch)} ${r1(yaw)}`, port: num(cfg.port, 2020) })
      .then((res) => {
        if (res.ok) return
        // the console does not answer (CS2 without -insecure): no free camera possible
        if (cfg.method === 'auto') consoleDownAt = Date.now()
        bombCam = null
        setStatus({ state: 'nokeys' })
      })
      .catch(() => {})
  }

  function endBombCam() {
    const prevId = bombCam?.prev
    const prev = prevId && lastRaw?.allplayers?.[prevId]
    bombCam = null
    // back to a player right away: the one watched before (if alive), then the auto camera takes over
    lastObserved = undefined
    const cmd = prev && (prev.state?.health ?? 0) > 0 ? command({ ...prev, steamid: prevId }) : ''
    if (cmd) {
      tel(cmd)
      target = prevId // wait for this switch to land before the auto camera decides again
      sentAt = switchedAt = Date.now()
    } else {
      deadSince = Date.now() - 1000 // nobody to go back to: the auto camera picks a player right away
      sentAt = 0
    }
    setStatus({ state: hand ? 'hand' : cfg.auto ? 'on' : 'off' })
  }

  const toggleBomb = () => (bombCam ? endBombCam() : startBombCam())

  function update(raw) {
    if (!raw?.allplayers) return
    lastRaw = raw
    const now = Date.now()
    const all = Object.entries(raw.allplayers).map(([id, p]) => ({ id, p, alive: (p.state?.health ?? 0) > 0 }))
    for (const o of all) track(o.id, o.p, now)
    if (bombCam) {
      // a new round ends the bomb camera; until then the auto camera keeps its hands off
      if (/freezetime/.test(raw.phase_countdowns?.phase || '')) endBombCam()
      return
    }
    if (!cfg.auto) return

    roundInfo = { round: (raw.map?.round ?? 0) + (raw.round?.phase === 'over' ? 0 : 1), clock: Math.round(num(raw.phase_countdowns?.phase_ends_in, 0)) }
    const realObserved = raw.player?.team && raw.allplayers[raw.player.steamid] ? raw.player.steamid : null
    // suggest mode: a virtual camera on the last suggested player (the real one is not touched)
    const suggest = cfg.mode === 'suggest'
    const observedId = suggest && target && raw.allplayers[target] ? target : realObserved
    if (!suggest && observedId !== lastObserved) {
      const prev = lastObserved
      lastObserved = observedId
      const prevAlive = prev && (raw.allplayers[prev]?.state?.health ?? 0) > 0
      // (no time window after our own command: a switch to anyone but our target is the operator's)
      if (observedId && observedId !== target && prevAlive) {
        // the operator picked someone by hand: follow their choice for a while
        pausedUntil = now + num(cfg.manual_pause, 8) * 1000
        target = observedId
        setStatus({ state: 'manual', name: raw.allplayers[observedId]?.name, until: pausedUntil })
      }
      switchedAt = now
    }
    if (now < pausedUntil || hand) return

    const phase = raw.phase_countdowns?.phase || raw.round?.phase || ''
    if (/freezetime|paused|timeout/.test(phase)) return
    // a paused demo: the round clock stands still while frames keep coming. Do nothing then
    // (CS2 does not switch players on a paused demo, and a pressed key could land in an open console / chat)
    const clock = raw.phase_countdowns?.phase_ends_in
    if (clock != null) {
      if (clock !== clockVal) {
        clockVal = clock
        clockAt = now
      } else if (now - clockAt > 1500) return
    }
    const watched = observedId ? all.find((o) => o.id === observedId) : null
    const watchedAlive = !!watched?.alive
    if (watchedAlive) deadSince = 0
    else if (!deadSince) deadSince = now
    if (phase === 'over' && watchedAlive) return // round decided: no cuts
    if (now - sentAt < 1200) return // the last command is still on its way

    const alive = all.filter((o) => o.alive && command({ ...o.p, steamid: o.id }))
    if (!alive.length) return
    const scored = alive.map((o) => ({ o, ...score(o, all, raw, now, observedId) })).sort((a, b) => b.v - a.v)
    const best = scored[0]
    lastScored = scored.slice(0, 3).map((x) => `${x.o.p.name}:${Math.round(x.v)}:${x.reason}${x.engaged ? ':engaged' : ''}`) // tests / debugging
    if (best.o.id === observedId) return

    if (!watchedAlive) {
      // free camera or the player died: a short look at the death, then cut. Shorter when somebody alive
      // is about to fight / already fighting / has the round's key moment: that must not be missed
      const urgent = best.early || best.engaged || /defusing|planting|clutch|multikill/.test(best.reason)
      if (now - deadSince >= (urgent ? 250 : 600)) switchTo({ ...best.o.p, steamid: best.o.id }, 'dead', now)
      return
    }
    const cur = scored.find((x) => x.o.id === observedId)
    const held = now - switchedAt
    const hold = num(cfg.hold, 4) * 1000
    // the watched player is in a fight: stay unless the round's key moment happens elsewhere
    // (defuse / plant / clutch) or the other fight is far bigger
    if (cur.engaged && !/defusing|planting|clutch|multikill/.test(best.reason)) {
      if (held >= hold && best.v >= cur.v + 45) switchTo({ ...best.o.p, steamid: best.o.id }, best.reason, now)
      return
    }
    // crosshairs already on the target there: cut ~a second before the shot (0.8 s on the current player is enough)
    const soon = best.early && held >= 800 && best.v >= cur.v + 30
    // the round's key moment elsewhere (defuse / plant / clutch / kill streak): being ahead is enough
    const key = /defusing|planting|clutch|multikill/.test(best.reason) && held >= 1000 && best.v >= cur.v + 5
    if (key || soon || (held >= hold && best.v >= cur.v + 12) || (held >= 1500 && best.v >= cur.v + 35)) {
      switchTo({ ...best.o.p, steamid: best.o.id }, best.reason, now)
    }
  }

  function configure(next) {
    const was = `${cfg.auto}/${cfg.mode}`
    // empty fields saved by the manager's panel ("") fall back to the defaults
    cfg = { ...OBSERVER_DEFAULTS, ...Object.fromEntries(Object.entries(next || {}).filter(([, v]) => v !== '' && v != null)) }
    if (`${cfg.auto}/${cfg.mode}` !== was) {
      pausedUntil = 0
      hand = false
      lastObserved = undefined
      target = null
      sentAt = 0
      setStatus({ state: cfg.auto ? 'on' : 'off' })
    }
  }

  // Hotkey: every copy of the overlay gets the same key event, so they stay in step
  function toggleHand() {
    if (!cfg.auto) return
    hand = !hand
    pausedUntil = 0
    lastObserved = undefined
    setStatus({ state: hand ? 'hand' : 'on' })
  }

  const helperBeat = () => (helperAt = Date.now())
  let lastScored = []

  return { update, configure, toggleHand, toggleBomb, helperBeat, debug: () => lastScored }
}
