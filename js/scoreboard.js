// Custom scoreboard (replaces the in-game TAB for viewers). Three views on separate hotkeys:
//   stats   (Alt+1) - K / A / D, +/-, ADR, HS%, MVP
//   economy (Alt+2) - money, equipment value, loadout, utility
//   leaders (Alt+3) - match leaders + team comparison bars
// Look follows the active theme (CSS variables + [data-theme] rules in hud.css).
import { asset } from './api.js'
import { weaponIcon, weaponName, uiIcon } from './state.js'
import { sideLogo } from './render.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const icon = (src, cls = '') => (src ? `<i class="ic ${cls}" style="--src:url('${src}')"></i>` : '')
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`
const signed = (n) => (n > 0 ? `+${n}` : String(n))

const TITLES = { stats: 'Scoreboard', economy: 'Economy & loadout', leaders: 'Match leaders' }

// Fixed column widths (table-layout: fixed in hud.css): purchases / kills change only the cell contents,
// the columns themselves never move. Player = the rest of the 1048 px table width.
const cols = (widths) => `<colgroup>${widths.map((w) => `<col${w ? ` style="width:${w}px"` : ''} />`).join('')}</colgroup>`
const STATS_COLS = cols([36, 0, 64, 64, 64, 72, 72, 72, 72])
const ECO_COLS = cols([36, 0, 112, 112, 210, 80, 130, 96])

function teamHeader(t, pos) {
  const logo = `<img src="${esc(t.logo ? asset(t.logo) : sideLogo(t.side))}" />`
  return `
    <div class="sb-team-head ${pos}" data-side="${t.side}">
      <div class="sb-logo">${logo}</div>
      <div class="sb-team-name">${esc(t.name)}<small>${t.side === 'CT' ? 'Counter-Terrorists' : 'Terrorists'}</small></div>
      <div class="sb-team-score">${t.score}</div>
    </div>`
}

// ---------- stats view ----------
function statsTable(t, stats, st) {
  const rows = t.players
    .map((p) => ({ p, s: stats.playerStats(p, st) }))
    .sort((a, b) => b.p.stats.kills - a.p.stats.kills || b.s.adr - a.s.adr)
    .map(
      ({ p, s }) => `
      <tr class="${p.hp <= 0 ? 'dead' : ''}">
        <td class="sb-slot">${p.slot ?? ''}</td>
        <td class="sb-player">
          <span class="sb-hp"><i style="width:${p.hp}%"></i></span>${esc(p.name)}
        </td>
        <td>${p.stats.kills}</td>
        <td>${p.stats.assists}</td>
        <td>${p.stats.deaths}</td>
        <td class="${s.diff > 0 ? 'pos' : s.diff < 0 ? 'neg' : ''}">${signed(s.diff)}</td>
        <td class="sb-strong">${s.adr}</td>
        <td>${s.hsPct}%</td>
        <td>${p.stats.mvps ? `★ ${p.stats.mvps}` : ''}</td>
      </tr>`
    )
  return `
    <table class="sb-table sb-fixed" data-side="${t.side}">
      ${STATS_COLS}
      <thead><tr><th></th><th>Player</th><th>K</th><th>A</th><th>D</th><th>+/-</th><th>ADR</th><th>HS%</th><th>MVP</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`
}

// ---------- economy view ----------
function economyTable(t) {
  const rows = t.players.map((p) => {
    const nades = p.grenades.map((g) => icon(weaponIcon(g.name), 'sb-nade')).join('')
    const armor = p.armor > 0 ? icon(uiIcon(p.helmet ? 'icon_armor_helmet_default' : 'icon_armor_full_default'), 'sb-armor') : ''
    const extra = (p.hasBomb ? icon(uiIcon('icon_c4_default'), 'sb-bomb') : '') + (p.defuseKit ? icon(uiIcon('icon_defuse_default'), 'sb-kit') : '')
    return `
      <tr class="${p.hp <= 0 ? 'dead' : ''}">
        <td class="sb-slot">${p.slot ?? ''}</td>
        <td class="sb-player">${esc(p.name)}</td>
        <td class="sb-money">${money(p.money)}</td>
        <td>${money(p.equipValue)}</td>
        <td class="sb-gun">${icon(weaponIcon(p.primary?.name), 'sb-primary')}<small>${esc(p.primary ? weaponName(p.primary.name) : '')}</small></td>
        <td class="sb-gun">${icon(weaponIcon(p.secondary?.name), 'sb-secondary')}</td>
        <td class="sb-icons">${nades}</td>
        <td class="sb-icons">${armor}${extra}</td>
      </tr>`
  })
  const total = (f) => t.players.reduce((s, p) => s + f(p), 0)
  return `
    <table class="sb-table sb-fixed" data-side="${t.side}">
      ${ECO_COLS}
      <thead><tr><th></th><th>Player</th><th>Money</th><th>Equip</th><th>Primary</th><th>Pistol</th><th>Utility</th><th>Gear</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr>
        <td></td><td>Team</td>
        <td class="sb-money">${money(total((p) => p.money))}</td>
        <td>${money(total((p) => p.equipValue))}</td>
        <td colspan="4">Loss bonus ${money(t.lossBonus)} · ${total((p) => p.grenades.length)} grenades</td>
      </tr></tfoot>
    </table>`
}

// ---------- leaders view ----------
function leadersView(st, stats) {
  const all = st.players.map((p) => ({ p, s: stats.playerStats(p, st) }))
  const best = (label, value, fmt = String) => {
    const top = [...all].sort((a, b) => value(b) - value(a))[0]
    if (!top || !value(top)) return ''
    return `
      <div class="sb-card" data-side="${top.p.side}">
        <div class="sb-card-label">${label}</div>
        <div class="sb-card-value">${fmt(value(top))}</div>
        <div class="sb-card-name">${esc(top.p.name)}</div>
      </div>`
  }
  const cards = [
    best('Most kills', (x) => x.p.stats.kills),
    best('Best ADR', (x) => x.s.adr),
    best('Headshot %', (x) => (x.p.stats.kills >= 3 ? x.s.hsPct : 0), (v) => `${v}%`),
    best('Most MVPs', (x) => x.p.stats.mvps ?? 0, (v) => `★ ${v}`),
    best('Best +/-', (x) => x.s.diff, signed),
    best('Most assists', (x) => x.p.stats.assists)
  ].join('')

  const sum = (t, f) => t.players.reduce((s, p) => s + f(p), 0)
  const avg = (t, f) => (t.players.length ? sum(t, f) / t.players.length : 0)
  const statOf = (p) => stats.playerStats(p, st)
  const bar = (label, l, r, fmt = (v) => Math.round(v)) => {
    const total = l + r || 1
    return `
      <div class="sb-bar">
        <span class="sb-bar-l">${fmt(l)}</span>
        <div class="sb-bar-track">
          <i class="l" data-side="${st.left.side}" style="width:${(l / total) * 100}%"></i>
          <i class="r" data-side="${st.right.side}" style="width:${(r / total) * 100}%"></i>
          <em>${label}</em>
        </div>
        <span class="sb-bar-r">${fmt(r)}</span>
      </div>`
  }
  const L = st.left
  const R = st.right
  return `
    <div class="sb-cards">${cards || '<div class="sb-empty">No stats yet</div>'}</div>
    <div class="sb-bars">
      ${bar('Kills', sum(L, (p) => p.stats.kills), sum(R, (p) => p.stats.kills))}
      ${bar('Avg ADR', avg(L, (p) => statOf(p).adr), avg(R, (p) => statOf(p).adr))}
      ${bar('Alive', L.players.filter((p) => p.hp > 0).length, R.players.filter((p) => p.hp > 0).length)}
      ${bar('Team money', sum(L, (p) => p.money), sum(R, (p) => p.money), money)}
      ${bar('Equipment', sum(L, (p) => p.equipValue), sum(R, (p) => p.equipValue), money)}
      ${bar('Utility', sum(L, (p) => p.grenades.length), sum(R, (p) => p.grenades.length))}
    </div>`
}

export function createScoreboard(root) {
  const box = document.createElement('div')
  box.className = 'sb'
  root.appendChild(box)
  let html = ''

  return (st, stats, view, cfg) => {
    const show = !!view && !!st
    box.classList.toggle('show', show)
    root.dataset.view = view || ''
    if (!show) return
    const body =
      view === 'economy'
        ? `<div class="sb-cols">${economyTable(st.left)}${economyTable(st.right)}</div>`
        : view === 'leaders'
          ? leadersView(st, stats)
          : `<div class="sb-cols">${statsTable(st.left, stats, st)}${statsTable(st.right, stats, st)}</div>`
    const next = `
      <div class="sb-head">
        ${teamHeader(st.left, 'left')}
        <div class="sb-center">
          <div class="sb-title">${TITLES[view]}</div>
          <div class="sb-meta">${esc(st.mapName.replace(/^de_/, '').toUpperCase())} · ROUND ${st.round}${
            cfg.tournament_name ? ` · ${esc(cfg.tournament_name)}` : ''
          }</div>
          <div class="sb-tabs">
            <span class="${view === 'stats' ? 'on' : ''}">Stats</span>
            <span class="${view === 'economy' ? 'on' : ''}">Economy</span>
            <span class="${view === 'leaders' ? 'on' : ''}">Leaders</span>
          </div>
        </div>
        ${teamHeader(st.right, 'right')}
      </div>
      ${body}`
    if (next !== html) {
      html = next
      box.innerHTML = next
    }
  }
}
