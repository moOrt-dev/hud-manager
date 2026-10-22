import { app } from 'electron'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { Request, Response } from 'express'

// Forwards HUD/control-page camera commands to the CS2 console (-netconport), so the auto camera
// can switch spectator view without the key helper. Closed to the local machine and camera-only
// commands by default; %APPDATA%\jts-hud\telnet-access.json (read fresh on every request) can widen
// it: { access: "local" | "lan" | "any", commands: "camera" | "all", token?: string (12+ chars,
// a request with header X-Telnet-Token matching it skips every other check) }.
interface TelnetAccessConfig {
  access?: 'local' | 'lan' | 'any'
  commands?: 'camera' | 'all'
  token?: string
}

const CAMERA_COMMAND = /^(spec_player "[^"\\;\r\n]{1,64}"|spec_player \d{1,2}|spec_mode \d|spec_lock_to_accountid \d{1,10}|spec_goto( -?\d+(\.\d+)?){5}|spec_lerpto( -?\d+(\.\d+)?){5,8}|echo [\w .-]{0,64})$/

const isLocalHost = (h: string) => h === '127.0.0.1' || h === '::1' || h === 'localhost'
const isLanHost = (h: string) =>
  isLocalHost(h) ||
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(h)

function readAccessConfig(): TelnetAccessConfig {
  const file = path.join(app.getPath('userData'), 'telnet-access.json')
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function isRequestAllowed(req: Request, cfg: TelnetAccessConfig): boolean {
  const token = typeof cfg.token === 'string' && cfg.token.length >= 12 && req.headers['x-telnet-token'] === cfg.token
  if (token) return true

  const sameOrigin = !req.headers.origin || req.headers.origin === `http://${req.headers.host}`
  if (!sameOrigin) return false

  const access = cfg.access && ['local', 'lan', 'any'].includes(cfg.access) ? cfg.access : 'local'
  if (access === 'any') return true

  const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '')
  const host = String(req.headers.host || '')
    .replace(/:\d+$/, '')
    .replace(/^\[|\]$/g, '')
  return access === 'lan' ? isLanHost(ip) && isLanHost(host) : isLocalHost(ip) && isLocalHost(host)
}

// POST /api/huds/:hudId/action { action: "telnet", data: { cmd, port } }
export function handleTelnetAction(req: Request, res: Response): void {
  const cfg = readAccessConfig()
  if (!isRequestAllowed(req, cfg)) {
    res.status(403).json({ error: `telnet blocked (access: ${cfg.access || 'local'}), telnet-access.json` })
    return
  }

  const lines = String(req.body?.data?.cmd ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const badLine = cfg.commands === 'all' ? undefined : lines.find((l) => !CAMERA_COMMAND.test(l))
  if (badLine) {
    res.status(403).json({ error: `telnet: command not allowed (commands: camera): ${badLine}` })
    return
  }

  const port = Number(req.body?.data?.port)
  const socket = net.createConnection({
    host: '127.0.0.1',
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 2020
  })
  let out = ''
  let done = false
  const finish = (err?: Error) => {
    if (done) return
    done = true
    socket.destroy()
    if (err) res.status(502).json({ error: err.message })
    else res.json({ ok: true, out })
  }
  socket.setTimeout(3000, () => finish(new Error('Telnet timeout')))
  socket.on('error', finish)
  socket.on('data', (d) => (out += d))
  socket.on('connect', () => {
    socket.write(lines.join('\r\n') + '\r\n')
    setTimeout(() => finish(), 300)
  })
}
