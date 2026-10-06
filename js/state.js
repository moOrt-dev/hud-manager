// Turns the raw CS2 GSI payload + manager data (match/teams/players) into a flat view model.

const PRIMARY_TYPES = ['Rifle', 'SniperRifle', 'Submachine Gun', 'Shotgun', 'Machine Gun']

const WEAPON_NAMES = {
  ak47: 'AK-47', m4a1: 'M4A4', m4a1_silencer: 'M4A1-S', awp: 'AWP', ssg08: 'SSG 08',
  aug: 'AUG', sg556: 'SG 553', galilar: 'Galil', famas: 'FAMAS', mp9: 'MP9', mac10: 'MAC-10',
  mp7: 'MP7', mp5sd: 'MP5-SD', ump45: 'UMP-45', p90: 'P90', bizon: 'PP-Bizon', nova: 'Nova',
  xm1014: 'XM1014', mag7: 'MAG-7', sawedoff: 'Sawed-Off', m249: 'M249', negev: 'Negev',
  g3sg1: 'G3SG1', scar20: 'SCAR-20', glock: 'Glock', hkp2000: 'P2000', usp_silencer: 'USP-S',
  p250: 'P250', fiveseven: 'Five-SeveN', tec9: 'Tec-9', cz75a: 'CZ75', deagle: 'Deagle',
  revolver: 'R8', elite: 'Dualies', hegrenade: 'HE', flashbang: 'Flash', smokegrenade: 'Smoke',
  molotov: 'Molotov', incgrenade: 'Incendiary', decoy: 'Decoy', c4: 'C4', taser: 'Zeus'
}

// SVGs in ./icons/weapons (from lexogrine/cs2-react-hud, MIT)
const WEAPON_ICONS = new Set(
  ('ak47 aug awp bayonet bizon c4 cz75a deagle decoy elite famas fiveseven flashbang g3sg1 galilar ' +
    'glock hegrenade hkp2000 incgrenade inferno knife knife_bayonet knife_butterfly knife_canis knife_cord ' +
    'knife_css knife_falchion knife_flip knife_gut knife_gypsy_jackknife knife_karambit knife_m9_bayonet ' +
    'knife_outdoor knife_push knife_skeleton knife_stiletto knife_survival_bowie knife_t knife_tactical ' +
    'knife_ursus knife_widowmaker m249 m4a1 m4a1_silencer mac10 mag7 molotov mp5sd mp7 mp9 negev nova ' +
    'p250 p90 revolver sawedoff scar20 sg556 smokegrenade ssg08 taser tec9 ump45 usp_silencer xm1014').split(' ')
)

// Absolute URLs: a relative url() inside a CSS variable would resolve against css/hud.css
const ICONS = new URL('../icons/', import.meta.url).href

export const weaponIcon = (raw) => {
  const key = (raw || '').replace(/^weapon_/, '')
  if (!key) return ''
  if (WEAPON_ICONS.has(key)) return `${ICONS}weapons/${key}.svg`
  if (/^(knife|bayonet)/.test(key)) return `${ICONS}weapons/knife.svg`
  return ''
}

export const uiIcon = (name) => `${ICONS}ui/${name}.svg`

export const weaponName = (raw) => {
  const key = (raw || '').replace(/^weapon_/, '')
  if (/^(knife|bayonet)/.test(key)) return 'Knife'
  return WEAPON_NAMES[key] || key.toUpperCase()
}

// GSI vectors come as "x, y, z" strings
export const vec = (s) => (typeof s === 'string' ? s.split(',').map(Number) : Array.isArray(s) ? s : null)

// Rounds won in a row by the team that is on `side` now. round_wins holds side-based outcomes
// ("ct_win_...", "t_win_..."), so earlier rounds are mapped through the side swaps:
// regulation halves of 12 rounds (MR12), overtime halves of 3.
const halfIndex = (r) => (r <= 24 ? Math.floor((r - 1) / 12) : 2 + Math.floor((r - 25) / 3))
function winStreak(roundWins, side, lastRound) {
  if (!roundWins || !lastRound) return 0
  const other = side === 'CT' ? 'T' : 'CT'
  const nowHalf = halfIndex(lastRound + 1)
  let streak = 0
  for (let r = lastRound; r >= 1; r--) {
    const outcome = roundWins[r]
    if (!outcome) break
    const winner = outcome.startsWith('ct') ? 'CT' : 'T'
    const teamSide = halfIndex(r) % 2 === nowHalf % 2 ? side : other
    if (winner !== teamSide) break
    streak++
  }
  return streak
}

// observer_slot 1..9,0 -> sort order 1..10
const slotOrder = (s) => (s === 0 ? 10 : (s ?? 99))

function buildPlayer(steamid, p, dbPlayers, observedId) {
  const weapons = Object.values(p.weapons || {})
  const db = dbPlayers[steamid]
  const s = p.state || {}
  return {
    steamid,
    name: db?.username || p.name,
    avatar: db?.avatar || '',
    slot: p.observer_slot,
    side: p.team,
    hp: s.health ?? 0,
    armor: s.armor ?? 0,
    helmet: !!s.helmet,
    money: s.money ?? 0,
    flashed: s.flashed ?? 0, // 0..255
    burning: s.burning ?? 0,
    defuseKit: !!s.defusekit,
    roundKills: s.round_kills ?? 0,
    roundKillHs: s.round_killhs ?? 0,
    roundDamage: s.round_totaldmg ?? 0,
    equipValue: s.equip_value ?? 0,
    stats: p.match_stats || { kills: 0, assists: 0, deaths: 0 },
    primary: weapons.find((w) => PRIMARY_TYPES.includes(w.type)),
    secondary: weapons.find((w) => w.type === 'Pistol'),
    // GSI marks the weapon in hand 'active', or 'reloading' while it reloads (it is still in hand)
    active: weapons.find((w) => w.state === 'active' || w.state === 'reloading'),
    grenades: weapons.filter((w) => w.type === 'Grenade'),
    hasBomb: weapons.some((w) => w.type === 'C4'),
    observed: steamid === observedId,
    pos: vec(p.position),
    forward: vec(p.forward)
  }
}

/**
 * ctx: { match, teams: {[id]: team}, players: {[steamid]: player} }
 * Screen-left is always match.left. reverseSide=false means match.left plays CT;
 * the manager flips reverseSide at halftime (autoSwitchSides).
 */
export function buildState(raw, ctx) {
  const map = raw.map || {}
  const mapName = (map.name || '').split('/').pop()
  const veto = ctx.match?.vetos?.find((v) => v.mapName === mapName)
  const leftSide = veto?.reverseSide ? 'T' : 'CT'
  const rightSide = leftSide === 'CT' ? 'T' : 'CT'

  const observedId = raw.player?.team ? raw.player.steamid : null
  const all = Object.entries(raw.allplayers || {})
    .map(([id, p]) => buildPlayer(id, p, ctx.players, observedId))
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot))

  const team = (side, matchSide) => {
    const gsiTeam = side === 'CT' ? map.team_ct : map.team_t
    const dbTeam = ctx.match?.[matchSide]?.id ? ctx.teams[ctx.match[matchSide].id] : null
    return {
      side,
      name: dbTeam?.name || gsiTeam?.name || (side === 'CT' ? 'Counter-Terrorists' : 'Terrorists'),
      shortName: dbTeam?.shortName || '',
      logo: dbTeam?.logo || '',
      score: gsiTeam?.score ?? 0,
      mapWins: ctx.match?.[matchSide]?.wins ?? 0,
      lossStreak: gsiTeam?.consecutive_round_losses ?? 0,
      winStreak: winStreak(map.round_wins, side, map.round ?? 0),
      // Money the team gets if it loses the next round: $1400 + $500 per loss in the streak, max $3400
      lossBonus: 1400 + 500 * Math.min(gsiTeam?.consecutive_round_losses ?? 0, 4),
      timeouts: gsiTeam?.timeouts_remaining ?? 0,
      players: all.filter((p) => p.side === side),
      id: dbTeam?._id || null
    }
  }

  const bestOf = { bo1: 1, bo2: 2, bo3: 3, bo5: 5 }[ctx.match?.matchType] || 1
  // which map of the series this is: position among picks/decider, else maps won so far + 1
  const played = (ctx.match?.vetos || []).filter((v) => v.mapName && v.type !== 'ban')
  const pickIndex = played.findIndex((v) => v.mapName === mapName)
  const mapNumber = pickIndex >= 0 ? pickIndex + 1 : (ctx.match?.left?.wins ?? 0) + (ctx.match?.right?.wins ?? 0) + 1

  // round_wins: { "1": "ct_win_elimination", ... } -> outcome of the round that just ended
  const outcome = map.round_wins?.[map.round] || ''
  const winType = outcome.includes('defuse')
    ? 'defuse'
    : outcome.includes('bomb')
      ? 'bomb'
      : outcome.includes('time')
        ? 'time'
        : 'elimination'

  return {
    mapName,
    round: (map.round ?? 0) + (raw.round?.phase === 'over' ? 0 : 1),
    completedRounds: map.round ?? 0,
    phase: raw.phase_countdowns?.phase || raw.round?.phase || '',
    phaseEndsIn: Number(raw.phase_countdowns?.phase_ends_in ?? 0),
    bomb: raw.bomb || null,
    roundWinner: raw.round?.phase === 'over' ? raw.round?.win_team : null,
    winType,
    left: team(leftSide, 'left'),
    right: team(rightSide, 'right'),
    bestOf,
    mapNumber,
    players: all,
    veto: veto || null,
    observed: all.find((p) => p.observed) || null,
    grenades: raw.grenades || {}
  }
}
