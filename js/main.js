import { api, connect } from './api.js'
import { buildState } from './state.js'
import { createTopbar, createPlayers, createObserved, setAgentPicks } from './render.js'
import { createRadar } from './radar.js'
import { createKillfeed, createEconomy, createSponsors, createVeto, createSeries } from './features.js'
import { applyTheme } from './themes.js'
import { createStats } from './stats.js'
import { createScoreboard } from './scoreboard.js'
import { createDefusePopup } from './defuse.js'
import { createObserver } from './observer.js'

const HUD_NAME = 'newHud'
const params = new URLSearchParams(location.search)
const MOCK = params.has('mock')
// auto camera (control page: "Auto camera"); &noobs=1 for a second copy of the overlay (e.g. in OBS),
// so that only one copy drives the camera
const observer = !MOCK && !params.has('preview') && !params.has('noobs') ? createObserver() : null

const ctx = { match: null, teams: {}, players: {} }
let config = {} // display_settings from panel.json
let lastRaw = null
let lastState = null
let vetoVisible = false
let sbView = '' // '' | 'stats' | 'economy' | 'leaders'
let defuseFlip = false // Alt+D (Alt+В): show / hide the separate defuse window on top of the panel setting
let layoutFlip = false // Alt+V: switch the player tile layout on top of the panel setting
let namesPinned = false // Alt+N: keep the team names open in the top bar (press again to fold)
let namesUntil = 0 // ms timestamp: names shown in full until then (start of a round)
let namesTimer = null
function showNames() {
  const v = config.names_secs
  const secs = v === '' || v == null ? 5 : Math.max(0, Number(v) || 0)
  namesUntil = Date.now() + secs * 1000
  clearTimeout(namesTimer)
  namesTimer = setTimeout(() => render(), secs * 1000 + 20) // fold even if no game update arrives
}

const $ = (id) => document.getElementById(id)
const hudEl = $('hud')
const renderTopbar = createTopbar($('topbar'))
const renderLeft = createPlayers($('players-left'))
const renderRight = createPlayers($('players-right'))
const renderObserved = createObserved($('observed'))
const renderRadar = createRadar($('radar'))
const renderKillfeed = createKillfeed($('killfeed'))
const renderEconomy = createEconomy($('economy'))
const renderSponsors = createSponsors($('sponsors'))
const renderVeto = createVeto($('veto'))
const renderSeries = createSeries($('series'))
const renderScoreboard = createScoreboard($('scoreboard'))
const stats = createStats()
const renderDefuse = createDefusePopup($('defuse'))

function render() {
  renderVeto(lastState, ctx, vetoVisible && !sbView)
  if (!lastRaw?.map) {
    hudEl.classList.add('idle')
    return
  }
  hudEl.classList.remove('idle')
  const st = (lastState = buildState(lastRaw, ctx))
  // Round goes live -> close the scoreboard (unless the panel says to keep it)
  if (prevPhase === 'freezetime' && st.phase === 'live' && sbView && !config.sb_keep_on_live) closeBoard()
  // New round (buy time starts) -> team names shown in full for names_secs seconds (default 5)
  if (st.phase === 'freezetime' && prevPhase !== 'freezetime' && prevPhase !== '') showNames()
  prevPhase = st.phase
  stats.update(st)
  st.mvp = stats.roundMvp(st)
  hudEl.classList.toggle('sb-open', !!sbView)
  // warmup: semi-transparent caption in the middle of the screen
  hudEl.classList.toggle('warmup', st.phase === 'warmup')
  // Player tiles: 'sides' = rows at the left / right edges, 'bottom' = vertical cards in a row at the bottom
  const bottom = (config.player_layout === 'bottom') !== layoutFlip
  if (hudEl.classList.contains('layout-bottom') !== bottom) {
    // layout switch (Alt+V): no transitions for a moment, so HP bars / fills don't slide from the old geometry
    hudEl.classList.add('layout-switching')
    requestAnimationFrame(() => requestAnimationFrame(() => hudEl.classList.remove('layout-switching')))
  }
  hudEl.classList.toggle('layout-bottom', bottom)
  renderScoreboard(st, stats, sbView, config)
  // Top bar: collapsed (logos + scores) except for a few seconds at the start of each round,
  // or while Alt+N keeps the names open (until Alt+N again)
  $('topbar').classList.toggle('collapsed', !namesPinned && Date.now() >= namesUntil)
  renderTopbar(st, config)
  // Economy tables right under the top bar strip (its height depends on the theme and the tournament line)
  const sub = document.querySelector('.tb-sub')
  if (sub) $('economy').style.top = `${Math.round(sub.getBoundingClientRect().bottom + 8)}px`
  renderDefuse(st) // after the top bar: uses st.bombInfo
  renderLeft(st.left.players)
  renderRight(st.right.players)
  renderObserved(st.observed, config)
  renderSeries(st, ctx, config)
  renderRadar(st, { ...config, radar_size: radarSize() })
  renderSponsors(config, st)
  placeSponsors()
  renderEconomy(st, config)
  hudEl.classList.toggle('no-defuse-popup', !!config.hide_defuse_popup !== defuseFlip)
  // Fallback crosshair when the game one is hidden: only while the camera follows a living player
  $('crosshair').classList.toggle('show', !!config.draw_crosshair && !!st.observed && st.observed.hp > 0)
  // ?debug=1: raw bomb/timer data as text (for checking against the game)
  if (params.has('debug')) {
    let pre = $('debug')
    if (!pre) {
      pre = document.createElement('pre')
      pre.id = 'debug'
      document.body.appendChild(pre)
    }
    const dbg = JSON.stringify({
      at: new Date().toISOString(),
      bomb: lastRaw.bomb,
      phase_countdowns: lastRaw.phase_countdowns,
      round: lastRaw.round,
      mapRound: lastRaw.map?.round,
      barWidth: document.querySelector('[data-f="bombFill"]')?.style.width,
      timer: document.querySelector('[data-f="timer"]')?.textContent,
      centerState: document.querySelector('[data-f="center"]')?.dataset.state
    })
    pre.textContent = dbg
    console.log('DBG ' + dbg)
  }
}

// Commands from the control page (control.html) arrive inside the saved config:
// { remote: { id, action, data } }. Only a new id triggers the action, so reloading
// the overlay does not replay the last command.
let lastRemoteId
function handleRemote(remote) {
  const id = remote?.id ?? null
  if (lastRemoteId === undefined) {
    lastRemoteId = id
    return
  }
  if (id === lastRemoteId) return
  lastRemoteId = id
  actions[remote.action]?.(remote.data)
}

function applyConfig(cfg) {
  config = {
    ...(cfg?.display_settings || {}),
    ...(cfg?.sponsors || {}),
    ...(cfg?.scoreboard_controls || {})
  }
  handleRemote(cfg?.remote)
  observer?.configure(cfg?.observer)
  // agents picked per player in the control panel (tab "Agents")
  setAgentPicks(cfg?.agents_panel)
  // ?theme=blast in the URL overrides the panel (handy for previews)
  if (params.get('theme')) config.theme = params.get('theme')
  // manager "Variants": horizontal = rows at the sides, vertical = cards in a row at the bottom.
  // The panel no longer has a layout setting, so an old saved value is ignored (mock keeps ?layout= for screenshots)
  const variant = params.get('variant')
  if (variant === 'horizontal' || variant === 'vertical') config.player_layout = variant === 'vertical' ? 'bottom' : 'sides'
  else if (!MOCK) config.player_layout = 'sides'
  applyTheme(config)
  renderSponsors(config, lastState)
  render()
}

// Radar size: only Shift+Z / Shift+X (no panel field), kept within RADAR_MIN..RADAR_MAX
// (too small and the map turns unreadable; bigger covers too much of the game).
// Remembered in the overlay's localStorage, so a reload keeps it.
const RADAR_MIN = 250
const RADAR_MAX = 400
const RADAR_DEFAULT = 300
const RADAR_STEP = 25
const clampRadar = (v) => Math.min(RADAR_MAX, Math.max(RADAR_MIN, Number(v) || RADAR_DEFAULT))
let radarPx = (() => {
  try {
    return clampRadar(localStorage.getItem('newhud-radar'))
  } catch {
    return RADAR_DEFAULT
  }
})()
const radarSize = () => radarPx
function resizeRadar(step) {
  radarPx = clampRadar(radarPx + step)
  try {
    localStorage.setItem('newhud-radar', String(radarPx))
  } catch {}
  render()
}

// Sponsor block (panel: sponsor_position):
//   '' = right under the radar, as wide as the radar (top left corner when the radar is hidden)
//   'top-right' = top right corner, same size limits; the killfeed moves below it while it is on screen
function placeSponsors() {
  const sp = $('sponsors')
  const kf = $('killfeed')
  const rd = document.querySelector('#radar .rd')
  const r = rd && !rd.hidden && !hudEl.classList.contains('no-radar') ? rd.getBoundingClientRect() : null
  const width = r?.width || radarSize()
  const height = Math.round(width * 0.3)
  // themes that put the tournament line over the radar (BLAST) size it to the radar
  document.documentElement.style.setProperty('--radar-w', `${Math.round(width)}px`)
  const topRight = config.sponsor_position === 'top-right'
  hudEl.classList.toggle('sp-top-right', topRight)
  sp.style.top = `${topRight ? 16 : r ? Math.round(r.bottom + 8) : 16}px`
  sp.style.width = `${Math.round(width)}px`
  sp.style.height = `${height}px`
  const box = sp.querySelector('.sp')
  const spShown = topRight && box && !box.hidden && !box.classList.contains('off')
  // the card can be lower than the area (wide banner): the killfeed goes right under the card itself
  kf.style.top = spShown ? `${16 + (box.offsetHeight || height) + 10}px` : ''
}

async function loadMatch() {
  try {
    const match = await api.currentMatch()
    // + teams named in the veto (a veto can point to a team that is no longer in the match slots)
    const ids = [...new Set([match?.left?.id, match?.right?.id, ...(match?.vetos || []).map((v) => v.teamId)].filter(Boolean))]
    const teams = await Promise.all(ids.map((id) => api.team(id).catch(() => null)))
    ctx.match = match
    ctx.teams = Object.fromEntries(teams.filter(Boolean).map((t) => [t._id, t]))
  } catch {
    ctx.match = null
    ctx.teams = {}
  }
  render()
}

async function loadPlayers() {
  try {
    const list = await api.players()
    ctx.players = Object.fromEntries(list.filter((p) => p.steamid).map((p) => [p.steamid, p]))
  } catch {
    ctx.players = {}
  }
  render()
}

// Scoreboard: same hotkey again closes it, another view switches, Alt+0 closes any view.
// Optional auto-hide after N seconds (panel: sb_autohide).
let sbTimer = null
let prevPhase = ''

function openBoard(view) {
  clearTimeout(sbTimer)
  sbView = view
  const secs = Number(config.sb_autohide)
  if (view && secs > 0) sbTimer = setTimeout(() => closeBoard(true), secs * 1000)
}

function closeBoard(rerender = false) {
  clearTimeout(sbTimer)
  sbView = ''
  if (rerender) render()
}

const setBoard = (view) => {
  openBoard(sbView === view ? '' : view)
  render()
}

const setVeto = (v) => {
  vetoVisible = v
  render()
}

const actions = {
  toggleHud: () => hudEl.classList.toggle('hidden'),
  togglePlayers: () => hudEl.classList.toggle('no-players'),
  toggleNames: () => {
    // open and keep open; pressing again folds now (also ends the round-start display)
    namesPinned = !namesPinned
    if (!namesPinned) namesUntil = 0
    render()
  },
  toggleLayout: () => {
    layoutFlip = !layoutFlip
    render()
  },
  toggleRadar: () => hudEl.classList.toggle('no-radar'),
  toggleVeto: () => setVeto(!vetoVisible),
  sbStats: () => setBoard('stats'),
  sbEconomy: () => setBoard('economy'),
  sbLeaders: () => setBoard('leaders'),
  // panel buttons: { action: 'scoreboard', data: 'stats' | 'economy' | 'leaders' | 'hide' }
  sbHide: () => closeBoard(true),
  scoreboard: (data) => {
    openBoard(data === 'hide' ? '' : data)
    render()
  },
  // panel "action" buttons: { action: 'veto', data: 'show' | 'hide' }
  veto: (data) => setVeto(data === 'show'),
  radarBigger: () => resizeRadar(RADAR_STEP),
  radarSmaller: () => resizeRadar(-RADAR_STEP),
  toggleDefuse: () => {
    defuseFlip = !defuseFlip
    render()
  },
  reload: () => location.reload(),
  obsHand: () => observer?.toggleHand(), // auto camera: manual control until pressed again
  bombCam: () => observer?.toggleBomb(), // free camera on the bomb from above; again = back to the players
  obsHelper: () => observer?.helperBeat(), // heartbeat of the key helper (helper/newhud-key-helper.ps1)  // manager panel "Hotkeys" section: { action: 'hotkey', data: '<action name>' } (built by deploy.ps1)
  hotkey: (data) => data !== 'hotkey' && actions[data]?.()
}

// &preview=1: static preview inside presets.html — no live connection
if (!params.has('preview')) connect(HUD_NAME, {
  update: (raw) => {
    if (MOCK) return // keep fake data on screen
    lastRaw = raw
    render()
    renderKillfeed(lastState)
    observer?.update(raw)
  },
  match: () => {
    loadMatch()
    loadPlayers()
  },
  hud_config: (cfg) => !MOCK && applyConfig(cfg), // mock keeps its own test config
  keybindAction: (a) => actions[typeof a === 'string' ? a : a?.action]?.(a?.data),
  hud_action: (a) => actions[a?.action]?.(a?.data),
  refreshHUD: () => location.reload()
})

if (!params.has('preview')) {
  loadMatch()
  loadPlayers()
}

// Auto-reload after a deploy: deploy.ps1 writes a new version.txt, the overlay notices it and reloads
// (the overlay window does not take keyboard focus, so Ctrl+R there does nothing)
if (!MOCK && !params.has('preview')) {
  let version = null
  setInterval(async () => {
    try {
      const v = (await (await fetch(`./version.txt?t=${Date.now()}`, { cache: 'no-store' })).text()).trim()
      if (version !== null && v !== version) location.reload()
      version = v
    } catch {}
  }, 3000)
}
applyTheme(config)

if (MOCK) {
  const { mockRaw, mockConfig, mockMatch, mockTeams, mockKillFrames } = await import('./mock.js')
  // ?mock=1&freeze=1 -> freezetime (economy panel), &veto=1 -> veto screen, &theme=esl -> theme preview
  // &sb=stats|economy|leaders -> scoreboard, &over=1 -> round-win banner with MVP
  if (params.get('sb')) sbView = params.get('sb')
  if (params.has('over')) {
    mockRaw.round = { phase: 'over', win_team: 'CT' }
    mockRaw.phase_countdowns = { phase: 'over', phase_ends_in: '5' }
    mockRaw.map.round_wins = { 14: 'ct_win_elimination' }
    mockRaw.bomb = null
  }
  // &bomb=planting|planted -> center-block bomb states
  if (params.get('bomb') === 'planting') mockRaw.bomb = { state: 'planting', countdown: '1.4', player: Object.keys(mockRaw.allplayers)[5], position: '-350, -2150, -170' }
  if (params.get('bomb') === 'planted') mockRaw.bomb = { state: 'planted', countdown: '27.3', position: '-350, -2150, -170' }
  // &dmg=1 -> two players take damage (damage popup)
  if (params.has('dmg')) {
    const ids = Object.keys(mockRaw.allplayers)
    lastRaw = structuredClone(mockRaw)
    render()
    mockRaw.allplayers[ids[0]].state.health = 5
    mockRaw.allplayers[ids[5]].state.health = 27
  }
  // &defuse=1 -> defuse in progress (planted frame first so the explosion time is known),
  // &defused=1 -> the same, then the bomb is defused
  if (params.has('defuse') || params.has('defused')) {
    const ids = Object.keys(mockRaw.allplayers)
    mockRaw.allplayers[ids[1]].state.defusekit = true
    mockRaw.bomb = { state: 'planted', countdown: '21.4', position: '-350, -2150, -170' }
    lastRaw = structuredClone(mockRaw)
    render()
    mockRaw.bomb = { state: 'defusing', countdown: '1.9', player: ids[1], position: '-350, -2150, -170' }
    if (params.has('defused')) {
      lastRaw = structuredClone(mockRaw)
      render()
      mockRaw.bomb = { state: 'defused', position: '-350, -2150, -170' }
    }
  }
  if (params.has('freeze')) {
    mockRaw.phase_countdowns = { phase: 'freezetime', phase_ends_in: '12' }
    mockRaw.bomb = null
  }
  // &clutch=1 -> 1 vs 3 (radar zooms to the fight): one CT and three Ts alive
  if (params.has('clutch')) {
    const ps = Object.values(mockRaw.allplayers)
    const cts = ps.filter((p) => p.team === 'CT')
    const ts = ps.filter((p) => p.team === 'T')
    cts.slice(1).forEach((p) => (p.state.health = 0))
    ts.slice(3).forEach((p) => (p.state.health = 0))
  }
  for (const frame of mockKillFrames()) renderKillfeed(buildState(frame, ctx))
  // &wing=1 -> jump-kill wing on the first two killfeed rows (preview of the icon)
  if (params.has('wing'))
    document.querySelectorAll('#killfeed .kf-weapon').forEach((w, i) => i < 2 && w.insertAdjacentHTML('beforebegin', `<i class="ic kf-wing" style="--src:url('${new URL('../icons/ui/wing.svg', import.meta.url).href}')"></i>`))
  lastRaw = mockRaw
  if (params.has('veto') || params.get('sb') || params.has('series')) {
    ctx.match = mockMatch
    ctx.teams = mockTeams
  }
  if (params.has('veto')) {
    ctx.match = mockMatch
    ctx.teams = mockTeams
    vetoVisible = true
  }
  // &xhair=1 -> fallback crosshair
  mockConfig.display_settings.draw_crosshair = params.has('xhair')
  mockConfig.display_settings.radar_avatars = params.has('photos')
  // &layout=bottom -> vertical player cards in a row at the bottom
  mockConfig.display_settings.player_layout = params.get('layout') || ''
  // &sponsor=1 -> one sponsor logo (shown in warmup / at round start), &tlong=1 -> long tournament line
  if (params.has('sponsor')) mockConfig.sponsors = { sponsors: [new URL(params.get('sponsor') === 'wide' ? '../maps/de_mirage.png' : '../thumb.jpg', import.meta.url).href] }
  if (params.has('tlong')) Object.assign(mockConfig.display_settings, { tournament_name: 'BeReddy Cup №9', tournament_stage: 'Финал. Верхняя сетка' })
  // &radar=250..400 -> radar size (not saved)
  if (params.get('radar')) radarPx = clampRadar(params.get('radar'))
  // &font=oswald|barlow|teko|... -> font override from the panel
  if (params.get('font')) mockConfig.display_settings.font = params.get('font')
  // &sppos=top-right -> sponsor in the top right corner
  if (params.get('sppos')) (mockConfig.sponsors ||= {}).sponsor_position = params.get('sppos')
  // &showseries=1 -> the map-series line instead of the tournament line (themes that alternate them)
  if (params.has('showseries')) hudEl.classList.add('show-series')
  // &warmup=1 -> warmup phase
  if (params.has('warmup')) mockRaw.phase_countdowns = { phase: 'warmup', phase_ends_in: '40' }
  // &nades=1 -> observed player carries 4 grenades + kit
  if (params.has('nades')) { const op = Object.values(mockRaw.allplayers).find((p) => p.observer_slot === 2) || Object.values(mockRaw.allplayers)[1]; op.state.defusekit = true; Object.assign(op.weapons, { weapon_n1: { name: 'weapon_hegrenade', type: 'Grenade' }, weapon_n2: { name: 'weapon_flashbang', type: 'Grenade' }, weapon_n3: { name: 'weapon_smokegrenade', type: 'Grenade' }, weapon_n4: { name: 'weapon_incgrenade', type: 'Grenade' }, weapon_k: { name: 'weapon_knife', type: 'Knife', state: 'active' } }); for (const w of Object.values(op.weapons)) if (w.type !== 'Knife') w.state = 'holstered' }
  // &smokeon=1 -> the first player stands inside the mock smoke (radar: semi-transparent dot)
  if (params.has('smokeon')) Object.values(mockRaw.allplayers)[0].position = '-700, -1300, -160'
  // &compact=1 -> top bar with team names collapsed
  // the top bar is collapsed by default; &names=1 -> names open (as with Alt+N)
  if (params.has('names')) namesPinned = true
  applyConfig(mockConfig)
}
