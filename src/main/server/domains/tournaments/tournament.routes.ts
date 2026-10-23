import { Router, Request, Response } from 'express'
import { Server } from 'socket.io'
import {
  getTournaments,
  getTournament,
  getTournamentForMatch,
  createTournament,
  renameTournament,
  deleteTournament,
  setSeed,
  setWinner
} from './tournament.controller'

export default function createTournamentRouter(io: Server) {
  const router = Router()

  router.get('/', getTournaments)
  // Before '/:id', which would otherwise match 'for-match' as a tournament id.
  router.get('/for-match/:matchId', getTournamentForMatch)
  router.get('/:id', getTournament)

  router.post('/', async (req: Request, res: Response) => {
    await createTournament(req, res)
    if (res.statusCode < 400) io.emit('tournament')
  })

  router.patch('/:id', async (req: Request, res: Response) => {
    await renameTournament(req, res)
    if (res.statusCode < 400) io.emit('tournament')
  })

  router.delete('/:id', async (req: Request, res: Response) => {
    await deleteTournament(req, res)
    if (res.statusCode < 400) io.emit('tournament')
  })

  // Round 0 only: pick the seed on one side of a match
  router.patch('/:id/seed', async (req: Request, res: Response) => {
    await setSeed(req, res)
    if (res.statusCode < 400) io.emit('tournament')
  })

  // Manual winner override — for a bo1 with no score entered yet, a walkover, etc.
  router.patch('/:id/winner', async (req: Request, res: Response) => {
    await setWinner(req, res)
    if (res.statusCode < 400) io.emit('tournament')
  })

  return router
}
