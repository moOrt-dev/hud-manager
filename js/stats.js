// Derived per-player stats that GSI doesn't send directly: ADR, HS%, round MVP.
// Per-round damage/headshots come from the manager's match record (veto.rounds, written by the
// server on every roundEnd) and fall back to what this HUD saw itself since it was opened.

export function createStats() {
  let mapName = ''
  let seen = {} // steamid -> { dmg: {round: n}, hs: {round: n} }
  let prevMvps = {}
  let mvp = null // { steamid, round }

  const track = (sid) => (seen[sid] ||= { dmg: {}, hs: {} })

  function update(st) {
    if (st.mapName !== mapName) {
      mapName = st.mapName
      seen = {}
      prevMvps = {}
      mvp = null
    }
    for (const p of st.players) {
      const t = track(p.steamid)
      t.dmg[st.round] = Math.max(t.dmg[st.round] || 0, p.roundDamage)
      t.hs[st.round] = Math.max(t.hs[st.round] || 0, p.roundKillHs)
      const m = p.stats.mvps ?? 0
      if (prevMvps[p.steamid] !== undefined && m > prevMvps[p.steamid]) {
        mvp = { steamid: p.steamid, round: st.round }
      }
      prevMvps[p.steamid] = m
    }
  }

  // Totals over completed rounds (+ the round that just ended while phase is "over")
  function playerStats(p, st) {
    const rounds = st.completedRounds
    const saved = st.veto?.rounds || []
    const t = track(p.steamid)
    let dmg = 0
    let hs = 0
    for (let r = 1; r <= rounds; r++) {
      const fromMatch = saved[r - 1]?.players?.[p.steamid]
      dmg += fromMatch?.damage ?? t.dmg[r] ?? 0
      hs += fromMatch?.killshs ?? t.hs[r] ?? 0
    }
    const kills = p.stats.kills ?? 0
    return {
      adr: rounds ? Math.round(dmg / rounds) : 0,
      hsPct: kills ? Math.round((Math.min(hs, kills) / kills) * 100) : 0,
      diff: kills - (p.stats.deaths ?? 0)
    }
  }

  // MVP of the round that just ended; falls back to the best player of the winning side
  function roundMvp(st) {
    if (!st.roundWinner) return null
    const byId = mvp && mvp.round === st.round && st.players.find((p) => p.steamid === mvp.steamid)
    if (byId) return byId
    return (
      st.players
        .filter((p) => p.side === st.roundWinner)
        .sort((a, b) => b.roundKills - a.roundKills || b.roundDamage - a.roundDamage)[0] || null
    )
  }

  return { update, playerStats, roundMvp }
}
