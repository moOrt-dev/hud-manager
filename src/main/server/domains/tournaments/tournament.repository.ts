import { dbAll, dbGet, dbRun } from '../../database/sqlite'
import { Tournament, TournamentNode, CreateTournamentDTO, BracketSection } from './tournament.types'
import crypto from 'crypto'

export class TournamentRepository {
  private mapRowToTournament(row: any): Tournament {
    return { id: row.id, name: row.name || '', size: row.size, createdAt: row.created_at }
  }

  private mapRowToNode(row: any): TournamentNode {
    return {
      id: row.id,
      tournamentId: row.tournament_id,
      bracket: row.bracket,
      round: row.round,
      slot: row.slot,
      teamAId: row.team_a_id || null,
      teamBId: row.team_b_id || null,
      matchId: row.match_id || null,
      winnerOverride: row.winner_override || null
    }
  }

  async getAllTournaments(): Promise<Tournament[]> {
    const rows = await dbAll('SELECT * FROM tournaments ORDER BY created_at DESC')
    return rows.map((r) => this.mapRowToTournament(r))
  }

  async getTournamentById(id: string): Promise<Tournament | null> {
    const row = await dbGet('SELECT * FROM tournaments WHERE id = ?', [id])
    return row ? this.mapRowToTournament(row) : null
  }

  async renameTournament(id: string, name: string): Promise<void> {
    await dbRun('UPDATE tournaments SET name = ? WHERE id = ?', [name, id])
  }

  // Creates the tournament row plus an empty upper-bracket grid: log2(size) rounds,
  // size / 2^(round+1) nodes per round, every field null. The lower bracket and grand final are
  // added lazily by TournamentService.resolve() the first time the tournament is read.
  async createTournament(data: CreateTournamentDTO): Promise<Tournament> {
    const id = crypto.randomUUID()
    await dbRun('INSERT INTO tournaments (id, name, size) VALUES (?, ?, ?)', [id, data.name, data.size])

    const roundCount = Math.log2(data.size)
    const rows: { bracket: BracketSection; round: number; slot: number }[] = []
    for (let round = 0; round < roundCount; round++) {
      const matchCount = data.size / 2 ** (round + 1)
      for (let slot = 0; slot < matchCount; slot++) rows.push({ bracket: 'upper', round, slot })
    }
    await this.insertNodeRows(id, rows)
    return this.getTournamentById(id) as Promise<Tournament>
  }

  async deleteTournament(id: string): Promise<void> {
    await dbRun('DELETE FROM tournaments WHERE id = ?', [id])
  }

  async getNodes(tournamentId: string): Promise<TournamentNode[]> {
    const rows = await dbAll(
      'SELECT * FROM tournament_nodes WHERE tournament_id = ? ORDER BY bracket, round, slot',
      [tournamentId]
    )
    return rows.map((r) => this.mapRowToNode(r))
  }

  async hasNodes(tournamentId: string, bracket: BracketSection): Promise<boolean> {
    const row = await dbGet('SELECT 1 FROM tournament_nodes WHERE tournament_id = ? AND bracket = ? LIMIT 1', [
      tournamentId,
      bracket
    ])
    return !!row
  }

  async insertNodeRows(
    tournamentId: string,
    rows: { bracket: BracketSection; round: number; slot: number }[]
  ): Promise<void> {
    for (const r of rows) {
      await dbRun('INSERT OR IGNORE INTO tournament_nodes (id, tournament_id, bracket, round, slot) VALUES (?, ?, ?, ?, ?)', [
        crypto.randomUUID(),
        tournamentId,
        r.bracket,
        r.round,
        r.slot
      ])
    }
  }

  async setSeed(tournamentId: string, slot: number, side: 'A' | 'B', teamId: string | null): Promise<void> {
    const column = side === 'A' ? 'team_a_id' : 'team_b_id'
    await dbRun(
      `UPDATE tournament_nodes SET ${column} = ? WHERE tournament_id = ? AND bracket = 'upper' AND round = 0 AND slot = ?`,
      [teamId, tournamentId, slot]
    )
  }

  async setWinnerOverride(
    tournamentId: string,
    bracket: BracketSection,
    round: number,
    slot: number,
    teamId: string | null
  ): Promise<void> {
    await dbRun(
      'UPDATE tournament_nodes SET winner_override = ? WHERE tournament_id = ? AND bracket = ? AND round = ? AND slot = ?',
      [teamId, tournamentId, bracket, round, slot]
    )
  }

  // Which bracket a match belongs to, for the broadcast overlay: it knows the live match, not
  // which tournament it came from.
  async getTournamentIdByMatch(matchId: string): Promise<string | null> {
    const row = await dbGet('SELECT tournament_id FROM tournament_nodes WHERE match_id = ? LIMIT 1', [matchId])
    return row ? row.tournament_id : null
  }

  // True while any bracket cell anywhere still points at this match.
  async isMatchReferenced(matchId: string): Promise<boolean> {
    const row = await dbGet('SELECT 1 FROM tournament_nodes WHERE match_id = ? LIMIT 1', [matchId])
    return !!row
  }

  async setNodeMatch(
    tournamentId: string,
    bracket: BracketSection,
    round: number,
    slot: number,
    matchId: string | null
  ): Promise<void> {
    await dbRun(
      'UPDATE tournament_nodes SET match_id = ? WHERE tournament_id = ? AND bracket = ? AND round = ? AND slot = ?',
      [matchId, tournamentId, bracket, round, slot]
    )
  }
}
