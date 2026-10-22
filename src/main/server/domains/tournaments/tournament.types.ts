import { Match } from '../matches/match.types'

export interface Tournament {
  id: string
  name: string
  size: 4 | 8 | 16 | 32
  createdAt: string
}

export type CreateTournamentDTO = {
  name: string
  size: 4 | 8 | 16 | 32
}

export type BracketSection = 'upper' | 'lower' | 'final'

// A single bracket cell. Upper round 0 teams are picked by hand (teamAId/teamBId); every other
// node (later upper rounds, all of lower, both grand-final matches) is resolved from winners/
// losers elsewhere in the tree and never stored here directly.
export interface TournamentNode {
  id: string
  tournamentId: string
  bracket: BracketSection
  round: number
  slot: number
  teamAId: string | null
  teamBId: string | null
  matchId: string | null
  winnerOverride: string | null
}

// What the renderer actually needs for one cell, after resolving the whole tree forward.
export interface ResolvedNode {
  bracket: BracketSection
  round: number
  slot: number
  teamAId: string | null
  teamBId: string | null
  winnerTeamId: string | null
  loserTeamId: string | null
  match: Match | null
}

export interface ResolvedTournament extends Tournament {
  upper: ResolvedNode[][]
  lower: ResolvedNode[][]
  final: { match1: ResolvedNode; match2: ResolvedNode | null }
  championTeamId: string | null
}
