// Control page for New HUD with an EN / RU switch.
// Reads/writes the HUD config through the manager API; every save is pushed to the open
// overlay instantly. Live buttons send commands as config.remote = { id, action, data }.
import { BASE } from './api.js'
import { THEMES, THEME_INFO } from './themes.js'
import { OBSERVER_DEFAULTS } from './observer.js'

const HUD_ID = 'newHud'
const API = `${BASE}/api/huds/${HUD_ID}`

// ---------- texts ----------
const TEXT = {
  en: {
    title: 'New HUD — control panel',
    tabLive: 'Live control', tabSettings: 'Settings', tabThemes: 'Themes', tabSponsors: 'Sponsors', tabAgents: 'Agents',
    agentsHint: 'Official CS2 agent shown instead of an empty photo (players with a photo in the manager keep the photo). Pick one for CT and one for T: after the side switch the right one is used. "Automatic" = picked by the HUD.',
    agentAuto: 'Automatic', agentSearch: 'Search player or team', agentResetAll: 'Reset all to automatic', agentResetConfirm: 'Reset all chosen agents to automatic?',
    agentPlayer: 'Player', agentInGame: 'in game', agentNoPlayers: 'No players: add them in the manager or start the game.',
    connected: 'Manager connected · theme: {theme}', offline: 'Manager is not responding — start JTs Hud Manager',
    sent: 'Sent to the overlay', saved: 'Saved', saveError: 'Could not save: {e}',

    liveSb: 'Scoreboard', liveSbHint: 'Replaces the in-game TAB for viewers. Hotkeys: Alt+1 / Alt+2 / Alt+3, Alt+0 hides.',
    sbStats: 'Stats', sbStatsSub: 'K / A / D, ADR, HS%, MVP', sbEconomy: 'Economy', sbEconomySub: 'money, weapons, grenades',
    sbLeaders: 'Leaders', sbLeadersSub: 'best players, team comparison', sbHide: 'Hide scoreboard',
    liveVeto: 'Map veto', liveVetoHint: 'Picks and bans of the current match (created in the manager). Hotkey: Alt+K.',
    show: 'Show', hide: 'Hide',
    liveHud: 'Overlay parts', liveHudHint: 'Temporarily hide parts of the overlay. Each button toggles: press again to bring it back.',
    toggleHud: 'Whole HUD', toggleHudSub: 'Alt+O', togglePlayers: 'Player lists', togglePlayersSub: 'Alt+P',
    toggleRadar: 'Radar', toggleRadarSub: 'Alt+M', radarBigger: 'Radar bigger', radarBiggerSub: 'Shift+Z (Я)',
    radarSmaller: 'Radar smaller', radarSmallerSub: 'Shift+X (Ч)', toggleLayout: 'Player tiles: sides / bottom', toggleLayoutSub: 'Alt+V',
    hotkeys: 'Hotkeys', hotkeysSub: 'full list',
    hotkeysHint: 'Work while JTs Hud Manager is running, in any window (also in the game). The manager reads them at startup: restart it after changes.',
    hk_toggleHud: 'Hide / show the whole HUD', hk_togglePlayers: 'Hide / show the player tiles',
    hk_toggleLayout: 'Player tiles: vertical cards at the bottom / rows at the sides', hk_toggleNames: 'Top bar: keep team names open / fold',
    hk_reload: 'Reload the overlay', hk_toggleDefuse: 'Defuse window: show / hide', toggleDefuse: 'Defuse window', toggleDefuseSub: 'Alt+D', hk_toggleRadar: 'Hide / show the radar', hk_radarBigger: 'Radar bigger (up to 400 px)',
    hk_radarSmaller: 'Radar smaller (down to 250 px)', hk_toggleVeto: 'Map veto screen: show / hide',
    hk_sbStats: 'Scoreboard: stats', hk_sbEconomy: 'Scoreboard: economy', hk_sbLeaders: 'Scoreboard: leaders', hk_sbHide: 'Hide the scoreboard', hk_obsHand: 'Auto camera: manual control / back to auto', hk_bombCam: 'Camera on the bomb from above / back to the players',
    obsBomb: 'Bomb camera (Alt+B again — back to the players)', obsNoBomb: 'Alt+B: no bomb position in the game data',
    toggleNames: 'Top bar: team names', toggleNamesSub: 'Alt+N', reload: 'Reload the overlay', reloadSub: 'Alt+F5', names_secs: 'Top bar: team names at round start, sec',

    secGeneral: 'General', secColors: 'Colors and font', secElements: 'Elements', secScoreboard: 'Scoreboard',
    tournament_name: 'Tournament name', tournament_stage: 'Tournament stage',
    tournament_logo: 'Tournament icon', upload1: 'Upload',
    theme: 'Theme', font: 'Font', fontTheme: 'As in the theme',
    ct_color: 'CT color', t_color: 'T color',
    accent_color: 'Accent color', colorEmpty: 'empty = theme color',
    sharp_corners: 'Sharp corners', hide_observed: 'Hide the observed player card',
    hide_economy: 'Hide the economy panel in freezetime', economy_delay: 'Economy panel delay, sec',
    hide_game_killfeed: 'Hide the game killfeed',
    draw_crosshair: 'Draw a HUD crosshair',
    hide_defuse_popup: 'Hide the defuse window',
    fire_on: 'Team "on fire" after 5 rounds in a row',
    hide_radar: 'Hide radar', radar_avatars: 'Player photos on the radar', hide_series: 'Hide the map series line', no_clutch_zoom: 'Do not zoom the radar in a clutch',
    sb_autohide: 'Hide the scoreboard after N seconds',
    sb_keep_on_live: 'Keep the scoreboard open when the round starts',
    save: 'Save', reset: 'Undo changes', clear: 'Clear',

    themesHint: 'Previews use sample data. "Apply" switches the overlay immediately.',
    scene: 'Scene:', layout: 'Player tiles:', layoutSidesShort: 'Sides', layoutBottomShort: 'Bottom', sceneGame: 'Game', sceneFreeze: 'Buy time', sceneOver: 'Round win + MVP', sceneSb: 'Scoreboard',
    sceneEco: 'Economy', sceneLeaders: 'Leaders', sceneVeto: 'Veto',
    resetOverrides: 'reset my own colors and font', apply: 'Apply', current: '✓ Current', applied: 'Theme "{theme}" applied',

    sponsorsHint: 'The block sits under the radar and is as wide as the radar. Several logos take turns. PNG with a transparent background looks best.',
    upload: 'Add logos', uploading: 'Uploading…', noLogos: 'No logos yet', interval: 'Seconds per logo',
    spAlways: 'Show sponsors all the time',
    spPos: 'Where to show sponsors', spPosRadar: 'Under the radar', spPosTopRight: 'Top right corner',
    pause: 'Seconds shown at round start',
    removed: 'Logo removed',

    obsTitle: 'Auto camera',
    obsHint: 'The HUD switches the CS2 camera to the player where the action is: a fight, a clutch, a plant, a defuse. CS2 must be started with -netconport 2020. After a manual switch the auto camera waits a few seconds; Alt+A hands the camera to you until pressed again.',
    obsHand: 'Manual control (Alt+A) — the auto camera does not touch the camera',    obsOn: 'Auto camera ON', obsOnSub: 'click to turn off', obsOff: 'Auto camera OFF', obsOffSub: 'click to turn on',
    obsTest: 'Test CS2 connection', obsTestSub: 'telnet',
    obsTestOk: 'CS2 answers', obsTestFail: 'CS2 does not answer: {e}. Is the game started with -netconport {port}?',
    obsNoPatch: 'The manager cannot pass commands to CS2 yet: the manager telnet patch is needed',
    obsWatching: 'Camera: {name} — {reason}', obsWaiting: 'On, waiting for action', obsStopped: 'Off',
    obsManual: 'Manual switch to {name} — the auto camera waits', obsError: 'Error: {e}',
    obsSettings: 'Auto camera settings', obs_hold: 'Minimum seconds on one player', obs_manual_pause: 'Pause after a manual switch, sec',
    obs_port: 'CS2 telnet port', obs_method: 'Switch by', obsMethodName: 'By nickname', obsMethodId: 'By Steam ID',
    obsMethodKeys: 'Keys 1–0',
    obsMethodAuto: 'Automatic',
    obsNoHelper: 'The key helper is not running: start helper\\newhud-key-helper.cmd', obsNoKeys: 'Alt+B needs the CS2 console: not available with the key helper',
    obsHelperOn: 'Key helper: connected', obsHelperFocus: 'Key helper: CS2 is not the active window — keys are not pressed', obsHelperOff: 'Key helper: not running (helper\\install-autostart.cmd starts it with Windows)',
    obsHelperDisabled: 'Key helper: off in the settings', obsHelperOffState: 'The key helper is off in the settings: without the CS2 console the camera is not switched',
    obs_helper: 'Key helper',
    obs_first_person: 'First-person view',
    obsModeAuto: 'Auto', obsModeSuggest: 'Suggest only', obsSuggest: 'Suggests: {name} — {reason}', obsLog: 'Recent decisions (newest first)',
    obsModeHint: 'Suggest only: the camera is not touched, the panel just shows who the auto camera would pick — handy for checking it on a demo.',
    why_shooting: 'shooting', why_hurt: 'under fire', why_kills: 'getting kills', why_enemy: 'close to an enemy', why_clutch: 'clutch',
    why_planting: 'planting', why_defusing: 'defusing', why_retake: 'retake', why_bomb: 'has the bomb', why_dead: 'the player died', why_best: 'best pick', why_manual: 'manual switch', why_contact: 'about to fight', why_crowd: 'enemies coming at him', why_duel: 'duel: aiming at each other', why_aim: 'on a crosshair', why_multikill: 'kill streak'
  },
  ru: {
    title: 'New HUD — панель управления',
    tabLive: 'Управление в эфире', tabSettings: 'Настройки', tabThemes: 'Темы', tabSponsors: 'Спонсоры', tabAgents: 'Агенты',
    agentsHint: 'Официальный агент CS2 вместо пустого фото (у кого есть фото в менеджере — остаётся фото). Выберите агента за CT и за T: после смены сторон подставится нужный. «Автоматически» — HUD выберет сам.',
    agentAuto: 'Автоматически', agentSearch: 'Поиск игрока или команды', agentResetAll: 'Сбросить всех на автоматический выбор', agentResetConfirm: 'Сбросить всех выбранных агентов на автоматический выбор?',
    agentPlayer: 'Игрок', agentInGame: 'в игре', agentNoPlayers: 'Игроков нет: добавьте их в менеджере или запустите игру.',
    connected: 'Менеджер подключён · тема: {theme}', offline: 'Менеджер не отвечает — запустите JTs Hud Manager',
    sent: 'Отправлено в оверлей', saved: 'Сохранено', saveError: 'Не удалось сохранить: {e}',

    liveSb: 'Табло', liveSbHint: 'Заменяет зрителям стандартный TAB. Клавиши: Alt+1 / Alt+2 / Alt+3, скрыть — Alt+0.',
    sbStats: 'Статистика', sbStatsSub: 'убийства, помощь, смерти, урон, MVP', sbEconomy: 'Экономика', sbEconomySub: 'деньги, оружие, гранаты',
    sbLeaders: 'Лидеры', sbLeadersSub: 'лучшие игроки, сравнение команд', sbHide: 'Скрыть табло',
    liveVeto: 'Выбор карт', liveVetoHint: 'Пики и баны текущего матча (матч создаётся в менеджере). Клавиша: Alt+K.',
    show: 'Показать', hide: 'Скрыть',
    liveHud: 'Части оверлея', liveHudHint: 'Временно скрыть части оверлея. Кнопка работает как переключатель: нажмите ещё раз, чтобы вернуть.',
    toggleHud: 'Весь HUD', toggleHudSub: 'Alt+O', togglePlayers: 'Списки игроков', togglePlayersSub: 'Alt+P',
    toggleRadar: 'Радар', toggleRadarSub: 'Alt+M', radarBigger: 'Радар больше', radarBiggerSub: 'Shift+Z (Я)',
    radarSmaller: 'Радар меньше', radarSmallerSub: 'Shift+X (Ч)', toggleLayout: 'Плитки игроков: по бокам / внизу', toggleLayoutSub: 'Alt+V',
    hotkeys: 'Горячие клавиши', hotkeysSub: 'весь список',
    hotkeysHint: 'Работают, пока запущен JTs Hud Manager, в любом окне (и в игре). Менеджер читает их при запуске: после изменений его нужно перезапустить.',
    hk_toggleHud: 'Скрыть / показать весь HUD', hk_togglePlayers: 'Скрыть / показать плитки игроков',
    hk_toggleLayout: 'Плитки игроков: вертикальные карточки внизу / строки по бокам', hk_toggleNames: 'Шапка: держать названия команд открытыми / свернуть',
    hk_reload: 'Перезагрузить оверлей', hk_toggleDefuse: 'Окно дефуза: показать / скрыть', toggleDefuse: 'Окно дефуза', toggleDefuseSub: 'Alt+D (В)', hk_toggleRadar: 'Скрыть / показать радар', hk_radarBigger: 'Радар больше (до 400 px)',
    hk_radarSmaller: 'Радар меньше (до 250 px)', hk_toggleVeto: 'Экран вето карт: показать / скрыть',
    hk_sbStats: 'Табло: статистика', hk_sbEconomy: 'Табло: экономика', hk_sbLeaders: 'Табло: лидеры', hk_sbHide: 'Скрыть табло', hk_obsHand: 'Авто-камера: ручное управление / вернуть авто', hk_bombCam: 'Камера на бомбу сверху / вернуть к игрокам',
    obsBomb: 'Камера на бомбе (Alt+B ещё раз — вернуть к игрокам)', obsNoBomb: 'Alt+B: позиции бомбы нет в данных игры',
    toggleNames: 'Шапка: названия команд', toggleNamesSub: 'Alt+N', reload: 'Перезагрузить оверлей', reloadSub: 'Alt+F5', names_secs: 'Шапка: названия команд в начале раунда, сек',

    secGeneral: 'Общее', secColors: 'Цвета и шрифт', secElements: 'Элементы', secScoreboard: 'Табло',
    tournament_name: 'Название турнира', tournament_stage: 'Стадия турнира',
    tournament_logo: 'Иконка турнира', upload1: 'Загрузить',
    theme: 'Тема оформления', font: 'Шрифт', fontTheme: 'Как в теме',
    ct_color: 'Цвет CT', t_color: 'Цвет T',
    accent_color: 'Акцентный цвет', colorEmpty: 'пусто — цвет темы',
    sharp_corners: 'Острые углы', hide_observed: 'Скрыть карточку наблюдаемого игрока',
    hide_economy: 'Скрыть панель экономики в закупке', economy_delay: 'Задержка панели экономики, сек',
    hide_game_killfeed: 'Скрыть ленту убийств игры',
    draw_crosshair: 'Рисовать прицел HUD',
    hide_defuse_popup: 'Скрыть окно дефуза',
    fire_on: 'Команда «в огне» после 5 раундов подряд',
    hide_radar: 'Скрыть радар', radar_avatars: 'Фото игроков на радаре', hide_series: 'Скрыть строку серии карт', no_clutch_zoom: 'Не приближать радар в клатче',
    sb_autohide: 'Скрывать табло через N секунд',
    sb_keep_on_live: 'Не закрывать табло в начале раунда',
    save: 'Сохранить', reset: 'Отменить изменения', clear: 'Очистить',

    themesHint: 'В превью — тестовые данные. «Применить» сразу меняет тему в оверлее.',
    scene: 'Сцена:', layout: 'Плитки игроков:', layoutSidesShort: 'По бокам', layoutBottomShort: 'Внизу', sceneGame: 'Игра', sceneFreeze: 'Закупка', sceneOver: 'Победа + MVP', sceneSb: 'Табло',
    sceneEco: 'Экономика', sceneLeaders: 'Лидеры', sceneVeto: 'Вето',
    resetOverrides: 'сбросить свои цвета и шрифт', apply: 'Применить', current: '✓ Текущая', applied: 'Тема «{theme}» применена',

    sponsorsHint: 'Блок стоит под радаром и по ширине равен радару. Несколько логотипов сменяют друг друга. Лучше всего смотрятся PNG с прозрачным фоном.',
    upload: 'Добавить логотипы', uploading: 'Загрузка…', noLogos: 'Логотипов пока нет', interval: 'Секунд на один логотип',
    spAlways: 'Показывать спонсоров постоянно',
    spPos: 'Где показывать спонсоров', spPosRadar: 'Под радаром', spPosTopRight: 'В правом верхнем углу',
    pause: 'Секунд показа в начале раунда',
    removed: 'Логотип удалён',

    obsTitle: 'Авто-камера',
    obsHint: 'HUD сам переключает камеру CS2 на игрока, у которого главное событие: перестрелка, клатч, плэнт, дефуз. CS2 нужно запускать с параметром -netconport 2020. После ручного переключения авто-камера ждёт несколько секунд; Alt+A отдаёт камеру вам до повторного нажатия.',
    obsHand: 'Ручное управление (Alt+A) — авто-камера не трогает камеру',    obsOn: 'Авто-камера ВКЛ', obsOnSub: 'нажмите, чтобы выключить', obsOff: 'Авто-камера ВЫКЛ', obsOffSub: 'нажмите, чтобы включить',
    obsTest: 'Проверить связь с CS2', obsTestSub: 'telnet',
    obsTestOk: 'CS2 отвечает', obsTestFail: 'CS2 не отвечает: {e}. Игра запущена с -netconport {port}?',
    obsNoPatch: 'Менеджер пока не умеет передавать команды в CS2: нужен патч менеджера (telnet)',
    obsWatching: 'Камера: {name} — {reason}', obsWaiting: 'Включена, ждёт событий', obsStopped: 'Выключена',
    obsManual: 'Ручное переключение на {name} — авто-камера ждёт', obsError: 'Ошибка: {e}',
    obsSettings: 'Настройки авто-камеры', obs_hold: 'Минимум секунд на одном игроке', obs_manual_pause: 'Пауза после ручного переключения, сек',
    obs_port: 'Порт telnet CS2', obs_method: 'Как переключать', obsMethodName: 'По нику', obsMethodId: 'По Steam ID',
    obsMethodKeys: 'Клавишами 1–0',
    obsMethodAuto: 'Автоматически',
    obsNoHelper: 'Помощник не запущен: запустите helper\\newhud-key-helper.cmd', obsNoKeys: 'Alt+B работает только через консоль CS2, с помощником недоступен',
    obsHelperOn: 'Помощник: подключён', obsHelperFocus: 'Помощник: окно CS2 не активно — клавиши не нажимаются', obsHelperOff: 'Помощник: не запущен (helper\\install-autostart.cmd — запуск вместе с Windows)',
    obsHelperDisabled: 'Помощник: выключен в настройках', obsHelperOffState: 'Помощник выключен в настройках: без консоли CS2 камера не переключается',
    obs_helper: 'Помощник клавиш',
    obs_first_person: 'Вид от первого лица',
    obsModeAuto: 'Авто', obsModeSuggest: 'Только подсказка', obsSuggest: 'Подсказка: {name} — {reason}', obsLog: 'Последние решения (новые сверху)',
    obsModeHint: 'Только подсказка: камера не трогается, пульт лишь показывает, кого выбрала бы авто-камера — удобно проверять на демке.',
    why_shooting: 'стреляет', why_hurt: 'под огнём', why_kills: 'делает фраги', why_enemy: 'рядом с противником', why_clutch: 'клатч',
    why_planting: 'ставит бомбу', why_defusing: 'дефузит', why_retake: 'ретейк', why_bomb: 'с бомбой', why_dead: 'игрок погиб', why_best: 'лучший кандидат', why_manual: 'ручное переключение', why_contact: 'вот-вот перестрелка', why_crowd: 'на него идут противники', why_duel: 'дуэль: целятся друг в друга', why_aim: 'на прицеле', why_multikill: 'серия фрагов'
  }
}

// Theme names/descriptions in Russian (English ones live in themes.js)
const THEME_RU = {
  default: ['Стандартная', 'Нейтральная тёмная, мягкие углы, шрифт Rajdhani'],
  blast: ['В стиле BLAST', 'Тёмно-синие панели, синий / красный, счёт с цветными разделителями, карточки с фото в ряд внизу, Montserrat'],
  esl: ['В стиле ESL', 'Чёрный / жёлтый, жёлтые полосы заголовков, Oswald'],
  iem: ['В стиле IEM', 'Тёмно-синий / голубой, тонкие светящиеся линии, Oswald'],
  pgl: ['В стиле PGL', 'Цельная шапка с цветными краями команд, голубой / оранжевый, компактные плитки с полосой HP, Barlow Condensed'],
  faceit: ['В стиле FACEIT', 'Графит / оранжевые акценты, оранжевый таймер'],
  neon: ['NEON', 'Ночной фиолетовый, голубой и розовый, свечение, Teko'],
  fpg: ['В стиле FPG', 'Фото игроков, полосы HP в заголовке плиток, всплывающий урон, анимация ROUND WINNER'],
  light: ['Светлая', 'Светлые панели, тёмный текст, Montserrat'],
  starladder: ['В стиле StarLadder', 'Цветные блоки команд со звёздами серии, карточки с фото и HP на фото, вкладки карт над радаром, Oswald'],
  ewc: ['В стиле EWC', 'Белая скошенная плашка счёта, только логотипы, золотые / синие плитки с фото от края экрана, счётчик живых, Barlow Condensed']
}

let lang = (() => {
  const fromUrl = new URLSearchParams(location.search).get('lang') // ?lang=en for links / tests
  if (fromUrl === 'en' || fromUrl === 'ru') return fromUrl
  try {
    return localStorage.getItem('newhud-lang') || 'ru'
  } catch {
    return 'ru'
  }
})()
const tr = (key, vars = {}) => (TEXT[lang][key] ?? TEXT.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
const themeLabel = (name) => (lang === 'ru' ? THEME_RU[name]?.[0] : THEME_INFO[name]?.label) || name
const themeText = (name) => (lang === 'ru' ? THEME_RU[name]?.[1] : THEME_INFO[name]?.text) || ''
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---------- API ----------
let config = {}
let online = false

async function loadConfig() {
  const res = await fetch(`${API}/config`)
  if (!res.ok) throw new Error(res.status)
  config = await res.json()
  online = true
  return config
}

async function saveConfig(next) {
  const res = await fetch(`${API}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next)
  })
  if (!res.ok) throw new Error(res.status)
  config = next
}

// Merge a change into the latest saved config (someone may have saved from the manager meanwhile)
async function update(mutator) {
  const fresh = await loadConfig().catch(() => config)
  const next = structuredClone(fresh)
  mutator(next)
  await saveConfig(next)
  return next
}

async function sendRemote(action, data) {
  try {
    await update((c) => (c.remote = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, data }))
    toast(tr('sent'))
  } catch (e) {
    toast(tr('saveError', { e: e.message }), true)
  }
}

// ---------- UI helpers ----------
const $ = (s, root = document) => root.querySelector(s)
function toast(text, err = false) {
  const t = $('#toast')
  t.textContent = text
  t.classList.toggle('err', err)
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2500)
}
function setStatus() {
  const s = $('#status')
  s.className = `status ${online ? 'ok' : 'err'}`
  s.innerHTML = online ? tr('connected', { theme: `<b>${esc(themeLabel(config.display_settings?.theme || 'default'))}</b>` }) : tr('offline')
}
const btn = (label, sub, attrs = '', cls = '') =>
  `<button class="btn ${cls}" ${attrs}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`

// ---------- tab: live ----------
function renderLive() {
  const obs = obsConfig()
  $('#tab-live').innerHTML = `
    <div class="group">
      <h2>${tr('obsTitle')}</h2><p class="hint">${tr('obsHint')}</p>
      <div class="buttons">
        ${btn(obs.auto ? tr('obsOn') : tr('obsOff'), obs.auto ? tr('obsOnSub') : tr('obsOffSub'), 'id="obs-toggle"', obs.auto ? 'on' : '')}
        ${btn(tr('obsTest'), tr('obsTestSub'), 'id="obs-test"')}
        <div class="seg" id="obs-mode" style="align-self:center">${[['auto', 'obsModeAuto'], ['suggest', 'obsModeSuggest']]
          .map(([v, k]) => `<button data-mode="${v}" class="${obs.mode === v ? 'on' : ''}">${tr(k)}</button>`)
          .join('')}</div>
      </div>
      <p class="hint" style="margin:10px 0 0">${tr('obsModeHint')}</p>
      <p class="hint" id="obs-status" style="margin:12px 0 0"></p>
      <div id="obs-log"></div>
      <details style="margin-top:12px">
        <summary style="cursor:pointer;color:var(--muted)">${tr('obsSettings')}</summary>
        <div class="form" style="margin-top:12px">
          <label for="obs-hold">${tr('obs_hold')}</label>
          <div><input type="text" id="obs-hold" value="${esc(obs.hold)}" style="max-width:120px" /></div>
          <label for="obs-pause">${tr('obs_manual_pause')}</label>
          <div><input type="text" id="obs-pause" value="${esc(obs.manual_pause)}" style="max-width:120px" /></div>
          <label for="obs-port">${tr('obs_port')}</label>
          <div><input type="text" id="obs-port" value="${esc(obs.port)}" style="max-width:120px" /></div>
          <label for="obs-method">${tr('obs_method')}</label>
          <div><select id="obs-method">${[['auto', 'obsMethodAuto'], ['name', 'obsMethodName'], ['keys', 'obsMethodKeys'], ['accountid', 'obsMethodId']]
            .map(([v, k]) => `<option value="${v}" ${v === obs.method ? 'selected' : ''}>${esc(tr(k))}</option>`)
            .join('')}</select></div>
          <label for="obs-helper">${tr('obs_helper')}</label>
          <div><input type="checkbox" id="obs-helper" ${obs.helper !== false ? 'checked' : ''} /></div>
          <label for="obs-fp">${tr('obs_first_person')}</label>
          <div><input type="checkbox" id="obs-fp" ${obs.first_person ? 'checked' : ''} /></div>
        </div>
        <div class="save-bar"><button class="btn primary" id="obs-save">${tr('save')}</button></div>
      </details>
    </div>
    <div class="group">
      <h2>${tr('liveSb')}</h2><p class="hint">${tr('liveSbHint')}</p>
      <div class="buttons">
        ${btn(tr('sbStats'), tr('sbStatsSub'), 'data-remote="scoreboard" data-value="stats"', 'primary')}
        ${btn(tr('sbEconomy'), tr('sbEconomySub'), 'data-remote="scoreboard" data-value="economy"', 'primary')}
        ${btn(tr('sbLeaders'), tr('sbLeadersSub'), 'data-remote="scoreboard" data-value="leaders"', 'primary')}
        ${btn(tr('sbHide'), 'Alt+0', 'data-remote="scoreboard" data-value="hide"', 'danger')}
      </div>
    </div>
    <div class="group">
      <h2>${tr('liveVeto')}</h2><p class="hint">${tr('liveVetoHint')}</p>
      <div class="buttons">
        ${btn(tr('show'), '', 'data-remote="veto" data-value="show"', 'primary')}
        ${btn(tr('hide'), '', 'data-remote="veto" data-value="hide"', 'danger')}
      </div>
    </div>
    <div class="group">
      <h2>${tr('liveHud')}</h2><p class="hint">${tr('liveHudHint')}</p>
      <div class="buttons">
        ${['toggleHud', 'toggleNames', 'togglePlayers', 'toggleLayout', 'toggleDefuse', 'toggleRadar', 'radarBigger', 'radarSmaller', 'reload']
          .map((a) => btn(tr(a), keyOf(a) || tr(`${a}Sub`), `data-remote="${a}"`))
          .join('')}
        ${btn(tr('hotkeys'), tr('hotkeysSub'), 'id="hk-toggle"', showHotkeys ? 'primary' : '')}
      </div>
      <div id="hk-list" ${showHotkeys ? '' : 'hidden'} style="margin-top:14px">
        <p class="hint">${tr('hotkeysHint')}</p>
        <table style="border-collapse:collapse;font-size:15px">
          ${keybinds
            .map(
              (k) => `<tr style="border-bottom:1px solid var(--line)">
                <td style="padding:6px 18px 6px 0;white-space:nowrap"><b>${esc(keyLabel(k.bind))}</b></td>
                <td style="padding:6px 0;color:var(--muted)">${esc(tr(`hk_${k.action}`))}</td></tr>`
            )
            .join('')}
        </table>
      </div>
    </div>`
  paintObsStatus()
}

// ---------- auto camera: config.observer (read by js/observer.js in the overlay) ----------
// empty fields saved by the manager's panel ("") fall back to the defaults
const obsConfig = () => ({ ...OBSERVER_DEFAULTS, ...Object.fromEntries(Object.entries(config.observer || {}).filter(([, v]) => v !== '' && v != null)) })
let obsStatus = null // last { state, name, reason, error } sent by the overlay
const obsLog = [] // recent decisions, newest first
let helperSeen = { at: 0, skipped: '' } // last heartbeat of the key helper
setInterval(() => /keys|auto/.test(obsConfig().method) && paintObsStatus(), 5000) // "not running" after the heartbeats stop

function obsStatusText() {
  const obs = obsConfig()
  const st = obsStatus
  if (st?.state === 'bomb') return tr('obsBomb')
  if (st?.state === 'nobomb') return tr('obsNoBomb')
  if (st?.state === 'nokeys') return tr('obsNoKeys')
  if (st?.state === 'nohelper' && obs.auto) return tr('obsNoHelper')
  if (st?.state === 'helperoff' && obs.auto) return tr('obsHelperOffState')
  if (!obs.auto) return tr('obsStopped')
  if (!st || st.state === 'off') return tr('obsWaiting')
  if (st.state === 'on') return st.name ? tr('obsWatching', { name: esc(st.name), reason: tr(`why_${st.reason}`) }) : tr('obsWaiting')
  if (st.state === 'suggest') return tr('obsSuggest', { name: esc(st.name), reason: tr(`why_${st.reason}`) })
  if (st.state === 'manual') return tr('obsManual', { name: esc(st.name || '?') })
  if (st.state === 'hand') return tr('obsHand')
  if (st.state === 'nopatch') return tr('obsNoPatch')
  return tr('obsError', { e: esc(st.error || '?') })
}
function paintObsStatus() {
  const el = $('#obs-status')
  if (!el) return
  // key helper line (only when switching by keys): heartbeat every 5 s from helper/newhud-key-helper.ps1
  // auto: the helper line only once the keys are in use (CS2 console closed) or the helper is running
  const m = obsConfig().method
  const keys = m === 'keys' || (m === 'auto' && (obsStatus?.via === 'keys' || obsStatus?.state === 'nohelper' || Date.now() - helperSeen.at < 15000))
  const helper = !keys
    ? ''
    : obsConfig().helper === false || helperSeen.enabled === false
      ? tr('obsHelperDisabled')
      : Date.now() - helperSeen.at > 15000
        ? tr('obsHelperOff')
        : helperSeen.skipped
          ? tr('obsHelperFocus')
          : tr('obsHelperOn')
  el.innerHTML = obsStatusText() + (helper ? `<br>${helper}` : '')
  el.style.color = obsStatus && /error|nopatch|nohelper/.test(obsStatus.state) && obsConfig().auto ? 'var(--danger)' : ''
  // decision log: round, time left in the round (to find the moment in the demo), player, reason
  const log = $('#obs-log')
  if (!log) return
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  log.innerHTML = obsLog.length
    ? `<p class="hint" style="margin:12px 0 4px">${tr('obsLog')}</p>
       <table style="border-collapse:collapse;font-size:14px">${obsLog
         .map(
           (r) => `<tr><td style="padding:2px 14px 2px 0;color:var(--muted);white-space:nowrap">R${r.round ?? '?'} · ${clock(r.clock ?? 0)}</td>
             <td style="padding:2px 14px 2px 0"><b>${esc(r.name)}</b></td><td style="color:var(--muted)">${esc(tr(`why_${r.reason}`))}${r.state === 'manual' ? ' ✋' : ''}</td></tr>`
         )
         .join('')}</table>`
    : ''
}

// The overlay reports what the auto camera does as hud_action { action: 'obsStatus' } (socket.io of the manager)
if (typeof window.io === 'function') {
  window.io(BASE).on('hud_action', (a) => {
    if (a?.action === 'obsHelper') {
      helperSeen = { at: Date.now(), skipped: a.data?.skipped || '', enabled: a.data?.enabled !== false }
      return paintObsStatus()
    }
    if (a?.action !== 'obsStatus') return
    obsStatus = a.data
    // every overlay copy reports the same decision: keep one row per decision
    const d = a.data || {}
    if (d.name && /on|suggest|manual/.test(d.state) && !(obsLog[0]?.name === d.name && Math.abs((obsLog[0]?.at ?? 0) - d.at) < 1500)) {
      obsLog.unshift({ ...d, reason: d.state === 'manual' ? 'manual' : d.reason })
      obsLog.length = Math.min(obsLog.length, 15)
    }
    paintObsStatus()
  })
}

async function testCs2() {
  const port = Number(obsConfig().port) || 2020
  try {
    const res = await fetch(`${API}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'telnet', data: { cmd: 'echo newHud_ping', port } })
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && !('out' in body)) return toast(tr('obsNoPatch'), true)
    if (!res.ok) return toast(tr('obsTestFail', { e: body.error || res.status, port }), true)
    toast(tr('obsTestOk'))
  } catch (e) {
    toast(tr('obsTestFail', { e: e.message, port }), true)
  }
}

async function saveObs(mutator) {
  try {
    await update((c) => {
      c.observer = { ...OBSERVER_DEFAULTS, ...(c.observer || {}) }
      mutator(c.observer)
    })
    toast(tr('saved'))
  } catch (e) {
    toast(tr('saveError', { e: e.message }), true)
  }
  renderLive()
}

// ---------- hotkeys: read from keybinds.json, so the list always matches what is actually bound ----------
let keybinds = []
let showHotkeys = new URLSearchParams(location.search).has('hotkeys') // ?hotkeys=1 opens the list
const RU_KEYS = Object.fromEntries([...'QWERTYUIOPASDFGHJKLZXCVBNM'].map((c, i) => [c, 'ЙЦУКЕНГШЩЗФЫВАПРОЛДЯЧСМИТЬ'[i]]))
// "Shift+Z" -> "Shift+Z (Я)": the same physical key on the Russian layout
const keyLabel = (bind) => {
  const last = bind.split('+').pop()
  return RU_KEYS[last] ? `${bind} (${RU_KEYS[last]})` : bind
}
const keyOf = (action) => {
  const k = keybinds.find((b) => b.action === action)
  return k ? keyLabel(k.bind) : ''
}
fetch('./keybinds.json', { cache: 'no-store' })
  .then((r) => r.json())
  .then((list) => {
    keybinds = Array.isArray(list) ? list : []
    renderLive()
  })
  .catch(() => {})

$('#tab-live').addEventListener('click', (e) => {
  if (e.target.closest('#obs-toggle')) return saveObs((o) => (o.auto = !o.auto))
  if (e.target.closest('#obs-test')) return testCs2()
  const mode = e.target.closest('#obs-mode [data-mode]')
  if (mode) return saveObs((o) => (o.mode = mode.dataset.mode))
  if (e.target.closest('#obs-save'))
    return saveObs((o) => {
      o.hold = $('#obs-hold').value.trim()
      o.manual_pause = $('#obs-pause').value.trim()
      o.port = $('#obs-port').value.trim()
      o.method = $('#obs-method').value
      o.first_person = $('#obs-fp').checked
      o.helper = $('#obs-helper').checked
    })
  if (e.target.closest('#hk-toggle')) {
    showHotkeys = !showHotkeys
    renderLive()
    return
  }
  const b = e.target.closest('[data-remote]')
  if (b) sendRemote(b.dataset.remote, b.dataset.value)
})

// ---------- tab: settings ----------
// [section, key, type, extra]
const FIELDS = [
  ['sub', 'secGeneral'],
  ['display_settings', 'tournament_name', 'text'],
  ['display_settings', 'tournament_stage', 'text'],
  ['display_settings', 'tournament_logo', 'image'],
  ['sub', 'secColors'],
  ['display_settings', 'theme', 'theme'],
  ['display_settings', 'font', 'font'],
  ['display_settings', 'ct_color', 'color'],
  ['display_settings', 't_color', 'color'],
  ['display_settings', 'accent_color', 'color'],
  ['display_settings', 'sharp_corners', 'checkbox'],
  ['sub', 'secElements'],
  ['display_settings', 'names_secs', 'text'],
  ['display_settings', 'hide_observed', 'checkbox'],
  ['display_settings', 'hide_economy', 'checkbox'],
  ['display_settings', 'economy_delay', 'text'],
  ['display_settings', 'hide_game_killfeed', 'checkbox'],
  ['display_settings', 'draw_crosshair', 'checkbox'],
  ['display_settings', 'hide_defuse_popup', 'checkbox'],
  ['display_settings', 'fire_on', 'checkbox'],
  ['display_settings', 'hide_radar', 'checkbox'],
  ['display_settings', 'radar_avatars', 'checkbox'],
  ['display_settings', 'hide_series', 'checkbox'],
  ['display_settings', 'no_clutch_zoom', 'checkbox'],
  ['sub', 'secScoreboard'],
  ['scoreboard_controls', 'sb_autohide', 'text'],
  ['scoreboard_controls', 'sb_keep_on_live', 'checkbox']
]
const FONTS = [['', 'fontTheme'], ['rajdhani', 'Rajdhani'], ['oswald', 'Oswald'], ['barlow', 'Barlow Condensed'], ['montserrat', 'Montserrat'], ['teko', 'Teko']]
const hexOk = (v) => /^#?[0-9a-f]{6}$/i.test(v || '')

function fieldHtml([section, key, type]) {
  if (section === 'sub') return `<div class="sub">${tr(key)}</div>`
  const v = config[section]?.[key]
  const id = `f-${key}`
  let input
  if (type === 'checkbox') input = `<input type="checkbox" id="${id}" ${v ? 'checked' : ''} />`
  else if (type === 'theme')
    input = `<select id="${id}">${Object.keys(THEMES).map((n) => `<option value="${n}" ${n === (v || 'default') ? 'selected' : ''}>${esc(themeLabel(n))}</option>`).join('')}</select>`
  else if (type === 'font')
    input = `<select id="${id}">${FONTS.map(([n, l]) => `<option value="${n}" ${n === (v || '') ? 'selected' : ''}>${esc(n ? l : tr(l))}</option>`).join('')}</select>`
  else if (type === 'color') {
    const hex = hexOk(v) ? (v.startsWith('#') ? v : `#${v}`) : '#000000'
    input = `<div class="color">
      <input type="color" id="${id}-pick" value="${hex}" />
      <input type="text" id="${id}" value="${esc(v || '')}" placeholder="${esc(tr('colorEmpty'))}" style="max-width:160px" />
      <button class="btn" type="button" data-clear="${id}">${tr('clear')}</button>
    </div>`
  } else if (type === 'image')
    // uploaded right away; the URL lands in the hidden input and is stored on "Save"
    input = `<div class="color">
      <img id="${id}-img" src="${v ? esc(assetUrl(v)) : ''}" ${v ? '' : 'hidden'} style="width:40px;height:40px;object-fit:contain;background:#0006;border-radius:6px" />
      <input type="hidden" id="${id}" value="${esc(v || '')}" />
      <label class="btn">${tr('upload1')}<input type="file" accept="image/*" data-upload="${id}" hidden /></label>
      <button class="btn" type="button" data-clear="${id}">${tr('clear')}</button>
    </div>`
  else input = `<input type="text" id="${id}" value="${esc(v ?? '')}" />`
  return `<label for="${id}">${tr(key)}</label><div>${input}</div>`
}

function renderSettings() {
  $('#tab-settings').innerHTML = `
    <div class="group">
      <div class="form">${FIELDS.map(fieldHtml).join('')}</div>
      <div class="save-bar">
        <button class="btn primary" id="save">${tr('save')}</button>
        <button class="btn" id="reset">${tr('reset')}</button>
      </div>
    </div>`
  const root = $('#tab-settings')
  root.querySelectorAll('input[type=color]').forEach((pick) =>
    pick.addEventListener('input', () => ($(`#${pick.id.replace(/-pick$/, '')}`).value = pick.value))
  )
  root.querySelectorAll('[data-clear]').forEach((b) =>
    b.addEventListener('click', () => {
      $(`#${b.dataset.clear}`).value = ''
      const img = $(`#${b.dataset.clear}-img`)
      if (img) img.hidden = true
    })
  )
  root.querySelectorAll('[data-upload]').forEach((input) =>
    input.addEventListener('change', async () => {
      const file = input.files[0]
      if (!file) return
      try {
        const body = new FormData()
        body.append('image', file)
        const res = await fetch(`${API}/upload`, { method: 'POST', body })
        if (!res.ok) throw new Error(res.status)
        const { url } = await res.json()
        $(`#${input.dataset.upload}`).value = url
        const img = $(`#${input.dataset.upload}-img`)
        img.src = assetUrl(url)
        img.hidden = false
      } catch (e) {
        toast(tr('saveError', { e: e.message }), true)
      }
    })
  )
  $('#reset').addEventListener('click', renderSettings)
  $('#save').addEventListener('click', async () => {
    try {
      await update((c) => {
        for (const [section, key, type] of FIELDS) {
          if (section === 'sub') continue
          const el = $(`#f-${key}`)
          c[section] ||= {}
          c[section][key] = type === 'checkbox' ? el.checked : el.value.trim()
        }
      })
      toast(tr('saved'))
      setStatus()
    } catch (e) {
      toast(tr('saveError', { e: e.message }), true)
    }
  })
}

// ---------- tab: themes ----------
const SCENES = [['', 'sceneGame'], ['&freeze=1', 'sceneFreeze'], ['&over=1', 'sceneOver'], ['&sb=stats', 'sceneSb'], ['&sb=economy', 'sceneEco'], ['&sb=leaders', 'sceneLeaders'], ['&veto=1', 'sceneVeto']]
let scene = ''
let previewLayout = '' // '' | 'bottom': player tile layout in the previews
const previewUrl = (theme) => `./index.html?mock=1&preview=1&theme=${theme}${scene}${previewLayout ? `&layout=${previewLayout}` : ''}`
function fit(frame) {
  frame.style.transform = `scale(${frame.parentElement.clientWidth / 1920})`
}
new ResizeObserver(() => document.querySelectorAll('iframe').forEach(fit)).observe(document.body)

function renderThemes() {
  const current = config.display_settings?.theme || 'default'
  $('#tab-themes').innerHTML = `
    <div class="theme-bar">
      <span class="opt">${tr('scene')}</span>
      <div class="seg" id="scenes">${SCENES.map(([q, k]) => `<button data-q="${q}" class="${q === scene ? 'on' : ''}">${tr(k)}</button>`).join('')}</div>
      <span class="opt">${tr('layout')}</span>
      <div class="seg" id="layouts">${[['', 'layoutSidesShort'], ['bottom', 'layoutBottomShort']].map(([q, k]) => `<button data-q="${q}" class="${q === previewLayout ? 'on' : ''}">${tr(k)}</button>`).join('')}</div>
      <label class="opt"><input type="checkbox" id="reset-ov" checked /> ${tr('resetOverrides')}</label>
    </div>
    <p class="hint" style="color:var(--muted);margin:0 0 12px">${tr('themesHint')}</p>
    <div class="grid">
      ${Object.entries(THEMES)
        .map(
          ([name, t]) => `
        <div class="card ${name === current ? 'current' : ''}" data-theme="${name}">
          <div class="preview"><iframe loading="lazy" src="${previewUrl(name)}"></iframe></div>
          <div class="info">
            <div class="grow">
              <h3>${esc(themeLabel(name))}</h3>
              <p>${esc(themeText(name))}</p>
              <div class="swatches">${[t.ct, t.t, t.accent, t.bg, t.text].map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
            </div>
            <button class="btn primary apply">${name === current ? tr('current') : tr('apply')}</button>
          </div>
        </div>`
        )
        .join('')}
    </div>`
  const root = $('#tab-themes')
  root.querySelectorAll('iframe').forEach((f) => {
    f.addEventListener('load', () => fit(f))
    requestAnimationFrame(() => fit(f))
  })
  $('#scenes').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    scene = b.dataset.q
    renderThemes()
  })
  $('#layouts').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    previewLayout = b.dataset.q
    renderThemes()
  })
  root.querySelectorAll('.card').forEach((card) => {
    const name = card.dataset.theme
    card.querySelector('.preview').addEventListener('click', () => openZoom(name))
    card.querySelector('.apply').addEventListener('click', async () => {
      try {
        await update((c) => {
          c.display_settings ||= {}
          c.display_settings.theme = name
          if ($('#reset-ov').checked) for (const k of ['ct_color', 't_color', 'accent_color', 'font', 'sharp_corners']) delete c.display_settings[k]
        })
        toast(tr('applied', { theme: themeLabel(name) }))
        setStatus()
        renderThemes()
        renderSettings()
      } catch (e) {
        toast(tr('saveError', { e: e.message }), true)
      }
    })
  })
}

function openZoom(theme) {
  const frame = $('#zoom iframe')
  frame.src = previewUrl(theme)
  $('#zoom').classList.add('show')
  requestAnimationFrame(() => fit(frame))
}
$('#zoom').addEventListener('click', () => {
  $('#zoom').classList.remove('show')
  $('#zoom iframe').src = 'about:blank'
})

// ---------- tab: sponsors ----------
const assetUrl = (u) => (/^https?:/.test(u) ? u : BASE + u)

function renderSponsors() {
  const list = config.sponsors?.sponsors || []
  $('#tab-sponsors').innerHTML = `
    <div class="group">
      <h2>${tr('tabSponsors')}</h2><p class="hint">${tr('sponsorsHint')}</p>
      <div class="logos">
        ${list.length ? list.map((u, i) => `<div class="logo"><img src="${esc(assetUrl(u))}" /><button data-remove="${i}" title="×">×</button></div>`).join('') : `<span class="empty">${tr('noLogos')}</span>`}
      </div>
      <div class="buttons">
        <label class="btn primary" id="upload-label">${tr('upload')}<input type="file" id="upload" accept="image/*" multiple hidden /></label>
      </div>
      <div class="form" style="margin-top:16px">
        <label for="sp-pos">${tr('spPos')}</label>
        <div><select id="sp-pos">${[['', 'spPosRadar'], ['top-right', 'spPosTopRight']]
          .map(([v, k]) => `<option value="${v}" ${v === (config.sponsors?.sponsor_position || '') ? 'selected' : ''}>${esc(tr(k))}</option>`)
          .join('')}</select></div>
        <label for="sp-always">${tr('spAlways')}</label>
        <div><input type="checkbox" id="sp-always" ${config.sponsors?.sponsor_always ? 'checked' : ''} /></div>
        <label for="interval">${tr('interval')}</label>
        <div><input type="text" id="interval" value="${esc(config.sponsors?.sponsor_interval || '')}" style="max-width:120px" /></div>
        <label for="pause">${tr('pause')}</label>
        <div style="display:flex;gap:8px"><input type="text" id="pause" value="${esc(config.sponsors?.sponsor_round ?? '')}" style="max-width:120px" />
        <button class="btn" id="save-interval">${tr('save')}</button></div>
      </div>
    </div>`
  const root = $('#tab-sponsors')
  root.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', async () => {
      const i = Number(b.dataset.remove)
      await update((c) => c.sponsors?.sponsors?.splice(i, 1)).catch((e) => toast(tr('saveError', { e: e.message }), true))
      toast(tr('removed'))
      renderSponsors()
    })
  )
  $('#save-interval').addEventListener('click', async () => {
    await update((c) => {
      c.sponsors ||= {}
      c.sponsors.sponsor_interval = $('#interval').value.trim()
      c.sponsors.sponsor_round = $('#pause').value.trim()
      c.sponsors.sponsor_position = $('#sp-pos').value
      c.sponsors.sponsor_always = $('#sp-always').checked
    })
      .then(() => toast(tr('saved')))
      .catch((e) => toast(tr('saveError', { e: e.message }), true))
  })
  $('#upload').addEventListener('change', async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    $('#upload-label').firstChild.textContent = tr('uploading')
    try {
      const urls = []
      for (const file of files) {
        const body = new FormData()
        body.append('image', file)
        const res = await fetch(`${API}/upload`, { method: 'POST', body })
        if (!res.ok) throw new Error(res.status)
        urls.push((await res.json()).url)
      }
      await update((c) => {
        c.sponsors ||= {}
        c.sponsors.sponsors = [...(c.sponsors.sponsors || []), ...urls]
      })
      toast(tr('saved'))
    } catch (err) {
      toast(tr('saveError', { e: err.message }), true)
    }
    renderSponsors()
  })
}

// ---------- tabs + language ----------
let tab = (() => {
  try {
    return localStorage.getItem('newhud-tab') || 'live'
  } catch {
    return 'live'
  }
})()

// ?tab=agents opens a tab directly (links / tests)
{
  const t = new URLSearchParams(location.search).get('tab')
  if (t) tab = t
}
function showTab(name) {
  tab = name
  try {
    localStorage.setItem('newhud-tab', name)
  } catch {}
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name))
  document.querySelectorAll('section').forEach((s) => (s.hidden = s.id !== `tab-${name}`))
  if (name === 'themes') renderThemes()
  if (name === 'agents') renderAgents()
}

// ---------- tab: agents ----------
// Agent portrait per player and side, stored in the HUD config as agents_panel: { '<steamid>_CT': id, '<steamid>_T': id }
// (the same keys as the "Agents" section of the manager panel, so both places edit one setting).
// Players = the manager's player list + whoever is in the game right now (live data over socket.io).
let agentList = null // [{ id, side, en, ru }] from icons/agents/agents.json
const livePlayers = {} // steamid -> name, from the game
let agentFilter = ''
const AGENT_IMG = (id) => `./icons/agents/all/${id}.png`

function watchLivePlayers() {
  if (typeof window.io !== 'function') return
  const socket = window.io(BASE)
  socket.on('update', (raw) => {
    let changed = false
    for (const [id, p] of Object.entries(raw?.allplayers || {}))
      if (livePlayers[id] !== p.name) {
        livePlayers[id] = p.name
        changed = true
      }
    if (changed && tab === 'agents' && !document.activeElement?.closest('#tab-agents')) renderAgents()
  })
}

async function renderAgents() {
  const root = $('#tab-agents')
  if (!agentList) {
    try {
      agentList = await (await fetch('./icons/agents/agents.json', { cache: 'no-store' })).json()
    } catch {
      agentList = []
    }
  }
  let db = []
  let teams = {}
  try {
    const [p, t] = await Promise.all([fetch(`${BASE}/api/players`).then((r) => r.json()), fetch(`${BASE}/api/teams`).then((r) => r.json())])
    db = Array.isArray(p) ? p : []
    teams = Object.fromEntries((Array.isArray(t) ? t : []).map((x) => [x._id, x.name]))
  } catch {}
  const rows = new Map()
  for (const p of db) if (p.steamid) rows.set(p.steamid, { steamid: p.steamid, name: p.username || p.steamid, team: teams[p.team] || '', live: false })
  for (const [id, name] of Object.entries(livePlayers)) {
    const r = rows.get(id)
    if (r) r.live = true
    else rows.set(id, { steamid: id, name, team: '', live: true })
  }
  const list = [...rows.values()]
    .filter((r) => !agentFilter || `${r.name} ${r.team}`.toLowerCase().includes(agentFilter.toLowerCase()))
    .sort((a, b) => Number(b.live) - Number(a.live) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name))
  const picks = config.agents_panel || {}
  const label = (a) => (lang === 'ru' ? a.ru || a.en : a.en)
  const select = (steamid, side) => {
    const cur = picks[`${steamid}_${side}`] || ''
    const opts = agentList
      .filter((a) => a.side === side)
      .map((a) => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${esc(label(a))}</option>`)
      .join('')
    return `<div class="agent-pick">
      <img src="${cur ? AGENT_IMG(cur) : ''}" ${cur ? '' : 'hidden'} alt="" />
      <select data-steamid="${steamid}" data-side="${side}"><option value="">${esc(tr('agentAuto'))}</option>${opts}</select>
    </div>`
  }
  root.innerHTML = `
    <div class="group">
      <h2>${tr('tabAgents')}</h2><p class="hint">${tr('agentsHint')}</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input type="text" id="agent-search" placeholder="${esc(tr('agentSearch'))}" value="${esc(agentFilter)}" style="max-width:280px" />
        <button class="btn" id="agent-reset">${tr('agentResetAll')}</button>
      </div>
      ${
        list.length
          ? `<table class="agents"><thead><tr><th>${tr('agentPlayer')}</th><th>CT</th><th>T</th></tr></thead><tbody>
          ${list
            .map(
              (r) => `<tr><td><b>${esc(r.name)}</b>${r.live ? ` <span class="live">${tr('agentInGame')}</span>` : ''}<small>${esc(r.team)}</small></td>
              <td>${select(r.steamid, 'CT')}</td><td>${select(r.steamid, 'T')}</td></tr>`
            )
            .join('')}
          </tbody></table>`
          : `<p class="hint">${tr('agentNoPlayers')}</p>`
      }
    </div>`
  $('#agent-search').addEventListener('input', (e) => {
    agentFilter = e.target.value
    clearTimeout(renderAgents.t)
    renderAgents.t = setTimeout(() => {
      renderAgents().then(() => {
        const s = $('#agent-search')
        s.focus()
        s.setSelectionRange(s.value.length, s.value.length)
      })
    }, 250)
  })
  $('#agent-reset').addEventListener('click', async () => {
    if (!confirm(tr('agentResetConfirm'))) return
    await update((c) => delete c.agents_panel).catch((e) => toast(tr('saveError', { e: e.message }), true))
    toast(tr('saved'))
    renderAgents()
  })
  root.querySelectorAll('select[data-steamid]').forEach((sel) =>
    sel.addEventListener('change', async () => {
      const { steamid, side } = sel.dataset
      const img = sel.previousElementSibling
      img.hidden = !sel.value
      if (sel.value) img.src = AGENT_IMG(sel.value)
      try {
        await update((c) => {
          c.agents_panel ||= {}
          c.agents_panel[`${steamid}_${side}`] = sel.value // '' = automatic (same as the manager select)
        })
        toast(tr('saved'))
      } catch (e) {
        toast(tr('saveError', { e: e.message }), true)
      }
    })
  )
}
watchLivePlayers()
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (b) showTab(b.dataset.tab)
})

function renderAll() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = tr(e.dataset.i18n)))
  document.querySelectorAll('#lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang))
  document.title = tr('title')
  setStatus()
  renderLive()
  renderSettings()
  renderSponsors()
  showTab(tab)
}
$('#lang').addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (!b) return
  lang = b.dataset.lang
  try {
    localStorage.setItem('newhud-lang', lang)
  } catch {}
  renderAll()
})

loadConfig()
  .catch(() => (online = false))
  .finally(renderAll)
