// Connection to JTs Hud Manager: REST API + socket.io on port 1349.
// When the HUD is served by the manager (http://localhost:1349/huds/<id>/) we use the same origin.
const params = new URLSearchParams(location.search)
const port = Number(params.get('port') || 1349)

export const BASE =
  location.protocol.startsWith('http') && location.port === String(port)
    ? location.origin
    : `http://localhost:${port}`

export const asset = (url) => (!url ? '' : /^https?:|^data:/.test(url) ? url : BASE + url)

async function get(path) {
  const res = await fetch(`${BASE}/api/${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export const api = {
  currentMatch: () => get('match/current'),
  team: (id) => get(`teams/${id}`),
  players: () => get('players')
}

// Registers the HUD with the server exactly like the built-in HUD does:
// started -> readyToRegister -> register -> hud_config
export function connect(hudName, handlers) {
  // socket.io.js comes from the manager; without it (manager not running) just skip live data
  if (typeof window.io !== 'function') {
    console.warn('[newHud] socket.io client not loaded — is JTs Hud Manager running?')
    return null
  }
  const socket = window.io(BASE)

  socket.on('connect', () => socket.emit('started'))
  socket.on('readyToRegister', () => socket.emit('register', hudName, false, 'cs2', 'DEFAULT'))

  for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn)
  return socket
}
