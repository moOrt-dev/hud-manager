import { asset } from './api.js'
import { weaponName, weaponIcon, uiIcon, vec } from './state.js'
import { siteOf } from './radar.js'
import { c4Svg, c4FpgSvg, c4Code } from './c4.js'

// Tiny DOM helpers: build a node from a template once, then update its [data-f] fields.
function mount(parent, html) {
  const tpl = document.createElement('template')
  tpl.innerHTML = html.trim()
  const node = tpl.content.firstElementChild
  parent.appendChild(node)
  const f = {}
  node.querySelectorAll('[data-f]').forEach((e) => (f[e.dataset.f] = e))
  return { node, f }
}

const setText = (e, v) => {
  const s = String(v ?? '')
  if (e.textContent !== s) e.textContent = s
}
const setImg = (e, url) => {
  const src = asset(url)
  e.hidden = !src
  if (src && e.getAttribute('src') !== src) e.src = src
}

// Icons are <i class="ic"> tinted by CSS `color` (SVG used as a mask), see .ic in hud.css
const iconHtml = (src, cls = '', title = '') =>
  src ? `<i class="ic ${cls}" style="--src:url('${src}')" title="${title}"></i>` : ''
const setIcon = (e, src) => {
  e.hidden = !src
  if (src && e.dataset.src !== src) {
    e.dataset.src = src
    e.style.setProperty('--src', `url('${src}')`)
  }
}
// Re-render a container only when its content key changes (for variable-length icon lists)
const setHtml = (e, key, html) => {
  if (e.dataset.key !== key) {
    e.dataset.key = key
    e.innerHTML = html
  }
}

const fmtTime = (sec) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const armorIcon = (p) =>
  p.armor <= 0 ? '' : uiIcon(p.helmet ? 'icon_armor_helmet_default' : 'icon_armor_full_default')

// Grenades + bomb/kit as a row of icons
const utilityHtml = (p) =>
  [
    ...p.grenades.map((g) => iconHtml(weaponIcon(g.name), 'ic-nade', weaponName(g.name))),
    p.hasBomb ? iconHtml(uiIcon('icon_c4_default'), 'ic-bomb', 'C4') : '',
    p.defuseKit ? iconHtml(uiIcon('icon_defuse_default'), 'ic-kit', 'Kit') : ''
  ].join('')
const utilityKey = (p) => p.grenades.map((g) => g.name).join() + p.hasBomb + p.defuseKit

// One skull per kill this round
// Crosshair = kill, skull = death (icons from the built-in JTs HUD player cards)
const killsHtml = (n) => iconHtml(uiIcon('kills'), 'ic-kill').repeat(Math.min(n, 5))

// no photo in the manager -> an official CS2 agent portrait of the player's side (icons/agents, from the game files);
// each player keeps the same agent (picked by steamid), teammates get different ones
const AGENTS_DIR = new URL('../icons/agents/', import.meta.url).href
// agents picked in the manager panel / control page (section "Agents"): { '<steamid>_CT': 'ctm_sas', '<steamid>_T': ... }
let agentPicks = {}
export const setAgentPicks = (map) => (agentPicks = map && typeof map === 'object' ? map : {})
export const agentOf = (side, key = '') => {
  const picked = agentPicks[`${key}_${side === 'T' ? 'T' : 'CT'}`]
  if (picked) return `${AGENTS_DIR}all/${picked}.png`
  let h = 0
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `${AGENTS_DIR}${side === 'T' ? 't' : 'ct'}${(h % 5) + 1}.png`
}
const TROPHY = new URL('../icons/ui/trophy.svg', import.meta.url).href
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Default CT / T emblems when a team has no logo in the manager
export const sideLogo = (side) => new URL(`../icons/logo_${side === 'T' ? 'T' : 'CT'}_default.png`, import.meta.url).href

const WIN_ICONS = {
  bomb: 'icon_bomb_explosion_default',
  defuse: 'icon_defuse_default',
  time: 'icon_timer_default',
  elimination: 'icon_skull_default'
}

// C4 for the center block: detailed in-game look (js/c4.js)
const C4_SVG = c4Svg('tb')

// Round-win streak: the outline is drawn 1:1 in screen pixels (no stretched viewBox), and its real length
// goes to --len, so the dash pattern equals one lap and the loop closes without a jump at the start point.
function fitWinStroke(svg) {
  const r = svg?.getBoundingClientRect()
  if (!r || r.width < 10) return
  const w = Math.round(r.width)
  const h = Math.round(r.height)
  if (svg.dataset.size === `${w}x${h}`) return
  svg.dataset.size = `${w}x${h}`
  const i = 1.5 // half the stroke, keeps it inside the box
  // corner radius of the theme (FPG 10px, BLAST / PGL sharp), via --win-radius / --radius
  const css = getComputedStyle(svg)
  const themeRad = parseFloat(css.getPropertyValue('--win-radius') || css.getPropertyValue('--radius')) || 0
  const rad = Math.max(0.01, Math.min(themeRad + 2, h / 2 - i))
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const path = svg.querySelector('path')
  path.removeAttribute('pathLength')
  path.setAttribute(
    'd',
    `M${i + rad} ${i} H${w - i - rad} Q${w - i} ${i} ${w - i} ${i + rad} V${h - i - rad} Q${w - i} ${h - i} ${w - i - rad} ${h - i} ` +
      `H${i + rad} Q${i} ${h - i} ${i} ${h - i - rad} V${i + rad} Q${i} ${i} ${i + rad} ${i} Z`
  )
  svg.style.setProperty('--len', `${path.getTotalLength().toFixed(2)}px`)
}

// Long team names ("БРЯНСКИЕ ВОЛКИ") shrink step by step until they fit their box instead of being cut
// with "…". Re-measured only when the text or the box width changes; skipped while the name is folded away.
function fitText(el, min = 14) {
  // not while the team block is folding / unfolding (Alt+N): it re-fits once the transition ends
  if (el.closest('.tb-team')?.dataset.anim) return
  const w = el.clientWidth
  if (w < 40) return
  const key = `${el.textContent}|${w}|${document.documentElement.dataset.theme}`
  if (el.dataset.fitKey === key) return
  el.dataset.fitKey = key
  el.style.fontSize = ''
  el.classList.remove('two-lines')
  const base = parseFloat(getComputedStyle(el).fontSize)
  let size = base
  // width: strict (1px over already shows "…"); height only matters for the two-line mode
  const over = () => el.scrollWidth > el.clientWidth || (el.classList.contains('two-lines') && el.scrollHeight > el.clientHeight + 2)
  // 1) a little smaller on one line
  while (over() && size > base * 0.8) el.style.fontSize = `${(size -= 1)}px`
  // 2) several words: two lines at a normal size instead of a tiny single line
  if (over() && /\s/.test(el.textContent.trim())) {
    el.classList.add('two-lines')
    size = Math.round(base * 0.75)
    el.style.fontSize = `${size}px`
  }
  // 3) still too long: shrink down to the minimum
  while (over() && size > min) el.style.fontSize = `${(size -= 1)}px`
}

// ---------- Top bar ----------
export function createTopbar(root) {
  const teamHtml = (pos) => `
    <div class="tb-team ${pos}">
      <div class="tb-logo">
        <div class="tb-fire"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <img data-f="${pos}Logo" hidden />
        <span class="tb-streak" data-f="${pos}Streak"></span>
      </div>
      <div class="tb-team-text">
        <div class="tb-name" data-f="${pos}Name"></div>
      </div>
      <div class="tb-score" data-f="${pos}Score"></div>
      <!-- round win: a glowing streak runs once around the team block (styled per theme, see hud.css) -->
      <div class="tb-win">
        <svg class="tb-win-stroke" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M12 1 H388 Q399 1 399 12 V48 Q399 59 388 59 H12 Q1 59 1 48 V12 Q1 1 12 1 Z" pathLength="100" />
        </svg>
        <span>ROUND WINNER</span>
      </div>
    </div>`
  const subHtml = (pos) => `
    <div class="tb-sub-team ${pos}" data-f="${pos}Sub">
      <span class="tb-loss" data-f="${pos}Loss"></span>
      <span class="tb-loss-pips" data-f="${pos}Pips"></span>
    </div>`
  const { f } = mount(
    root,
    `<div class="tb">
      <div class="tb-tournament" data-f="tournament"></div>
      <div class="tb-row">
        ${teamHtml('left')}
        <div class="tb-center" data-f="center">
          <div class="tb-pips left" data-f="leftMarks"></div>
          <div class="tb-pips right" data-f="rightMarks"></div>
          <div class="tb-timer">
            <span data-f="timer"></span>
          </div>
          <div class="tb-c4">${C4_SVG}${c4FpgSvg()}</div>
          <div class="tb-round" data-f="round"></div>
          <div class="tb-burst"></div>
          <div class="tb-actbar"><div data-f="actFill"></div></div>
          <div class="tb-bombinfo" data-f="bombInfo"></div>
          <div class="tb-bombbar"><div data-f="bombFill"></div></div>
        </div>
        ${teamHtml('right')}
      </div>
      <div class="tb-sub">
        ${subHtml('left')}
        <div class="tb-map" data-f="map"></div>
        ${subHtml('right')}
      </div>
      <!-- players alive "4 VS 1" (EWC-style; hidden in the other themes) -->
      <div class="tb-alive" data-f="alive"></div>
      <div class="tb-banner" data-f="banner">
        <div class="tb-banner-main">
          <i class="ic" data-f="bannerIcon"></i>
          <span data-f="bannerText"></span>
        </div>
        <div class="tb-mvp" data-f="mvp">
          <span class="tb-mvp-star">★ MVP</span>
          <img class="tb-mvp-avatar" data-f="mvpAvatar" hidden />
          <b data-f="mvpName"></b>
          <span data-f="mvpStats"></span>
        </div>
      </div>
    </div>`
  )

  // Re-fit the team names once a team block has finished changing width (theme switch, Alt+N) and once the
  // web fonts are in — a paused demo sends no updates that would trigger it otherwise
  const refit = () => {
    for (const pos of ['left', 'right']) {
      f[pos + 'Name'].dataset.fitKey = ''
      fitText(f[pos + 'Name'])
    }
  }
  for (const pos of ['left', 'right']) {
    const team = f[pos + 'Name'].closest('.tb-team')
    team.addEventListener('transitionrun', (e) => e.target === team && e.propertyName === 'width' && (team.dataset.anim = '1'))
    team.addEventListener('transitionend', (e) => {
      if (e.target !== team || e.propertyName !== 'width') return
      delete team.dataset.anim
      refit()
    })
  }
  document.fonts?.ready.then(refit)
  // theme fonts load lazily (first use) — measure again when one arrives
  document.fonts?.addEventListener('loadingdone', refit)

  // Series marks: one bar per map needed to win (bo3 -> 2), filled for maps already won
  const series = (wins, bestOf) => {
    if (bestOf <= 1) return ''
    const need = Math.ceil(bestOf / 2)
    return Array.from({ length: need }, (_, i) => `<i class="${i < wins ? 'on' : ''}"></i>`).join('')
  }

  // Bomb timer state (see the bomb block below)
  let explode = null // seconds to explosion, monotonic while the bomb is planted
  let defuseStart = null // { defuse, explode }: values when the current defuse began
  let lastAct = ''
  let result = null // { type: 'defused' | 'exploded', time } until the next round
  let site = ''

  return (st, cfg) => {
    // name | icon | stage: the icon is the tournament logo from the panel, or a trophy
    const tLogo = cfg.tournament_logo ? asset(cfg.tournament_logo) : ''
    setHtml(
      f.tournament,
      `${cfg.tournament_name}|${cfg.tournament_stage}|${tLogo}`,
      [cfg.tournament_name, cfg.tournament_stage].some(Boolean)
        ? `<span>${esc(cfg.tournament_name || '')}</span>${
            tLogo ? `<img class="tb-t-mark tb-t-logo" src="${esc(tLogo)}" alt="" />` : iconHtml(TROPHY, 'tb-t-mark tb-t-cup')
          }<span>${esc(cfg.tournament_stage || '')}</span>`
        : ''
    )
    setText(
      f.map,
      st.mapName.replace(/^de_/, '').toUpperCase() + (st.bestOf > 1 ? ` · MAP ${st.mapNumber} OF ${st.bestOf}` : '')
    )

    for (const pos of ['left', 'right']) {
      const t = st[pos]
      f[pos + 'Name'].closest('.tb-team').dataset.side = t.side
      f[pos + 'Sub'].dataset.side = t.side
      setText(f[pos + 'Name'], t.name)
      fitText(f[pos + 'Name'])
      setText(f[pos + 'Score'], t.score)
      // series marks live in the center block next to the timer (vertical dashes, filled = maps won)
      f[pos + 'Marks'].dataset.side = t.side
      setHtml(f[pos + 'Marks'], `${t.mapWins}/${st.bestOf}`, series(t.mapWins, st.bestOf))
      setImg(f[pos + 'Logo'], t.logo || sideLogo(t.side))
      setText(f[pos + 'Loss'], `$${t.lossBonus}`)
      // "on fire": 5+ rounds won in a row (panel checkbox fire_on)
      const onFire = !!cfg.fire_on && t.winStreak >= 5
      f[pos + 'Name'].closest('.tb-team').classList.toggle('on-fire', onFire)
      setText(f[pos + 'Streak'], onFire ? `${t.winStreak}` : '')
      setHtml(
        f[pos + 'Pips'],
        String(t.lossStreak),
        Array.from({ length: 4 }, (_, i) => `<i class="${i < t.lossStreak ? 'on' : ''}"></i>`).join('')
      )
    }

    // ---- Bomb ----
    // GSI sends ONE countdown in bomb.countdown: planting -> time to finish the plant,
    // planted -> time to explosion, defusing -> time to finish the defuse (the explosion time
    // is not sent then). So the explosion time is carried over through the defuse using game
    // time (defuse progress), which also survives demo pause / speed changes.
    const bombState = st.bomb?.state || ''
    const cd = Number(st.bomb?.countdown)
    const hasCd = st.bomb?.countdown !== undefined && st.bomb?.countdown !== '' && Number.isFinite(cd)
    const planted = bombState === 'planted'
    const defusing = bombState === 'defusing'
    const planting = bombState === 'planting'

    if (planted && hasCd) {
      // monotonic: ignore GSI jitter (+0.1 s), accept real jumps (demo seek)
      explode = explode !== null && cd > explode && cd - explode < 1 ? explode : cd
      defuseStart = null
    } else if (defusing && hasCd) {
      // explode unknown (HUD opened mid-defuse) -> stays null, only the defuse is shown
      if (!defuseStart || cd > defuseStart.defuse + 0.5) defuseStart = { defuse: cd, explode }
      explode = defuseStart.explode === null ? null : Math.max(0, defuseStart.explode - (defuseStart.defuse - cd))
    } else if (!planted && !defusing) {
      // bomb finished: remember how it ended (and the time left) until the next round
      if ((bombState === 'defused' || bombState === 'exploded') && !result) result = { type: bombState, time: explode }
      explode = null
      defuseStart = null
    }
    if (st.phase === 'freezetime' || st.phase === 'warmup') {
      result = null
      site = ''
    }
    if ((planting || planted || defusing) && !site) site = siteOf(st.mapName, vec(st.bomb?.position))

    const bombLive = explode !== null
    // shared with the defuse popup (js/defuse.js)
    st.bombInfo = { state: bombState, explode, planting, defusing, countdown: hasCd ? cd : null, player: st.bomb?.player, site }
    const state = defusing ? 'defuse' : bombLive ? 'bomb' : st.phase
    f.center.dataset.state = state
    f.center.dataset.act = planting ? 'planting' : defusing ? 'defusing' : ''
    // which side of the bar the T team is on (BLAST-style: planting popup + bomb bar under the T block)
    f.center.dataset.tpos = st.left.side === 'T' ? 'left' : 'right'
    // data-bomb drives the C4 animation in the center block (planting / planted / defusing / defused / exploded)
    const bombView = planting ? 'planting' : defusing ? 'defusing' : bombLive ? 'planted' : result ? result.type : ''
    if (f.center.dataset.bomb !== bombView) f.center.dataset.bomb = bombView
    // warmup: the word does not fit the timer cell in every theme -> a big caption in the middle of the screen (main.js)
    setText(f.timer, st.phase === 'warmup' ? '' : fmtTime(bombLive ? explode : st.phaseEndsIn))

    // Red bar: time to explosion (40 s). Thin bar above it: plant (3 s) / defuse (10 s, 5 s with kit)
    f.bombFill.style.width = bombLive ? `${Math.min(100, (explode / 40) * 100)}%` : result?.time != null ? `${Math.min(100, (result.time / 40) * 100)}%` : '0%'
    const actor = st.players.find((p) => p.steamid === st.bomb?.player)
    const defuser = defusing ? actor : null
    const actFull = planting ? 3 : defuser?.defuseKit ? 5 : 10
    const act = planting || defusing ? (hasCd ? cd : actFull) : null
    const actKey = planting ? 'planting' : defusing ? 'defusing' : ''
    if (actKey !== lastAct) {
      // new action: jump to full without animating backwards from the previous one
      f.actFill.style.transition = 'none'
      f.actFill.style.width = act !== null ? `${Math.min(100, (act / actFull) * 100)}%` : '0%'
      void f.actFill.offsetWidth
      f.actFill.style.transition = ''
      lastAct = actKey
    } else f.actFill.style.width = act !== null ? `${Math.min(100, (act / actFull) * 100)}%` : '0%'

    // C4 display: code typed in with the plant (3 s) / defuse progress, full code once defused
    const code = planting || defusing ? c4Code(1 - act / actFull) : bombView === 'defused' ? c4Code(1) : c4Code(0)
    for (const lcd of f.center.querySelectorAll('.c4-lcd')) if (lcd.textContent !== code) lcd.textContent = code

    // Label under the timer: "NAME PLANTING A SITE" / "PLANTED A SITE" / "NAME DEFUSING A SITE"
    const who = (p) => (p ? `<b data-side="${p.side}">${esc(p.name)}</b> ` : '')
    const at = site ? ` ${site} SITE` : ''
    const label = planting
      ? `${who(actor)}PLANTING${at}`
      : defusing
        ? `${who(defuser)}DEFUSING${at}`
        : bombLive
          ? `PLANTED${at}`
          : st.phase === 'freezetime'
            ? `ROUND ${st.round} · BUY`
            : `ROUND ${st.round}`
    setHtml(f.round, label, label)

    // Strip under the block: precise defuse countdown, or the result with the bomb time left
    const info = defusing
      ? { cls: 'defusing', text: `${act.toFixed(2)}${defuser?.defuseKit ? ' · KIT' : ''}` }
      : result
        ? { cls: result.type, text: `${result.type === 'defused' ? 'DEFUSED' : 'EXPLODED'}${result.time != null && result.type === 'defused' ? ` · ${result.time.toFixed(2)}` : ''}` }
        : null
    f.bombInfo.dataset.kind = info?.cls || ''
    // FPG-style texts (shown by CSS through attr()): defuse "03:735" (s:ms), result "DEFUSED" + "20:74" on the red bar
    const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0')
    f.bombInfo.dataset.alt = defusing
      ? `${pad(act, 2)}:${pad((act % 1) * 1000, 3)}`
      : result
        ? result.type === 'defused' ? 'DEFUSED' : 'EXPLODED'
        : ''
    // explosion time unknown (HUD opened / reloaded mid-defuse): no empty red pill
    // ...the same after the defuse when the time left is unknown
    f.bombFill.parentElement.classList.toggle('unknown', (defusing && explode === null) || (!!result && result.time == null))
    // seconds to the explosion as text on the bar (BLAST-style pills)
    f.bombFill.parentElement.dataset.sec = bombLive ? explode.toFixed(1) : ''
    f.bombFill.parentElement.dataset.time =
      result?.type === 'defused' && result.time != null ? `${pad(result.time, 2)}:${pad((result.time % 1) * 100, 2)}` : ''
    // map name pops up only in buy time (and never over the bomb strip)
    f.map.classList.toggle('soft-hide', st.phase !== 'freezetime' || !!info)
    setText(f.bombInfo, info?.text || '')

    // alive counter: during the live round once someone has died
    const aliveL = st.left.players.filter((p) => p.hp > 0).length
    const aliveR = st.right.players.filter((p) => p.hp > 0).length
    const showAlive = st.phase === 'live' && (aliveL < 5 || aliveR < 5) && aliveL + aliveR > 0
    setHtml(
      f.alive,
      showAlive ? `${aliveL}|${aliveR}|${st.left.side}` : '',
      showAlive ? `<b data-side="${st.left.side}">${aliveL}</b><i>VS</i><b data-side="${st.right.side}">${aliveR}</b>` : ''
    )
    const winner = st.roundWinner && [st.left, st.right].find((t) => t.side === st.roundWinner)
    f.banner.dataset.side = st.roundWinner || ''
    for (const pos of ['left', 'right']) {
      const team = f[pos + 'Name'].closest('.tb-team')
      const won = !!winner && st[pos] === winner
      team.classList.toggle('won', won)
      if (won) fitWinStroke(team.querySelector('.tb-win-stroke'))
    }
    f.banner.classList.toggle('show', !!winner)
    if (winner) {
      setIcon(f.bannerIcon, uiIcon(WIN_ICONS[st.winType]))
      setText(f.bannerText, `${winner.name} win the round`)
      const mvp = st.mvp
      f.mvp.hidden = !mvp
      if (mvp) {
        f.mvp.dataset.side = mvp.side
        setImg(f.mvpAvatar, mvp.avatar)
        setText(f.mvpName, mvp.name)
        const k = mvp.roundKills
        setText(f.mvpStats, `${k} ${k === 1 ? 'kill' : 'kills'} · ${mvp.roundDamage} dmg`)
      }
    }
  }
}

// ---------- Player lists ----------
function createPlayerRow(root) {
  const { node, f } = mount(
    root,
    `<div class="pl">
      <img class="pl-avatar" data-f="avatar" alt="" />
      <span class="pl-dmg" data-f="dmg"></span>
      <!-- photo badges (BLAST-style cards): round kills as a number, kit / bomb as a colored circle -->
      <span class="pl-kn" data-f="kn"></span>
      <span class="pl-badge" data-f="badge"><i class="ic" data-f="badgeIc"></i></span>
      <div class="pl-hpbar" data-f="hpbar"></div>
      <div class="pl-flash" data-f="flash"></div>
      <div class="pl-top">
        <span class="pl-hp" data-f="hp"></span>
        <i class="ic pl-skull" data-f="skull" style="--src:url('${uiIcon('icon_skull_default')}')"></i>
        <span class="pl-name" data-f="name"></span>
        <span class="pl-kills" data-f="kills"></span>
        <i class="ic pl-weapon" data-f="weapon"></i>
      </div>
      <div class="pl-bottom">
        <i class="ic pl-armor" data-f="armor"></i>
        <i class="ic pl-equip" data-f="equip"></i>
        <span class="pl-money" data-f="money"></span>
        <span class="pl-util" data-f="util"></span>
        <span class="pl-kd" data-f="kd"></span>
      </div>
      <div class="pl-hpline"><div data-f="hpline"></div></div>
    </div>`
  )
  let prev = null // { steamid, hp } for the damage popup
  let dmgTimer = null
  return (p) => {
    node.hidden = !p
    if (!p) return
    const dead = p.hp <= 0
    // Damage popup "-95": HP went down for the same player
    if (prev && prev.steamid === p.steamid && p.hp < prev.hp) {
      f.dmg.textContent = `-${prev.hp - p.hp}`
      f.dmg.classList.remove('show')
      void f.dmg.offsetWidth // restart the animation
      f.dmg.classList.add('show')
      clearTimeout(dmgTimer)
      dmgTimer = setTimeout(() => f.dmg.classList.remove('show'), 1600)
    }
    prev = { steamid: p.steamid, hp: p.hp }
    const photo = p.avatar ? asset(p.avatar) : agentOf(p.side, p.steamid)
    if (f.avatar.getAttribute('src') !== photo) f.avatar.src = photo
    node.dataset.side = p.side
    node.classList.toggle('dead', dead)
    node.classList.toggle('low', !dead && p.hp <= 25)
    node.classList.toggle('observed', p.observed)
    node.style.setProperty('--hp', p.hp) // bar width in CSS (themes lay the bar out differently)
    f.hpline.style.width = `${p.hp}%`
    f.flash.style.opacity = (p.flashed / 255).toFixed(2)
    f.hp.hidden = dead
    f.skull.hidden = !dead
    setText(f.hp, p.hp)
    setText(f.name, p.name)
    setHtml(f.kills, String(p.roundKills), killsHtml(p.roundKills))
    const main = p.primary || p.secondary
    setIcon(f.weapon, dead ? '' : weaponIcon(main?.name))
    f.weapon.classList.toggle('active', !!main && main === p.active)
    setIcon(f.armor, armorIcon(p))
    // bomb / defuse kit next to the armor (the FPG-style tile header; other themes keep them in the grenade row)
    setIcon(f.equip, p.hasBomb ? uiIcon('icon_c4_default') : p.defuseKit ? uiIcon('icon_defuse_default') : '')
    f.equip.classList.toggle('bomb', p.hasBomb)
    setText(f.kn, p.roundKills > 0 ? p.roundKills : '')
    f.badge.dataset.kind = dead ? '' : p.hasBomb ? 'bomb' : p.defuseKit ? 'kit' : ''
    setIcon(f.badgeIc, dead ? '' : p.hasBomb ? uiIcon('icon_c4_default') : p.defuseKit ? uiIcon('icon_defuse_default') : '')
    setText(f.money, `$${p.money}`)
    setHtml(f.util, utilityKey(p), utilityHtml(p))
    setHtml(
      f.kd,
      `${p.stats.kills}/${p.stats.deaths}`,
      `${iconHtml(uiIcon('kills'), 'ic-k')}<b>${p.stats.kills}</b>${iconHtml(uiIcon('deaths'), 'ic-d')}<b>${p.stats.deaths}</b>`
    )
  }
}

export function createPlayers(root) {
  const rows = Array.from({ length: 5 }, () => createPlayerRow(root))
  return (players) => rows.forEach((update, i) => update(players[i]))
}

// ---------- Observed player ----------
export function createObserved(root) {
  const { node, f } = mount(
    root,
    `<div class="ob">
      <div class="ob-flash" data-f="flash"></div>
      <img class="ob-avatar" data-f="avatar" hidden />
      <div class="ob-main">
        <div class="ob-name-row">
          <span class="ob-name" data-f="name"></span>
          <span class="ob-kills" data-f="kills"></span>
        </div>
        <div class="ob-stats">
          <span>K <b data-f="k"></b></span>
          <span>A <b data-f="a"></b></span>
          <span>D <b data-f="d"></b></span>
        </div>
      </div>
      <div class="ob-util" data-f="util"></div>
      <div class="ob-vitals">
        <div class="ob-hp">
          ${iconHtml(uiIcon('icon_health_default'), 'ob-hp-icon')}
          <span data-f="hp"></span>
        </div>
        <div class="ob-armor">
          <i class="ic" data-f="armorIcon"></i>
          <span data-f="armor"></span>
        </div>
      </div>
      <div class="ob-ammo">
        <i class="ic ob-weapon" data-f="weapon"></i>
        <div class="ob-ammo-count">
          ${iconHtml(uiIcon('icon_bullets_default'), 'ob-bullets')}
          <b data-f="clip"></b><span data-f="reserve"></span>
        </div>
      </div>
      <div class="ob-hpline"><div data-f="hpline"></div></div>
    </div>`
  )
  return (p, cfg) => {
    node.classList.toggle('show', !!p && !cfg.hide_observed)
    if (!p) return
    node.dataset.side = p.side
    node.classList.toggle('low', p.hp <= 25)
    node.style.setProperty('--hp', p.hp) // FPG: the header band shows the HP like the player tiles
    f.flash.style.opacity = (p.flashed / 255).toFixed(2)
    // photo or silhouette, like the player tiles
    const photo = p.avatar ? asset(p.avatar) : agentOf(p.side, p.steamid)
    f.avatar.hidden = false
    if (f.avatar.getAttribute('src') !== photo) f.avatar.src = photo
    setText(f.name, p.name)
    setHtml(f.kills, String(p.roundKills), killsHtml(p.roundKills))
    setText(f.k, p.stats.kills)
    setText(f.a, p.stats.assists)
    setText(f.d, p.stats.deaths)
    setHtml(f.util, utilityKey(p), utilityHtml(p))
    setText(f.hp, p.hp)
    f.hpline.style.width = `${p.hp}%`
    setIcon(f.armorIcon, armorIcon(p) || uiIcon('icon_armor_none_default'))
    setText(f.armor, p.armor)
    const w = p.active
    setIcon(f.weapon, weaponIcon(w?.name))
    const hasAmmo = !!w?.ammo_clip_max
    f.clip.parentElement.hidden = !hasAmmo
    setText(f.clip, hasAmmo ? w.ammo_clip : '')
    setText(f.reserve, hasAmmo ? ` / ${w.ammo_reserve}` : '')
  }
}
