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
  - **style/global.css** — общие стили, состояния ячеек, панель состояния, форма на главной.
- **data/** — статические и эталонные данные:
  - **districts.json** — массив районов (id, name), порядок совпадает с сеткой карты 4×4.
  - **characters.json**, **social_group.json** — данные персонажей и групп.
  - **game_state_example.json** — пример ответа сервера на GET /game/:id для согласования формата.

## Роли HTML-страниц

- **Главная (index.html):** выбор «Создать партию» или «Подключиться» по коду; кнопка «Играть локально» ведёт на map.html без сервера. Элементы: `#btn-create-game`, `#game-code-input`, `#btn-join-game`, `#link-local-game`.
- **Карта (map.html):** отображение раунда, фазы и индикатора хода; ячейки с `data-area-id`, блоки с `data-block-index`. Элементы панели: `#current-round`, `#current-phase`, `#turn-indicator`, `#display-game-code`. Состояния ячеек задаются классами `map-cell--selectable`, `map-cell--selected`, `map-cell--disabled`.

## REST API сервера

- **POST /game** — создать партию. Тело (опционально): `{ "playerName": "..." }`. Ответ: `{ "gameId", "code", "role" }`.
- **POST /game/join** — подключиться по коду. Тело: `{ "code": "ABC12" }`. Ответ: `{ "gameId", "role" }` или ошибка.
- **GET /game/:id** — получить состояние партии (для отображения и polling). Ответ: объект состояния (см. формат ниже).
- **POST /game/:id/move** — сделать ход. Тело: зависит от фазы (например `{ "phase", "areaId", "slotIndex", "characterId" }`). Ответ: обновлённое состояние или ошибка валидации.

Игровой цикл: фазы по очереди — убийца → детектив → город; затем следующий раунд. Клиент обновляет состояние из ответа move или через polling GET /game/:id.

## Формат состояния игры

Объект состояния (ответ GET /game/:id и POST /game/:id/move): `gameId`, `code`, `round`, `maxRounds`, `phase` (killer | detective | city), `currentPlayerRole`, `players` (роли и признак подключения), `board` (привязка персонажей к районам/слотам: массив записей с `areaId`, `slotIndex`, `characterId`), `scores`. Детальный пример — в `data/game_state_example.json`.

## Модули JS и назначение

| Модуль | Назначение |
|--------|------------|
| start_game.js | initStartPage — подписка на кнопки и поле кода; createGame, joinGame — вызов API и переход на карту; goToMap — переход на карту без сервера. |
| main.js | initMap — инициализация карты и polling; startPolling, stopPolling; applyGameState — обновление DOM по состоянию; isMyTurn; onCellClick — обработка клика и вызов move + submitMove; submitMove — отправка хода. |
| scripts/api.js | apiCreateGame, apiJoinGame, apiGetState, apiMove — вызовы REST API. |
| scripts/move.js | killer_move, detective_move, characters_move — формирование payload хода для текущей фазы. |
| scripts/check.js | check_intimidated, check_move — проверки по правилам. |
| scripts/receiving_data.js | getMapCells, getCellBlocks, getAreaIdFromCell — чтение DOM карты. |

Подключение: index.html — `src/start_game.js`; map.html — `src/main.js`. main.js при необходимости импортирует scripts/receiving_data.js, move.js, check.js, api.js.
