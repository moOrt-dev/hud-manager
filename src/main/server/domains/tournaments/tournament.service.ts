import { TournamentRepository } from './tournament.repository'
import { MatchRepository } from '../matches/match.repository'
import { Match } from '../matches/match.types'
import {
  BracketSection,
  CreateTournamentDTO,
  ResolvedNode,
  ResolvedTournament,
  Tournament,
  TournamentNode
} from './tournament.types'

// A series is decided once one side's map wins reach this many (CS bo2 has no clean majority;
// treated the same as bo1 — first side to 2 wins, since draws aren't representable here).
const MAJORITY: Record<Match['matchType'], number> = { bo1: 1, bo2: 2, bo3: 2, bo5: 3 }

export class TournamentService {
  private repo = new TournamentRepository()
  private matchRepo = new MatchRepository()

  async getAllTournaments() {
    return this.repo.getAllTournaments()
  }

  async createTournament(data: CreateTournamentDTO) {
    return this.repo.createTournament(data)
  }

  async renameTournament(id: string, name: string) {
    await this.repo.renameTournament(id, name)
    return this.resolve(id)
  }

  async deleteTournament(id: string) {
    const existing = await this.repo.getTournamentById(id)
    if (!existing) throw new Error('Tournament not found')
    await this.repo.deleteTournament(id)
  }

  async setSeed(id: string, slot: number, side: 'A' | 'B', teamId: string | null) {
    await this.repo.setSeed(id, slot, side, teamId)
    return this.resolve(id)
  }

  async setWinner(id: string, bracket: BracketSection, round: number, slot: number, teamId: string | null) {
    await this.repo.setWinnerOverride(id, bracket, round, slot, teamId)
    return this.resolve(id)
  }

  private winnerOf(match: Match | null, override: string | null): string | null {
    if (override) return override
    if (!match) return null
    const need = MAJORITY[match.matchType] ?? 1
    if (match.left.id && match.left.wins >= need) return match.left.id
    if (match.right.id && match.right.wins >= need) return match.right.id
    return null
  }

  // Lazily creates/detaches the real Match behind one node whenever both its teams are known or
  // change, and reads off the winner/loser — the one place this logic lives, shared by the upper
  // bracket, the lower bracket and both grand-final matches. Runs on every read, not only right
  // after a mutation, since a match's score can change live through GSI without going through this
  // domain at all.
  private async resolveNode(
    tournamentId: string,
    node: TournamentNode | undefined,
    bracket: BracketSection,
    round: number,
    slot: number,
    teamAId: string | null,
    teamBId: string | null,
    matches: Map<string, Match>
  ): Promise<ResolvedNode> {
    let match = node?.matchId ? matches.get(node.matchId) || null : null
    const pairingChanged = !!match && (match.left.id !== teamAId || match.right.id !== teamBId)
    let winnerOverride = node?.winnerOverride ?? null

    if (teamAId && teamBId && (!match || pairingChanged)) {
      match = await this.matchRepo.createMatch({
        current: false,
        left: { id: teamAId, wins: 0 },
        right: { id: teamBId, wins: 0 },
        matchType: 'bo3',
        vetos: []
      })
      matches.set(match.id, match)
      await this.repo.setNodeMatch(tournamentId, bracket, round, slot, match.id)
      // A stale override (set for the previous pairing) can no longer name a team on either side
      // of the new match — drop it, or a team that just got knocked out could still "win" here.
      if (pairingChanged && winnerOverride) {
        await this.repo.setWinnerOverride(tournamentId, bracket, round, slot, null)
        winnerOverride = null
      }
    } else if (!(teamAId && teamBId)) {
      if (node?.matchId) {
        match = null
        await this.repo.setNodeMatch(tournamentId, bracket, round, slot, null)
      }
      if (winnerOverride) {
        await this.repo.setWinnerOverride(tournamentId, bracket, round, slot, null)
        winnerOverride = null
      }
    }

    const winnerTeamId = teamAId && teamBId ? this.winnerOf(match, winnerOverride) : null
    const loserTeamId = winnerTeamId ? (winnerTeamId === teamAId ? teamBId : teamAId) : null
    return { bracket, round, slot, teamAId, teamBId, winnerTeamId, loserTeamId, match }
  }

  // Lower-bracket round j (0-indexed) has size/2^(floor(j/2)+2) matches. j=0 pairs up upper round
  // 0's losers; even j>0 pairs up the previous lower round's winners against each other
  // ("consolidation"); odd j pairs the previous lower round's winners against upper round
  // (j+1)/2's losers ("drop round"). Verified by hand against the standard 4- and 8-team brackets.
  private buildLowerAndFinalRows(size: number) {
    const k = Math.log2(size)
    const rows: { bracket: BracketSection; round: number; slot: number }[] = []
    for (let j = 0; j < 2 * (k - 1); j++) {
      const matchCount = size / 2 ** (Math.floor(j / 2) + 2)
      for (let slot = 0; slot < matchCount; slot++) rows.push({ bracket: 'lower', round: j, slot })
    }
    rows.push({ bracket: 'final', round: 0, slot: 0 }) // grand final — the last stage
    return rows
  }

  // Backfills the lower bracket + grand final for a tournament created (or converted) before
  // this existed — upper-bracket data and its matches are untouched.
  private async ensureFullBracket(tournament: Tournament): Promise<void> {
    if (await this.repo.hasNodes(tournament.id, 'lower')) return
    await this.repo.insertNodeRows(tournament.id, this.buildLowerAndFinalRows(tournament.size))
  }

  async resolve(tournamentId: string): Promise<ResolvedTournament> {
    const tournament = await this.repo.getTournamentById(tournamentId)
    if (!tournament) throw new Error('Tournament not found')
    await this.ensureFullBracket(tournament)

    const nodes = await this.repo.getNodes(tournamentId)
    const matchIds = [...new Set(nodes.map((n) => n.matchId).filter((id): id is string => !!id))]
    const matches = new Map<string, Match>()
    for (const matchId of matchIds) {
      const match = await this.matchRepo.getMatchById(matchId)
      if (match) matches.set(matchId, match)
    }
    const byKey = new Map<string, TournamentNode>()
    for (const n of nodes) byKey.set(`${n.bracket}-${n.round}-${n.slot}`, n)

    const k = Math.log2(tournament.size)

    const upper: ResolvedNode[][] = []
    for (let round = 0; round < k; round++) {
      const matchCount = tournament.size / 2 ** (round + 1)
      const resolvedRound: ResolvedNode[] = []
      for (let slot = 0; slot < matchCount; slot++) {
        const seedNode = round === 0 ? byKey.get(`upper-0-${slot}`) : undefined
        const teamAId = round === 0 ? seedNode?.teamAId ?? null : upper[round - 1][2 * slot].winnerTeamId
        const teamBId = round === 0 ? seedNode?.teamBId ?? null : upper[round - 1][2 * slot + 1].winnerTeamId
        resolvedRound.push(
          await this.resolveNode(tournamentId, byKey.get(`upper-${round}-${slot}`), 'upper', round, slot, teamAId, teamBId, matches)
        )
      }
      upper.push(resolvedRound)
    }

    const lbRounds = 2 * (k - 1)
    const lower: ResolvedNode[][] = []
    for (let j = 0; j < lbRounds; j++) {
      const matchCount = tournament.size / 2 ** (Math.floor(j / 2) + 2)
      const resolvedRound: ResolvedNode[] = []
      for (let slot = 0; slot < matchCount; slot++) {
        let teamAId: string | null
        let teamBId: string | null
        if (j === 0) {
          teamAId = upper[0][2 * slot].loserTeamId
          teamBId = upper[0][2 * slot + 1].loserTeamId
        } else if (j % 2 === 0) {
          teamAId = lower[j - 1][2 * slot].winnerTeamId
          teamBId = lower[j - 1][2 * slot + 1].winnerTeamId
        } else {
          teamAId = lower[j - 1][slot].winnerTeamId
          teamBId = upper[(j + 1) / 2][slot].loserTeamId
        }
        resolvedRound.push(
          await this.resolveNode(tournamentId, byKey.get(`lower-${j}-${slot}`), 'lower', j, slot, teamAId, teamBId, matches)
        )
      }
      lower.push(resolvedRound)
    }

    const ubChampion = upper[k - 1][0].winnerTeamId
    const lbChampion = lower[lbRounds - 1][0].winnerTeamId
    // The grand final is the last stage. Whoever wins it is the champion: there is no bracket
    // reset, so the upper-bracket side carries no extra life into it for having stayed unbeaten.
    const final = await this.resolveNode(tournamentId, byKey.get('final-0-0'), 'final', 0, 0, ubChampion, lbChampion, matches)

    return { ...tournament, upper, lower, final, championTeamId: final.winnerTeamId }
  }
}
