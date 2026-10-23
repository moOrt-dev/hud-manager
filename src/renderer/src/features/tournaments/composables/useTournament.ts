import { ref, onMounted, onUnmounted } from 'vue'
import { API_URL } from '../../../index'
import { socket } from '../../../socket'

export type BracketSection = 'upper' | 'lower' | 'final'

export interface ResolvedNode {
  bracket: BracketSection
  round: number
  slot: number
  teamAId: string | null
  teamBId: string | null
  winnerTeamId: string | null
  loserTeamId: string | null
  match: {
    id: string
    matchType: 'bo1' | 'bo2' | 'bo3' | 'bo5'
    current: boolean
    left: { id: string | null; wins: number }
    right: { id: string | null; wins: number }
  } | null
}

export interface ResolvedTournament {
  id: string
  name: string
  size: 4 | 8 | 16 | 32
  upper: ResolvedNode[][]
  lower: ResolvedNode[][]
  final: ResolvedNode
  championTeamId: string | null
}

// A single bracket's live state: fetch, seed/winner mutations, and auto-refresh whenever the
// backend says the bracket or any match changed (a linked match's score can change through GSI
// without the tournament domain knowing, so both socket events are watched).
export function useTournament(tournamentId: () => string | null) {
  const tournament = ref<ResolvedTournament | null>(null)
  const isLoading = ref(false)

  const fetchTournament = async () => {
    const id = tournamentId()
    if (!id) {
      tournament.value = null
      return
    }
    isLoading.value = true
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}`)
      if (res.ok) tournament.value = await res.json()
    } catch (error) {
      console.error('Failed to fetch tournament:', error)
    } finally {
      isLoading.value = false
    }
  }

  const setSeed = async (slot: number, side: 'A' | 'B', teamId: string | null) => {
    const id = tournamentId()
    if (!id) return
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}/seed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, side, teamId })
      })
      if (res.ok) tournament.value = await res.json()
    } catch (error) {
      console.error('Failed to set seed:', error)
    }
  }

  const setWinner = async (bracket: BracketSection, round: number, slot: number, teamId: string | null) => {
    const id = tournamentId()
    if (!id) return
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}/winner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracket, round, slot, teamId })
      })
      if (res.ok) tournament.value = await res.json()
    } catch (error) {
      console.error('Failed to set winner:', error)
    }
  }

  const onChange = () => fetchTournament()
  onMounted(() => {
    socket.on('tournament', onChange)
    socket.on('match', onChange)
  })
  onUnmounted(() => {
    socket.off('tournament', onChange)
    socket.off('match', onChange)
  })

  return { tournament, isLoading, fetchTournament, setSeed, setWinner }
}
