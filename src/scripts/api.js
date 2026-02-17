/**
 * POST /game. Возвращает Promise с { gameId, code, role }.
 * @param {string} [playerName] — имя игрока (опционально)
 */
export function apiCreateGame(playerName) {}

/**
 * POST /game/join. Возвращает Promise с { gameId, role }.
 * @param {string} code — код партии
 */
export function apiJoinGame(code) {}

/**
 * GET /game/:id. Возвращает Promise с объектом состояния.
 * @param {string} gameId
 */
export function apiGetState(gameId) {}

/**
 * POST /game/:id/move. Возвращает Promise с обновлённым состоянием или ошибкой.
 * @param {string} gameId
 * @param {Object} payload — данные хода
 */
export function apiMove(gameId, payload) {}
