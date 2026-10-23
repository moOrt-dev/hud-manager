// Compact tournament bracket for the broadcast overlay, toggled with Alt+U / Alt+L.
// The manager owns the bracket; this only draws what /api/tournaments/for-match/<id> hands back,
// so a winner ticked in the manager shows up here without the HUD knowing the rules.

import { asset } from './api.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Right-aligned to the actual round count, the same way the manager names them.
const UPPER_NAMES = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final']
const upperName = (count, i) => (i === count - 1 ? 'Upper Final' : UPPER_NAMES.slice(UPPER_NAMES.length - count)[i])
// Named off the end like the upper half: the last round is the final, the one before it the
// semifinal, and everything earlier keeps its number.
const lowerName = (count, i) =>
  i === count - 1 ? 'Lower Final' : i === count - 2 ? 'Lower Semifinal' : `Lower Round ${i + 1}`

const CELL = 58 // one match card, two team rows
const GAP = 14 // between neighbouring cells of the first round — sets the rhythm of the whole tree
const STUB = 17 // horizontal lead in and out of a cell; the column gap is twice this
const MAX_HEIGHT = 900 // the overlay is a fixed 1920x1080 canvas, so a deep bracket is scaled down

// Where every cell sits, measured from the top of its column. The first round is evenly spaced and
// each later cell is centred on the cells feeding it — halving rounds take two, and a lower-bracket
// drop round takes one (its other side falls in from the upper bracket, which is not drawn here).
function layout(rounds) {
  const tops = []
  rounds.forEach((round, r) => {
    if (r === 0) {
      tops.push(round.map((_, i) => i * (CELL + GAP)))
      return
    }
    const prev = tops[r - 1]
    const halves = prev.length === round.length * 2
    tops.push(round.map((_, i) => (halves ? (prev[2 * i] + prev[2 * i + 1]) / 2 : prev[i])))
  })
  return tops
}

export function createBracket(root) {
  const box = document.createElement('div')
  box.className = 'bracket'
  root.appendChild(box)

  const cell = (node, teams, top) => {
    const live = !!node.match?.current
    const row = (teamId, wins) => {
      const won = !!node.winnerTeamId && node.winnerTeamId === teamId
      const team = teamId ? teams[teamId] : null
      const name = teamId ? team?.shortName || team?.name || '???' : 'TBD'
      // The square is drawn for every row, logo or not, so the names stay on one line down a round.
      const logo = team?.logo ? `<img src="${esc(asset(team.logo))}" alt="" />` : ''
      return `<div class="br-row${won ? ' won' : ''}${teamId ? '' : ' tbd'}">
          <span class="br-logo">${logo}</span>
          <span class="br-name">${esc(name)}</span><span class="br-wins">${teamId ? wins : ''}</span>
        </div>`
    }
    return `<div class="br-cell${live ? ' live' : ''}" style="top:${top}px">
        ${live ? '<span class="br-live">LIVE</span>' : ''}
        ${row(node.teamAId, node.match?.left?.wins ?? 0)}
        ${row(node.teamBId, node.match?.right?.wins ?? 0)}
      </div>`
  }

  // The vertical piece of a join, drawn in the column the two feeders live in: it runs from the
  // centre of the upper feeder to the centre of the lower one, where the next cell's lead meets it.
  const joins = (tops, nextCount) => {
    if (tops.length !== nextCount * 2) return '' // 1:1 round — the two leads meet on their own
    let out = ''
    for (let i = 0; i < nextCount; i++) {
      const a = tops[2 * i] + CELL / 2
      const b = tops[2 * i + 1] + CELL / 2
      out += `<div class="br-join" style="top:${a}px;height:${b - a}px"></div>`
    }
    return out
  }

  const column = (round, teams, tops, nextCount, title, height) => `
      <div class="br-col">
        <div class="br-title">${esc(title)}</div>
        <div class="br-body" style="height:${height}px">
          ${round.map((n, i) => cell(n, teams, tops[i])).join('')}
          ${joins(tops, nextCount)}
        </div>
      </div>`

  // view: '' hides, 'upper' | 'lower' picks the half. The grand final closes the upper side,
  // which is where the two halves actually meet.
  const render = (tournament, teams, view) => {
    const half = view === 'upper' ? tournament?.upper : view === 'lower' ? tournament?.lower : null
    if (!half?.length) {
      box.classList.remove('show')
      return
    }
    const rounds = view === 'upper' && tournament.final ? [...half, [tournament.final]] : half
    const name = view === 'upper' ? upperName : lowerName
    const title = (i) => (i < half.length ? name(half.length, i) : 'Grand Final')

    const tops = layout(rounds)
    const height = Math.max(...tops.map((col) => col[col.length - 1] + CELL))
    const cols = rounds.map((round, i) =>
      column(round, teams, tops[i], rounds[i + 1]?.length ?? 0, title(i), height)
    )

    box.style.transform = ''
    box.innerHTML = `
      <div class="br-head">${view === 'upper' ? 'Upper Bracket' : 'Lower Bracket'}</div>
      <div class="br-cols">${cols.join('')}</div>`
    box.classList.add('show')

    const full = box.scrollHeight
    if (full > MAX_HEIGHT) box.style.transform = `scale(${(MAX_HEIGHT / full).toFixed(3)})`
  }

  return render
}
