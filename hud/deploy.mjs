#!/usr/bin/env node
// Port of deploy.ps1 for macOS / Linux. Same output as the PowerShell version:
//   node deploy.mjs [--src <hud source>] [--dest <folder>] [--clean]
// --clean builds a copy without the "Agents" section (no manager query), like deploy.ps1 -Clean.
// The manager reads panel.json only at startup — restart it after deploying.
import fs from 'node:fs'
import path from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const CLEAN = process.argv.includes('--clean')
const SRC = path.resolve(arg('src', process.cwd()))
const DST = path.resolve(arg('dest', path.join(process.env.HOME, 'jthm-huds', 'newHud')))
const API = 'http://localhost:1349/api'

// robocopy /XD and /XF match bare names at any depth
const SKIP_DIRS = new Set(['_test', '_unused', '_ref', '_publish', '_build', 'installer', 'uploads', 'panel', 'helper', 'docs', 'manager-patch', '.git'])
const SKIP_FILES = new Set(['deploy.ps1', 'deploy.mjs', 'panel.json', '.gitignore', 'README.md', '.DS_Store'])

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'))
const walk = (root, rel = '') => {
  const out = []
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      out.push(...walk(root, path.join(rel, e.name)))
    } else if (!SKIP_FILES.has(e.name)) {
      out.push(path.join(rel, e.name))
    }
  }
  return out
}

// new version stamp -> the open overlay reloads itself within ~3 s (js/main.js)
const d = new Date()
const p2 = (n, w = 2) => String(n).padStart(w, '0')
const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}${p2(d.getMilliseconds(), 3)}`
fs.writeFileSync(path.join(SRC, 'version.txt'), stamp, 'ascii')

// --- mirror (robocopy /MIR equivalent) ---
const files = walk(SRC)
const wanted = new Set(files)
for (const rel of files) {
  const to = path.join(DST, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(path.join(SRC, rel), to)
}
// purge extraneous files, leaving excluded dirs (uploads = sponsor logos added in the manager) alone
if (fs.existsSync(DST)) {
  for (const rel of walk(DST)) {
    if (!wanted.has(rel)) fs.rmSync(path.join(DST, rel))
  }
  const prune = (rel = '') => {
    for (const e of fs.readdirSync(path.join(DST, rel), { withFileTypes: true })) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue
      const sub = path.join(rel, e.name)
      prune(sub)
      if (fs.readdirSync(path.join(DST, sub)).length === 0) fs.rmdirSync(path.join(DST, sub))
    }
  }
  prune()
}
fs.copyFileSync(path.join(SRC, 'panel/en.json'), path.join(DST, 'panel.json'))

// --- "Agents" section: two selects per manager player (agent as CT / as T) ---
const agents = readJson('icons/agents/agents.json')
const agentPairs = agents.map((a) => [a.en, a.ru])
if (!CLEAN) {
  try {
    const get = async (p) => {
      const r = await fetch(API + p, { signal: AbortSignal.timeout(3000) })
      if (!r.ok) throw new Error(`${p} -> ${r.status}`)
      return r.json()
    }
    const [players, teamList] = await Promise.all([get('/players'), get('/teams')])
    const teams = Object.fromEntries(teamList.map((t) => [t._id, t.name]))
    const vals = {}
    for (const side of ['CT', 'T']) {
      vals[side] = ['{ "name": "", "label": "Automatic" }']
        .concat(agents.filter((a) => a.side === side).map((a) => `{ "name": ${JSON.stringify(a.id)}, "label": ${JSON.stringify(a.en)} }`))
        .join(', ')
    }
    const inputs = players
      .filter((p) => p.steamid)
      .sort((a, b) => (teams[a.team] || '').localeCompare(teams[b.team] || '') || (a.username || '').localeCompare(b.username || ''))
      .flatMap((p) => {
        const who = p.username + (teams[p.team] ? ` (${teams[p.team]})` : '')
        return ['CT', 'T'].map(
          (side) =>
            `      { "type": "select", "name": ${JSON.stringify(`${p.steamid}_${side}`)}, "label": ${JSON.stringify(`${who} - ${side}`)}, "values": [${vals[side]}] }`
        )
      })
    if (inputs.length) {
      const panelPath = path.join(DST, 'panel.json')
      let text = fs.readFileSync(panelPath, 'utf8').trimEnd()
      const section = `  {\n    "label": "Agents",\n    "name": "agents_panel",\n    "inputs": [\n${inputs.join(',\n')}\n    ]\n  }`
      text = text.slice(0, text.lastIndexOf(']')).trimEnd() + ',\n' + section + '\n]\n'
      fs.writeFileSync(panelPath, text, 'utf8')
    }
  } catch (e) {
    console.warn(`Agents section skipped (manager not running?): ${e.message}`)
  }
}

// --- hotkeys.json for the "Hot keys" button patched into the manager's HUDs page ---
const hk = readJson('panel/hotkeys.json')
const binds = readJson('keybinds.json')
const items = binds.map((b) => ({ key: b.bind, text: hk.en[b.action] || b.action, action: b.action }))
fs.writeFileSync(path.join(DST, 'hotkeys.json'), JSON.stringify({ title: hk.en.section, hint: hk.en.popupHint, items }), 'utf8')

// --- manager-ru.json: hand-written strings + EN -> RU pairs from the panel, hotkeys and agents ---
const dict = readJson('panel/manager-ru.json')
const exact = new Map(Object.entries(dict.exact).map(([k, v]) => [k, String(v)]))
const pair = (en, ru) => {
  if (en && ru && en !== ru && !exact.has(String(en).trim())) exact.set(String(en).trim(), String(ru).trim())
}
const panelEn = readJson('panel/en.json')
const panelRu = readJson('panel/ru.json')
for (const sEn of panelEn) {
  const sRu = panelRu.find((s) => s.name === sEn.name)
  if (!sRu) continue
  pair(sEn.label, sRu.label)
  for (const iEn of sEn.inputs || []) {
    const iRu = (sRu.inputs || []).find((i) => i.name === iEn.name)
    if (!iRu) continue
    pair(iEn.label, iRu.label)
    for (const vEn of iEn.values || []) {
      const vRu = (iRu.values || []).find((v) => v.name === vEn.name)
      if (vRu) pair(vEn.label, vRu.label)
    }
  }
}
for (const [k, v] of Object.entries(hk.en)) pair(v, hk.ru[k])
for (const [en, ru] of agentPairs) pair(en, ru)
fs.writeFileSync(
  path.join(DST, 'manager-ru.json'),
  JSON.stringify({ exact: Object.fromEntries(exact), prefix: dict.prefix, suffix: dict.suffix }),
  'utf8'
)
console.log(`Deployed to ${DST} (manager-ru.json: ${exact.size} strings)`)
