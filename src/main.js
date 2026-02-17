/**
 * При загрузке карты: чтение gameId из URL/sessionStorage, получение DOM ячеек и панели состояния,
 * вызов applyGameState(...) если есть состояние, подписка на клики по ячейкам, запуск polling при наличии gameId.
 */
function initMap() {}

/**
 * Запуск интервального опроса GET /game/:gameId и вызов applyGameState(data) при изменении (или каждый раз).
 * @param {string} gameId
 */
function startPolling(gameId) {}

/**
 * Остановка интервала polling.
 */
function stopPolling() {}

/**
 * Обновление DOM по объекту состояния: раунд, фаза, индикатор «ваш ход»/«ход соперника»,
 * подсветка ячеек (selectable/disabled), отображение персонажей в блоках по board.
 * @param {Object} state — объект состояния игры
 */
function applyGameState(state) {}

/**
 * Сейчас ли ход текущего игрока (по роли и state.currentPlayerRole). Возвращает boolean.
 */
function isMyTurn() {}

/**
 * Обработчик клика по ячейке: если ход не наш или ячейка disabled — выйти;
 * иначе в зависимости от фазы вызвать killer_move/detective_move/characters_move и затем submitMove.
 * @param {Element} cellElement — элемент .map-cell
 */
function onCellClick(cellElement) {}

/**
 * Запрос POST /game/:id/move с payload, при успехе обновить состояние (из ответа или повторным GET).
 * @param {Object} payload — данные хода
 */
function submitMove(payload) {}
