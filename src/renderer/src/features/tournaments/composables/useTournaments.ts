import { ref } from 'vue'
import { API_URL } from '../../../index'
import { useConfirmation } from '../../../composables/useConfirmation'

export interface TournamentSummary {
  id: string
  name: string
  size: 4 | 8 | 16 | 32
  createdAt: string
}

// List-level actions: create/rename/delete a tournament. The bracket itself (useTournament)
// is fetched separately once one is selected.
export function useTournaments() {
  const tournaments = ref<TournamentSummary[]>([])
  const isLoading = ref(false)

  const fetchTournaments = async () => {
    isLoading.value = true
    try {
      const res = await fetch(`${API_URL}/tournaments`)
      if (res.ok) tournaments.value = await res.json()
    } catch (error) {
      console.error('Failed to fetch tournaments:', error)
    } finally {
      isLoading.value = false
    }
  }

  const createTournament = async (name: string, size: 4 | 8 | 16 | 32) => {
    try {
      const res = await fetch(`${API_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, size })
      })
      if (!res.ok) throw new Error('Failed to create tournament')
      await fetchTournaments()
      return await res.json()
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  const renameTournament = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      if (!res.ok) throw new Error('Failed to rename tournament')
      await fetchTournaments()
    } catch (error) {
      console.error(error)
    }
  }

  const { confirm } = useConfirmation()

  const deleteTournament = async (id: string) => {
    if (!(await confirm('This bracket will be deleted. Matches already created from it are kept.'))) return false
    try {
      const res = await fetch(`${API_URL}/tournaments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete tournament')
      await fetchTournaments()
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  return { tournaments, isLoading, fetchTournaments, createTournament, renameTournament, deleteTournament }
}
