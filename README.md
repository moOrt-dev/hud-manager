# New HUD — CS2 broadcast HUD for JTs Hud Manager

### ⬇️ [Скачать установщик / Download the installer (HUD-Manager-mo_ORT-Setup-7.13.27.exe)](https://github.com/moOrt-dev/hud-manager/releases/latest/download/HUD-Manager-mo_ORT-Setup-7.13.27.exe)

Все версии / All versions: [github.com/moOrt-dev/hud-manager/releases](https://github.com/moOrt-dev/hud-manager/releases) · Репозиторий / Repository: [github.com/moOrt-dev/hud-manager](https://github.com/moOrt-dev/hud-manager)

[Русский](#русский) · [English](#english)

---

## Русский

**New HUD** — HUD для трансляций Counter-Strike 2. Работает в [JTs Hud Manager](https://github.com/JohnTimmermann/JTs-Hud-Manager) и в сборке менеджера от mo_ORT (релизы в этом репозитории).

### Что умеет
- **11 тем:** Default, BLAST, ESL, IEM, PGL, FACEIT, NEON, FPG, Light, StarLadder, EWC. Две раскладки плиток игроков: по бокам или карточками внизу.
- **Радар:** игроки, бомба, дымы с таймером, молотовы, гранаты в полёте. В клатче (1 на N) радар сам приближается к месту боя.
- **Лента убийств:** определяет фраги с HE, молотова и C4, показывает крыло у фрага в прыжке.
- **Ещё:** табло вместо TAB (статистика, экономика, лидеры), экран вето карт, спонсоры, окно дефуза, серия карт bo3/bo5.
- **Авто-камера (авто-обсервер):** сама переключает камеру CS2 на игрока, у которого главное событие: дефуз, плэнт, клатч, серия фрагов, дуэль. Есть режим «Только подсказка», камера на бомбу (Alt+B) и ручной режим (Alt+A).
- **Пульт управления** в браузере, интерфейс на русском или английском.

### Что нужно
- Windows 10/11, Counter-Strike 2.

### Установка (рекомендуется)
1. Скачайте **[HUD-Manager-mo_ORT-Setup-7.13.27.exe](https://github.com/moOrt-dev/hud-manager/releases/latest/download/HUD-Manager-mo_ORT-Setup-7.13.27.exe)** и запустите. Права администратора не нужны.
2. Выберите компоненты: программа, New HUD, помощник клавиш (автозапуск), ярлык на рабочем столе.
   Установщик ставит менеджер туда же, где стоит JTs Hud Manager, и заменяет его. Ваши матчи, команды, игроки и логотипы сохраняются.
3. Запустите **HUD Manager (mo_ORT)**. Установите GSI-конфиг для CS2 в настройках менеджера, если ещё не установлен.
4. В менеджере на странице **HUDs** выберите **New HUD** и откройте оверлей.
5. Зайдите в CS2 наблюдателем или включите демку (`playdemo имя`): HUD покажет игру.

Удаление: «Параметры → Приложения → HUD Manager (mo_ORT)». Ваши данные и папка HUD остаются.
Новые версии менеджер покажет сам, баннером «есть обновление».

### Установка вручную (только HUD, в оригинальный JTs Hud Manager)
1. Скачайте репозиторий: **Code → Download ZIP** — и распакуйте.
2. Скопируйте папку проекта в `%USERPROFILE%\jthm-huds\newHud` или выполните в ней `powershell -ExecutionPolicy Bypass -File deploy.ps1`.
3. Для авто-камеры через консоль CS2 поставьте патч `manager-patch\patch-telnet.ps1` (менеджер должен быть закрыт).

### Пульт управления
- В менеджере: карточка New HUD → **Open Control Panel**, или в браузере `http://localhost:1349/huds/newHud/control.html`.
- Вкладки: **управление в эфире** (табло, вето, части оверлея, авто-камера), **настройки**, **темы** с превью, **спонсоры**, **агенты**.
- Основные настройки есть и в **панели самого менеджера**. Изменения в оверлее видны сразу.

### Горячие клавиши
Работают, пока запущен менеджер, в любом окне, в том числе в игре.

| Клавиша | Действие |
|---|---|
| Alt+O | скрыть / показать весь HUD |
| Alt+P | плитки игроков |
| Alt+V | раскладка плиток: по бокам / внизу |
| Alt+N | названия команд в шапке |
| Alt+M | радар |
| Shift+Z / Shift+X | радар больше / меньше |
| Alt+D | окно дефуза |
| Alt+K | экран вето карт |
| Alt+1 / Alt+2 / Alt+3 / Alt+0 | табло: статистика / экономика / лидеры / скрыть |
| Alt+A | авто-камера: ручное управление / вернуть авто |
| Alt+B | камера на бомбу сверху / вернуться к игрокам |
| Alt+F5 | перезагрузить оверлей |

### Авто-камера
Включается в пульте (вкладка «Управление в эфире» → «Авто-камера») или в панели менеджера. Подробная логика выбора по пунктам — в [docs/auto-camera.md](docs/auto-camera.md).

Камера CS2 переключается одним из двух способов. Способ **«Автоматически»** выбирает сам.

1. **Через консоль CS2** — все функции, включая Alt+B. Нужно:
   - параметры запуска CS2: `-netconport 2020 -insecure`. `-insecure` отключает VAC: так можно смотреть демки, свои серверы и LAN, но не матчмейкинг и серверы с VAC;
   - менеджер с поддержкой команд в консоль: сборка из релизов этого репозитория или оригинальный JT с патчем `manager-patch\patch-telnet.ps1`.
2. **Клавишами через помощника** — для серверов с VAC, где `-insecure` нельзя. Помощник нажимает в CS2 цифру слота игрока, и только когда окно CS2 активно и идёт наблюдение.
   - Запуск вместе с Windows: `helper\install-autostart.cmd`, отключить: `helper\uninstall-autostart.cmd`.
   - Разовый запуск: `helper\newhud-key-helper.cmd`.
   - Так недоступны Alt+B и вид от первого лица.

**Советы:**
- Если не работают цифры 9 и 0, выполните в консоли CS2 `spec_usenumberkeys_nobinds 1`.
- С запущенным античитом FACEIT консоль CS2 закрыта. Для авто-камеры через консоль закройте FACEIT.
- Сначала попробуйте режим **«Только подсказка»**: камера не трогается, а пульт показывает, кого бы выбрала авто-камера, и ведёт журнал решений.

### Безопасность
Патч `manager-patch\patch-telnet.ps1` добавляет в менеджер передачу команд в консоль CS2. По умолчанию команды принимаются только со страниц менеджера на этом компьютере, и только команды камеры (`spec_*`, `echo`). Открыть доступ можно только на самом компьютере: `manager-patch\telnet-access.ps1`, параметры описаны в файле. Не открывайте порты 1349 и 2020 в роутере или брандмауэре.

### Для разработчиков: сборка установщика
1. Поставьте менеджер и примените свои правки, установщик собирается из установленной программы (`%LOCALAPPDATA%\Programs\jts-hud`).
2. Распакуйте портативный [NSIS](https://nsis.sourceforge.io) (zip) в `_build\tools\nsis-3.13`.
3. Выполните `powershell -ExecutionPolicy Bypass -File installer\build.ps1 -Version 7.13.28`. Номер версии должен быть той же длины, что 7.13.27: по нему менеджер показывает баннер обновления.
4. Готовый файл — в `_build\out`. Скрипт собирает HUD без игроков и загруженных логотипов и останавливается, если находит в сборке личные данные (имя пользователя Windows, пути, Steam ID).
5. Проверка без установки: `HUD-Manager-mo_ORT-Setup-<версия>.exe /S /TEST /D=<папка>` только распаковывает программу в папку.

### Авторы и лицензии
- HUD — mo_ORT (twitch.tv/mo_ort32).
- [JTs Hud Manager](https://github.com/JohnTimmermann/JTs-Hud-Manager) — John Timmermann, GPL-3.0.
- Иконки оружия и интерфейса, изображения радаров — [lexogrine/cs2-react-hud](https://github.com/lexogrine/cs2-react-hud), MIT (`icons/LICENSE-lexogrine.txt`).
- Портреты агентов и игровая графика — © Valve Corporation.

---

## English

**New HUD** is a broadcast HUD for Counter-Strike 2. It runs in [JTs Hud Manager](https://github.com/JohnTimmermann/JTs-Hud-Manager) and in mo_ORT's build of the manager (releases in this repository).

### Features
- **11 themes:** Default, BLAST, ESL, IEM, PGL, FACEIT, NEON, FPG, Light, StarLadder, EWC. Two player tile layouts: rows at the sides or cards at the bottom.
- **Radar:** players, bomb, smokes with a timer, molotovs, grenades in flight. In a clutch (1 vs N) the radar zooms to the fight by itself.
- **Killfeed:** detects HE, molotov and C4 kills, shows a wing on jump kills.
- **Also:** a scoreboard instead of TAB (stats, economy, leaders), a map veto screen, sponsors, a defuse window, the bo3/bo5 map series.
- **Auto camera (auto observer):** switches the CS2 camera to the player where the key moment is: a defuse, a plant, a clutch, a kill streak, a duel. There is a "Suggest only" mode, a bomb camera (Alt+B) and manual control (Alt+A).
- **A control page** in the browser, in English or Russian.

### Requirements
- Windows 10/11, Counter-Strike 2.

### Install (recommended)
1. Download **[HUD-Manager-mo_ORT-Setup-7.13.27.exe](https://github.com/moOrt-dev/hud-manager/releases/latest/download/HUD-Manager-mo_ORT-Setup-7.13.27.exe)** and run it. No admin rights needed.
2. Pick the components: the program, New HUD, the key helper (autostart), a desktop shortcut.
   The installer puts the manager where JTs Hud Manager lives and replaces it. Your matches, teams, players and logos are kept.
3. Start **HUD Manager (mo_ORT)**. Install the GSI config for CS2 in the manager settings if it is not installed yet.
4. On the manager's **HUDs** page pick **New HUD** and open the overlay.
5. Join CS2 as a spectator or play a demo (`playdemo name`): the HUD shows the game.

Uninstall: "Settings → Apps → HUD Manager (mo_ORT)". Your data and the HUD folder stay.
The manager shows new versions by itself, with an "update available" banner.

### Manual install (only the HUD, into the original JTs Hud Manager)
1. Download the repository: **Code → Download ZIP** — and unpack it.
2. Copy the project folder to `%USERPROFILE%\jthm-huds\newHud`, or run `powershell -ExecutionPolicy Bypass -File deploy.ps1` in it.
3. For the auto camera through the CS2 console, apply `manager-patch\patch-telnet.ps1` (the manager must be closed).

### Control page
- In the manager: the New HUD card → **Open Control Panel**, or in a browser: `http://localhost:1349/huds/newHud/control.html`.
- Tabs: **live control** (scoreboard, veto, overlay parts, auto camera), **settings**, **themes** with previews, **sponsors**, **agents**.
- The main settings are also in the **manager's own panel**. The overlay shows changes right away.

### Hotkeys
They work while the manager is running, in any window, the game included.

| Key | Action |
|---|---|
| Alt+O | hide / show the whole HUD |
| Alt+P | player tiles |
| Alt+V | tile layout: sides / bottom |
| Alt+N | team names in the top bar |
| Alt+M | radar |
| Shift+Z / Shift+X | radar bigger / smaller |
| Alt+D | defuse window |
| Alt+K | map veto screen |
| Alt+1 / Alt+2 / Alt+3 / Alt+0 | scoreboard: stats / economy / leaders / hide |
| Alt+A | auto camera: manual control / back to auto |
| Alt+B | camera on the bomb from above / back to the players |
| Alt+F5 | reload the overlay |

### Auto camera
Turn it on in the control page ("Live control" → "Auto camera") or in the manager's panel. The selection logic, point by point, is in [docs/auto-camera.md](docs/auto-camera.md) (in Russian).

The CS2 camera is switched in one of two ways. **"Automatically"** picks the way by itself.

1. **Through the CS2 console** — every feature, Alt+B included. You need:
   - CS2 launch options: `-netconport 2020 -insecure`. `-insecure` turns VAC off: fine for demos, your own servers and LAN, but not for matchmaking and VAC servers;
   - a manager that can pass commands to the console: the build from this repository's releases, or the original JT with the `manager-patch\patch-telnet.ps1` patch.
2. **By keys through the helper** — for VAC servers, where `-insecure` is not possible. The helper presses the player's slot number in CS2, only while the CS2 window is active and you are spectating.
   - Start it with Windows: `helper\install-autostart.cmd`, remove: `helper\uninstall-autostart.cmd`.
   - One-time start: `helper\newhud-key-helper.cmd`.
   - Alt+B and the first-person view are not available this way.

**Tips:**
- If keys 9 and 0 do not switch, run `spec_usenumberkeys_nobinds 1` in the CS2 console.
- With the FACEIT anti-cheat running the CS2 console is closed. Close FACEIT for the console way.
- Try the **"Suggest only"** mode first: the camera is not touched, and the control page shows who the auto camera would pick and keeps a log of its decisions.

### Security
The `manager-patch\patch-telnet.ps1` patch lets the manager pass commands to the CS2 console. By default only the manager's own pages on this PC may send them, and only camera commands (`spec_*`, `echo`). Access can be opened only on the PC itself: `manager-patch\telnet-access.ps1`, the options are described in the file. Do not open ports 1349 and 2020 in your router or firewall.

### For developers: building the installer
1. Install the manager and apply your changes: the installer is built from the installed program (`%LOCALAPPDATA%\Programs\jts-hud`).
2. Unpack portable [NSIS](https://nsis.sourceforge.io) (zip) into `_build\tools\nsis-3.13`.
3. Run `powershell -ExecutionPolicy Bypass -File installer\build.ps1 -Version 7.13.28`. The version must have the same length as 7.13.27: the manager shows its update banner by it.
4. The file is in `_build\out`. The script builds the HUD without players and uploaded logos and stops if it finds personal data in the build (the Windows user name, paths, Steam IDs).
5. Check without installing: `HUD-Manager-mo_ORT-Setup-<version>.exe /S /TEST /D=<folder>` only unpacks the program into the folder.

### Credits and licenses
- HUD — mo_ORT (twitch.tv/mo_ort32).
- [JTs Hud Manager](https://github.com/JohnTimmermann/JTs-Hud-Manager) — John Timmermann, GPL-3.0.
- Weapon and UI icons, radar images — [lexogrine/cs2-react-hud](https://github.com/lexogrine/cs2-react-hud), MIT (`icons/LICENSE-lexogrine.txt`).
- Agent portraits and game art — © Valve Corporation.
