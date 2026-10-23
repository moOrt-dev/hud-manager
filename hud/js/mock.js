// Fake GSI payload for styling without CS2: open index.html?mock=1
const W = (name, type, state = 'holstered', extra = {}) => ({ name, type, state, ...extra })

const player = (i, team, name, hp, money, weapons) => ({
  name,
  observer_slot: i === 9 ? 0 : i + 1,
  team,
  state: { health: hp, armor: hp ? 100 : 0, helmet: i % 2 === 0, money, flashed: i === 7 ? 180 : 0, round_kills: i % 3, round_killhs: i % 2, round_totaldmg: 40 + i * 23, equip_value: 4700, defusekit: team === 'CT' && i % 2 === 1 },
  match_stats: { kills: 10 + i, assists: i, deaths: 8 + (i % 4), mvps: i % 4, score: 30 },
  weapons: Object.fromEntries(weapons.map((w, k) => [`weapon_${k}`, w]))
})

const rifle = (n) => W(n, 'Rifle', 'active', { ammo_clip: 23, ammo_clip_max: 30, ammo_reserve: 90 })
const nades = [W('weapon_smokegrenade', 'Grenade'), W('weapon_flashbang', 'Grenade'), W('weapon_hegrenade', 'Grenade')]

const players = [
  player(0, 'CT', 'ctPlayer1', 100, 3400, [rifle('weapon_m4a1_silencer'), W('weapon_usp_silencer', 'Pistol'), ...nades]),
  player(1, 'CT', 'ctPlayer2', 76, 1200, [W('weapon_awp', 'SniperRifle', 'active', { ammo_clip: 4, ammo_clip_max: 5, ammo_reserve: 30 }), W('weapon_hkp2000', 'Pistol')]),
  player(2, 'CT', 'ctPlayer3', 0, 800, []),
  player(3, 'CT', 'ctPlayer4', 34, 5600, [rifle('weapon_famas'), W('weapon_flashbang', 'Grenade')]),
  player(4, 'CT', 'ctPlayer5', 100, 250, [rifle('weapon_m4a1'), W('weapon_incgrenade', 'Grenade')]),
  player(5, 'T', 'tPlayer1', 100, 4100, [rifle('weapon_ak47'), W('weapon_c4', 'C4'), ...nades]),
  player(6, 'T', 'tPlayer2', 12, 900, [W('weapon_glock', 'Pistol', 'active', { ammo_clip: 20, ammo_clip_max: 20, ammo_reserve: 120 })]),
  player(7, 'T', 'tPlayer3', 100, 2300, [rifle('weapon_galilar'), W('weapon_molotov', 'Grenade')]),
  player(8, 'T', 'tPlayer4', 0, 3000, []),
  player(9, 'T', 'tPlayer5', 88, 6500, [rifle('weapon_sg556')])
]

// Mirage positions (game units) + view directions
const POS = [
  [-1650, -2000], [-900, -2300], [-300, -1700], [-1200, -600], [-2000, 400],
  [400, -1500], [-500, -2200], [1100, 0], [700, -600], [-100, -300]
]
players.forEach((p, i) => {
  p.position = `${POS[i][0]}, ${POS[i][1]}, -160`
  const a = i * 0.7
  p.forward = `${Math.cos(a).toFixed(2)}, ${Math.sin(a).toFixed(2)}, 0`
})

export const mockRaw = {
  map: {
    name: 'de_mirage',
    phase: 'live',
    round: 14,
    team_ct: { score: 8, consecutive_round_losses: 1, name: 'CT Team' },
    round_wins: { 1: 't_win_elimination', 2: 't_win_bomb', 3: 'ct_win_time', 4: 't_win_elimination', 5: 't_win_elimination', 6: 't_win_bomb', 7: 't_win_elimination', 8: 'ct_win_defuse', 9: 'ct_win_elimination', 10: 'ct_win_elimination', 11: 'ct_win_time', 12: 'ct_win_elimination', 13: 't_win_elimination', 14: 't_win_elimination' },
    team_t: { score: 6, consecutive_round_losses: 2, name: 'T Team' }
  },
  round: { phase: 'live', bomb: 'planted' },
  bomb: { state: 'planted', countdown: '24.1', position: '-350, -2150, -170' },
  grenades: {
    101: { owner: '76561190000000000', type: 'smoke', position: '-700, -1300, -160', effecttime: '8.0' },
    102: { owner: '76561190000000005', type: 'smoke', position: '-1000, -1900, -160', effecttime: '15.0' },
    103: { owner: '76561190000000007', type: 'inferno', flames: { a: '-950, -600, -160', b: '-990, -640, -160', c: '-920, -660, -160' } },
    104: { owner: '76561190000000006', type: 'flashbang', position: '0, -1000, -100', lifetime: '0.6' },
    105: { owner: '76561190000000001', type: 'frag', position: '-1400, -1200, -100', lifetime: '0.8' },
    106: { owner: '76561190000000008', type: 'firebomb', position: '400, -700, -100', lifetime: '0.5' },
    107: { owner: '76561190000000003', type: 'smoke', position: '-600, -400, -100', lifetime: '0.4', effecttime: '0' },
    108: { owner: '76561190000000002', type: 'decoy', position: '-1700, -1600, -160', lifetime: '5' }
  },
  phase_countdowns: { phase: 'bomb', phase_ends_in: '24.1' },
  player: { steamid: '76561190000000001', team: 'CT' },
  allplayers: Object.fromEntries(players.map((p, i) => [`7656119000000000${i}`, p]))
}

// Two consecutive player snapshots so the killfeed has something to show
export function mockKillFrames() {
  const before = structuredClone(mockRaw)
  const after = structuredClone(mockRaw)
  const ids = Object.keys(after.allplayers)
  const kill = (killer, victim, hs, assister) => {
    const k = after.allplayers[ids[killer]]
    k.match_stats.kills += 1
    if (hs) k.state.round_killhs = (k.state.round_killhs || 0) + 1
    after.allplayers[ids[victim]].match_stats.deaths += 1
    if (assister !== undefined) after.allplayers[ids[assister]].match_stats.assists += 1
  }
  kill(0, 8, true)
  kill(5, 2, false, 7)
  kill(1, 6, true)
  return [before, after]
}

// 14 finished rounds of per-player damage/headshots, like the manager stores them
function mockRounds() {
  return Array.from({ length: 14 }, (_, r) => ({
    round: r + 1,
    players: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`7656119000000000${i}`, { kills: 1, killshs: (r + i) % 2, damage: 30 + ((r * 7 + i * 13) % 90) }])
    )
  }))
}

export const mockMatch = {
  id: 'mock',
  current: true,
  matchType: 'bo3',
  left: { id: 'ta', wins: 1 },
  right: { id: 'tb', wins: 0 },
  vetos: [
    { teamId: 'ta', mapName: 'de_anubis', side: 'NO', type: 'ban', mapEnd: false },
    { teamId: 'tb', mapName: 'de_vertigo', side: 'NO', type: 'ban', mapEnd: false },
    { teamId: 'ta', mapName: 'de_inferno', side: 'CT', type: 'pick', mapEnd: true, winner: 'ta', score: { ta: 13, tb: 9 } },
    { teamId: 'tb', mapName: 'de_mirage', side: 'T', type: 'pick', mapEnd: false, rounds: mockRounds() },
    { teamId: 'ta', mapName: 'de_nuke', side: 'NO', type: 'ban', mapEnd: false },
    { teamId: 'tb', mapName: 'de_train', side: 'NO', type: 'ban', mapEnd: false },
    { teamId: '', mapName: 'de_ancient', side: 'NO', type: 'decider', mapEnd: false }
  ]
}

export const mockTeams = {
  ta: { _id: 'ta', name: 'CT Team', shortName: 'CTT', logo: '', country: '', extra: {} },
  tb: { _id: 'tb', name: 'T Team', shortName: 'TT', logo: '', country: '', extra: {} }
}

export const mockConfig ={ display_settings: { tournament_name: 'My Cup', tournament_stage: 'Grand Final', fire_on: true } }
