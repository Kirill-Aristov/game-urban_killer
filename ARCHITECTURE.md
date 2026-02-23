# Архитектура проекта «Городской убийца»

## Структура проекта

- **index.html** — стартовая страница: меню, создание партии, подключение по коду, переход на карту или локальная партия.
- **map.html** — игровое поле: карта города (16 районов), панель состояния (раунд, фаза, чей ход, код партии).
- **src/** — клиентский код и стили:
  - **main.js** — точка входа для страницы карты: инициализация, polling, применение состояния, обработка кликов по ячейкам, отправка хода.
  - **start_game.js** — точка входа для главной: инициализация кнопок и поля кода, создание/подключение к партии, переход на карту.
  - **scripts/** — модули логики и API:
    - **api.js** — сетевые вызовы (создание игры, подключение, получение состояния, ход).
    - **move.js** — формирование payload хода по фазам (убийца, детектив, город).
    - **check.js** — проверки (запуган ли персонаж, допустимость хода).
    - **receiving_data.js** — работа с DOM карты (ячейки, блоки, areaId).
    - **initialization_game.js** — подготовка партии по правилам режима «Логика»: выбор 20 персонажей, раскладка по кварталам (угловые — по 2, остальные — по 1), случайный выбор мотива из 6 (logicMode: true), союзной соцгруппы, личности убийцы и фигуранта, стартовая позиция детектива.
    - **rules_game.js** — проверки по правилам: допустимость жертвы по мотиву, ограничения запугивания, перемещений, действий зданий, слежки.
  - **style/global.css** — общие стили, состояния ячеек, панель состояния, форма на главной.
- **data/** — статические и эталонные данные:
  - **districts.json** — массив районов (id, name, corner, img). Поле `img` — путь к изображению района в `assets/map/`. Порядок совпадает с сеткой карты 4×4. Поле `corner: true` у четырёх угловых районов (roki-hill, golden-beach, stadium, old-town) — при инициализации в них размещаются по 2 жителя.
  - **characters.json** — персонажи (id, profession, social_group, gender, age, body_type, height, intimidated, img). Поле `id` вида `char-N` используется для ссылок в состоянии игры. Поле `intimidated` — базовое значение (false); в ходе игры состояние запугивания хранится в `board[].intimidated`.
  - **social_group.json** — 9 соцгрупп (title, img). Используются при жетонах соцгрупп (фаза города, союзники убийцы). Изображения в `assets/social_group/`.
  - **motives.json** — 12 мотивов (id, title, description, logicMode, img). Ровно 6 мотивов имеют `logicMode: true` — они выкладываются на стол в режиме «Логика» (убийца выбирает 1 тайно). Изображения в `assets/motives/`.
  - **building.json** — шаблон 4 типов зданий: массив `{ type, id, img, description }`. Типы: Полицейский участок (police_station), Закусочная (snack_bar), Больница (hospital), Пожарная часть (fire_department) — по 2 каждого в игре. Изображения в `assets/building/`. При настройке детектив распределяет 8 зданий случайно по разным районам (макс. 1 в районе).
  - **scenarios.json** — массив готовых сценариев `{ id, name, motiveIds, buildings, residentsWithTwo }`. Мотивы (6 шт.) и раскладки зданий/жителей фиксированы. Используется при фазе `scenario_choice`.
  - **src/assets/** — иконки и изображения: `car.png` — стартовая позиция детектива; `map/` — районы; `building/` — здания; `motives/` — мотивы; `social_group/` — жетоны соцгрупп.
  - **game_state_example.json** — пример ответа сервера на GET /game/:id для согласования формата состояния (см. раздел ниже).

## Режим «Логика»

Базовый режим. Убийца совершает до 5 убийств, соблюдая выбранный мотив. Детектив после пятого убийства называет личность убийцы и мотив. Победа детектива — оба ответа верны; иначе победа убийцы.

### Подготовка

**Фаза выбора сценария** (`phase: "scenario_choice"`):
0. После выбора обеих ролей — модал «Выберите сценарий»: готовый сценарий (1–5) или «Свой сценарий» (случайная раскладка). Любой игрок выбирает; при сценарии — board и buildings задаются из `scenarios.json`, мотив — из `motiveIds` сценария; при «Свой» — как раньше (случайно).

**Фаза настройки убийцы** (`phase: "setup"`):
1. Убийца тянет 3 случайных жетона соцгрупп, выбирает 1 (союзники), остальные 2 убирает.
2. Убийца выбирает 1 из 20 персонажей — свою личность; затем 1 из оставшихся — фигуранта.

**Фаза настройки детектива** (`phase: "setup_detective"`):
3. Детектив распределяет 20 жителей (если выбран «Свой сценарий») или подтверждает готовую раскладку (если выбран готовый сценарий).
4. Детектив распределяет 8 зданий (если «Свой») или подтверждает раскладку сценария.
5. Детектив выбирает угол города для стартовой позиции (иконка полицейской машины в `src/assets/police_car.png`).

**Завершение подготовки:**
6. Из мотивов с `logicMode: true` выбирается случайный, записывается в `secret`.
7. Игра начинается с 1-го хода убийцы.

### Структура раунда

**Фаза убийцы** (`phase: "killer"`):
- `killerSubphase: "intimidation"` — обязательно запугать 2 жителей (не в квартале детектива); они помечаются `intimidated: true` в `board`.
- `killerSubphase: "murder"` — убить 1 жителя по мотиву (не в квартале детектива, не сам убийца). Карта жертвы переходит в `victims`. Один раз за игру (`killerSkipUsed`) убийство можно пропустить; второй пропуск — поражение убийцы.

**Фаза детектива** (`phase: "detective"`):
- `detectiveSubphase: "urgent_call"` — переместиться в квартал последнего убийства; жителей из квартала переместить в соседние (не на место преступления, не в квартал с 3 жителями).
- `detectiveSubphase: "investigation"` — выполнить 2 разных действия (`detectiveActionsLeft`) и использовать 2 очка движения (`detectiveMovePointsLeft`). Действия: допрос (жителей в своём квартале, кроме запуганных, 1 вопрос: пол/возраст/телосложение/рост), слежка (положить жетон, задать вопрос «Можешь убить этого жителя сейчас?»), действие здания (зависит от типа).

**Фаза города** (`phase: "city"`):
- В квартале детектива запуганные жители успокаиваются (`intimidated: false`).
- Убийца тянет жетон соцгруппы и опционально перемещает её жителей; затем детектив делает то же.

**Действия зданий:**
| Тип | Эффект |
|-----|--------|
| Полицейский участок | Взять жетон слежки |
| Закусочная | Допросить 1 жителя в своём или соседнем квартале |
| Больница | Успокоить 1 запуганного жителя |
| Пожарная часть | Взять жетон соцгруппы и переместить всех её представителей |

### Конец игры

После пятого убийства раунд доигрывается. Детектив объявляет `killerCharacterId` и `motiveId`. Сервер проверяет совпадение с `secret`. Оба верны — победа детектива; иначе — победа убийцы.

## Роли HTML-страниц

- **Главная (index.html):** выбор «Создать партию» или «Подключиться» по коду; кнопка «Играть локально» ведёт на map.html без сервера. Элементы: `#btn-create-game`, `#game-code-input`, `#btn-join-game`, `#link-local-game`.
- **Карта (map.html):** отображение раунда, фазы и индикатора хода; ячейки с `data-area-id`, блоки с `data-block-index`. Элементы панели: `#current-round`, `#current-phase`, `#turn-indicator`, `#display-game-code`. При наличии в URL параметра `gameId` при первом заходе показывается модал выбора роли (#role-choice-modal); после выбора обеих ролей — модал выбора сценария (#scenario-choice-modal): «Свой сценарий» или один из 5 готовых. Справа от карты — колонка `.crimes-sidebar`: подпись «Убиты», 5 слотов `.crimes-slot` (вертикально, класс `crimes-slots--vertical`), `data-crime-index`; заполненный слот — `crimes-slot--filled`. Состояния ячеек задаются классами `map-cell--selectable`, `map-cell--selected`, `map-cell--disabled`. Во время настройки детектива (`setup_detective`) детектив видит панель `#setup-detective-panel` слева от карты: кнопки «Распределить случайно» / «Распределить» (жители), «Распределить случайно» / «Подтвердить» (здания), выбор угла; подтверждённые блоки подсвечиваются (`block--confirmed`, `map-cell--building-confirmed`); кнопки блокируются после клика до получения state_update (защита от wrongPhase). Справа внизу — кнопка `.witness-btn` (#btn-witness); по клику открывается модальное окно «Показания свидетелей» (#witness-modal): таблица опрашиваемых (1–10), соцгруппы, мотивы, поля для заметок; закрытие по крестику или Escape.

## Синхронизация

Два уровня:

**Уровень 1 — BroadcastChannel** (`src/scripts/sync.js`): синхронизация между вкладками одного браузера без сервера. После каждого `applyLocalMove` новое состояние рассылается всем вкладкам партии через канал `"game:<gameId>"`. Другие вкладки слушают и вызывают `applyGameState`.

**Уровень 2 — Socket.IO** (`socket.io` / `socket.io-client`): разные машины/браузеры через WebSocket. Сервер `server/index.js` (порт 3000) хранит состояния в памяти и рассылает обновления только нужным участникам. Каждому клиенту отправляется своя версия состояния (`stateFor`): убийца получает `secret`, детектив — нет; во время `setup_detective` убийца не видит `board` и `buildings` (распределение скрыто). Для разработки: Vite проксирует `/socket.io` → `localhost:3000` с `ws: true`.

## Socket.IO события

| Направление | Событие | Данные |
|-------------|---------|--------|
| клиент → сервер | `create_game` | `{ playerName }` |
| клиент → сервер | `join_game` | `{ code }` |
| клиент → сервер | `join_room` | `{ gameId, role }` (reconnect) |
| клиент → сервер | `make_move` | `{ gameId, payload, role }` (в т.ч. `payload.action: "pick_scenario"`) |
| сервер → клиент | `game_created` | `{ gameId, code }` |
| сервер → клиент | `room_roles` | `{ killer: bool, detective: bool }` (фаза setup) |
| сервер → клиент | `game_joined` | `{ gameId }` |
| сервер → клиент | `player_joined` | `{ role }` |
| сервер → клиент | `state_update` | `{ state, gameOver, winner }` |
| сервер → клиент | `game_error` | `{ message }` |

## Серверные модули

| Модуль | Назначение |
|--------|------------|
| server/index.js | Express-сервер: маршруты `/api/game*`, CORS, загрузка data/*.json при старте. |
| server/store.js | In-memory `Map<gameId, { state, code, roles }>`. Функции: createGame, getGame, findByCode, updateState, occupyDetective, deleteGame. |
| server/game_engine.js | `applyMove(state, payload, allChars)` — применяет ход без DOM, возвращает `{ state, error, gameOver, winner }`. Портирует логику `applyLocalMove` из main.js. Импортирует rules_game.js. |

## Формат состояния игры

Объект состояния (ответ GET /game/:id и POST /game/:id/move):

| Поле | Тип | Описание |
|------|-----|----------|
| `gameId` | string | Идентификатор партии |
| `code` | string | Код для подключения |
| `mode` | string | Режим игры (`"logic"`) |
| `round` | number | Текущий раунд (1–6) |
| `maxRounds` | number | Максимум раундов (5 или 6) |
| `phase` | string | Текущая фаза (`scenario_choice` \| `setup` \| `setup_detective` \| `killer` \| `detective` \| `city`) |
| `killerSubphase` | string\|null | Подфаза убийцы (`"intimidation"` \| `"murder"`) |
| `detectiveSubphase` | string\|null | Подфаза детектива (`"urgent_call"` \| `"investigation"`) |
| `detectiveActionsLeft` | number | Оставшихся действий детектива (0–2) |
| `detectiveMovePointsLeft` | number | Оставшихся очков движения детектива (0–2) |
| `currentPlayerRole` | string | Чей ход (`killer` \| `detective`) |
| `players` | array | `[{ role, connected }]` |
| `board` | array | `[{ areaId, slotIndex, characterId, intimidated }]` — персонажи на карте |
| `buildings` | array | `[{ type, areaId }]` — здания (копия building.json) |
| `detectivePosition` | object | `{ areaId }` — позиция фишки детектива |
| `surveillanceTokens` | array | `[{ areaId }]` — жетоны слежки на карте |
| `victims` | array | `[{ characterId, areaId, crimeIndex }]` — убитые (до 5) |
| `killerSkipUsed` | boolean | Использовал ли убийца право пропустить убийство |
| `secret` | object | Скрытые данные убийцы: `{ killerCharacterId, figurantCharacterId, motiveId, allySocialGroup }` — передаётся только клиенту убийцы |
| `scores` | object | `{ killer, detective }` |

Детальный пример — в `data/game_state_example.json`.

## Модули JS и назначение

| Модуль | Назначение |
|--------|------------|
| main.js | Точка входа карты: initMap, handleServerState, onCellClick, submitMove, showVictory, stopConnection. Оркестрирует модули. |
| scripts/constants.js | PHASE_LABELS, CORNER_DISTRICTS, MY_ROLE_KEY_PREFIX, SETUP_PANEL_BUTTON_IDS. |
| scripts/utils.js | getGameIdFromUrl — чтение gameId из query string. |
| scripts/game_state.js | Глобальное мутабельное состояние: state, myRole, allCharacters, allDistricts, allScenarios, broadcast, intimidatedCount, resetPendingRole. |
| scripts/data_loader.js | loadCharacters, loadDistricts, loadScenarios — загрузка JSON в game_state. |
| scripts/setup_ui.js | renderSetupPhase, initRoleChoiceModal, showScenarioChoiceModal, showLocalRoleChoice, showLocalScenarioChoice, submitSetupMove, closeScenarioChoiceModal. |
| scripts/board_ui.js | applyGameState, renderBoard, initWitnessModal, isMyTurn, isCellSelectable. |
| scripts/local_game.js | startLocalGame, applyLocalMove — локальная партия через BroadcastChannel. |
| scripts/sync.js | createBroadcast(gameId) — обёртка BroadcastChannel. |
| scripts/api.js | apiMove, apiJoinRoom, apiJoinLobby, apiPickRole, onStateUpdate, onRoomRoles и др. |
| scripts/move.js | killer_move, detective_move, characters_move — формирование payload хода. |
| scripts/receiving_data.js | getMapCells, getCellBlocks, getAreaIdFromCell — чтение DOM карты. |
| scripts/initialization_game.js | buildInitialState, buildBoard, buildBoardFromScenario, distributeBuildingsRandom, finalizeGameState. |
| scripts/rules_game.js | Проверки правил: canIntimidate, canKill, canMoveTo, здания, слежка, победа. |

Подключение: index.html — `src/start_game.js`; map.html — `src/main.js`.
