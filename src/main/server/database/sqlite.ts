import sqlite3 from 'sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// Store database in user app data folder so it persists across app updates
const userDataPath = app.getPath('userData')
const dbDir = path.join(userDataPath, 'database')

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'jts-hud-manager.sqlite')

// Initialize SQLite Database
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message)
  } else {
    console.log('Connected to the SQLite database at:', dbPath)
    initializeTables()
  }
})

// Helper function to run queries with Promises
export const dbRun = (query: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err)
      else resolve()
    })
  })
}

// Helper function to get multiple rows
export const dbAll = (query: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

// Helper function to get a single row
export const dbGet = (query: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

// --- Table Initialization ---
async function initializeTables() {
  try {
    // Enable foreign keys
    await dbRun('PRAGMA foreign_keys = ON;')

    // Teams table (needs to be created first for FKs)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS teams (
        _id TEXT PRIMARY KEY,
        name TEXT,
        country TEXT,
        shortName TEXT,
        logo TEXT,
        extra TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        deleted_at TEXT,
        version INTEGER DEFAULT 1
      )
    `)

    // Matches table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        current INTEGER DEFAULT 0,
        left_id TEXT,
        left_wins INTEGER DEFAULT 0,
        right_id TEXT,
        right_wins INTEGER DEFAULT 0,
        matchType TEXT CHECK (matchType IN ('bo1', 'bo2', 'bo3', 'bo5')),
        vetos TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        deleted_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (left_id) REFERENCES teams(_id) ON DELETE SET NULL,
        FOREIGN KEY (right_id) REFERENCES teams(_id) ON DELETE SET NULL
      )
    `)

    // Ensure only one match can be marked as current at a time
    await dbRun(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_match 
      ON matches (current) 
      WHERE current = 1
    `)

    // Players table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS players (
        _id TEXT PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        username TEXT,
        avatar TEXT,
        country TEXT,
        steamid TEXT,
        team TEXT,
        isCoach INTEGER DEFAULT 0,
        extra TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        deleted_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (team) REFERENCES teams(_id) ON DELETE SET NULL
      )
    `)

    // Ensure steamid uniqueness but allow nulls
    await dbRun(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_players_steamid ON players(steamid) WHERE steamid IS NOT NULL AND steamid != ''`
    )

    // Triggers: keep updated_at current on every UPDATE
    const updateTriggers: { table: string; pk: string }[] = [
      { table: 'teams', pk: '_id' },
      { table: 'players', pk: '_id' },
      { table: 'matches', pk: 'id' }
    ]
    for (const { table, pk } of updateTriggers) {
      await dbRun(`
        CREATE TRIGGER IF NOT EXISTS trg_${table}_updated_at
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        WHEN NEW.version = OLD.version
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP, version = OLD.version + 1 WHERE ${pk} = NEW.${pk};
        END
      `)
    }

    // Tournaments: a bracket is its own entity, separate from a single Match, but every
    // non-empty node points at a real row in `matches` — no score/veto/matchType is duplicated here.
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT,
        size INTEGER CHECK (size IN (4, 8, 16, 32)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // One cell of the bracket. bracket is 'upper' | 'lower' | 'final'; round/slot are indices
    // local to that part of the tree (so e.g. upper round 0 and lower round 0 coexist). Upper
    // round 0 stores its two seeds (team_a_id/team_b_id) by hand; every other node's teams are
    // derived from winners/losers elsewhere in the tree, never stored here.
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tournament_nodes (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        bracket TEXT NOT NULL DEFAULT 'upper',
        round INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        team_a_id TEXT,
        team_b_id TEXT,
        match_id TEXT,
        winner_override TEXT,
        UNIQUE(tournament_id, bracket, round, slot),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
      )
    `)

    // Migrate a tournament_nodes table created before the bracket column existed: every row it
    // already has is an upper-bracket node (the format was single-elimination only back then).
    const nodeColumns = await dbAll(`PRAGMA table_info(tournament_nodes)`)
    if (!nodeColumns.some((c: any) => c.name === 'bracket')) {
      await dbRun(`ALTER TABLE tournament_nodes RENAME TO tournament_nodes_old`)
      await dbRun(`
        CREATE TABLE tournament_nodes (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL,
          bracket TEXT NOT NULL DEFAULT 'upper',
          round INTEGER NOT NULL,
          slot INTEGER NOT NULL,
          team_a_id TEXT,
          team_b_id TEXT,
          match_id TEXT,
          winner_override TEXT,
          UNIQUE(tournament_id, bracket, round, slot),
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
        )
      `)
      await dbRun(`
        INSERT INTO tournament_nodes (id, tournament_id, bracket, round, slot, team_a_id, team_b_id, match_id, winner_override)
        SELECT id, tournament_id, 'upper', round, slot, team_a_id, team_b_id, match_id, winner_override FROM tournament_nodes_old
      `)
      await dbRun(`DROP TABLE tournament_nodes_old`)
    }

    // The grand final used to be a pair of nodes: round 0 plus a round 1 "bracket reset" that was
    // only played when the lower-bracket side won round 0. The grand final is now the last stage,
    // so round 1 is dead weight — resolve() never reads it and the UNIQUE key would keep it
    // around forever. The match rows it pointed at are left alone: they are ordinary matches and
    // still listed under Matches.
    await dbRun(`DELETE FROM tournament_nodes WHERE bracket = 'final' AND round = 1`)

    // Settings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Default settings
    await dbRun(`INSERT OR IGNORE INTO settings (key, value) VALUES ('autoSwitchSides', 'true')`)

    // Hud configs table: stores panel config per hud id
    await dbRun(`
      CREATE TABLE IF NOT EXISTS hud_configs (
        hud_id TEXT PRIMARY KEY,
        config_data TEXT NOT NULL DEFAULT '{}'
      )
    `)

    console.log('SQLite tables initialized successfully.')
  } catch (error) {
    console.error('Failed to initialize SQLite tables:', error)
  }
}
