import { Request, Response } from 'express'
import { TournamentService } from './tournament.service'

const tournamentService = new TournamentService()

export const getTournaments = async (_req: Request, res: Response) => {
  try {
    res.json(await tournamentService.getAllTournaments())
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export const getTournament = async (req: Request, res: Response) => {
  try {
    res.json(await tournamentService.resolve(req.params.id as string))
  } catch (error: any) {
    res.status(404).json({ error: error.message })
  }
}

export const createTournament = async (req: Request, res: Response) => {
  try {
    const tournament = await tournamentService.createTournament(req.body)
    res.status(201).json(tournament)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const renameTournament = async (req: Request, res: Response) => {
  try {
    res.json(await tournamentService.renameTournament(req.params.id as string, req.body?.name))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const deleteTournament = async (req: Request, res: Response) => {
  try {
    await tournamentService.deleteTournament(req.params.id as string)
    res.status(204).send()
  } catch (error: any) {
    res.status(404).json({ error: error.message })
  }
}

export const setSeed = async (req: Request, res: Response) => {
  try {
    const { slot, side, teamId } = req.body
    res.json(await tournamentService.setSeed(req.params.id as string, Number(slot), side, teamId ?? null))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const setWinner = async (req: Request, res: Response) => {
  try {
    const { bracket, round, slot, teamId } = req.body
    res.json(
      await tournamentService.setWinner(req.params.id as string, bracket, Number(round), Number(slot), teamId ?? null)
    )
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
