/**
 * In-memory хранилище состояний партий.
 * Структура: Map<gameId, { state, code, rolesPicked: { killer: socketId|null, detective: socketId|null } }>
 */

const games = new Map();

/**
 * Создаёт новую партию в хранилище.
 * @param {string} gameId
 * @param {string} code — 5-символьный код для подключения второго игрока
 * @param {Object} state — начальное состояние
 */
export function createGame(gameId, code, state) {
  games.set(gameId, {
    state,
    code,
    rolesPicked: { killer: null, detective: null },
  });
}

/**
 * Возвращает запись партии или undefined.
 * @param {string} gameId
 */
export function getGame(gameId) {
  return games.get(gameId);
}

/**
 * Ищет партию по коду подключения.
 * @param {string} code
 * @returns {{ gameId: string, game: object } | null}
 */
export function findByCode(code) {
  for (const [gameId, game] of games.entries()) {
    if (game.code === code) return { gameId, game };
  }
  return null;
}

/**
 * Обновляет состояние партии.
 * @param {string} gameId
 * @param {Object} newState
 */
export function updateState(gameId, newState) {
  const game = games.get(gameId);
  if (game) game.state = newState;
}

/**
 * Назначает роль игроку (сохраняет socketId).
 * Возвращает false если роль уже занята.
 * @param {string} gameId
 * @param {"killer"|"detective"} role
 * @param {string} socketId
 * @returns {boolean}
 */
export function pickRole(gameId, role, socketId) {
  const game = games.get(gameId);
  if (!game) return false;
  if (game.rolesPicked[role] !== null) return false;
  game.rolesPicked[role] = socketId;
  return true;
}

/**
 * Возвращает состояние занятости ролей.
 * @param {string} gameId
 * @returns {{ killer: boolean, detective: boolean }}
 */
export function getRolesPicked(gameId) {
  const game = games.get(gameId);
  if (!game) return { killer: false, detective: false };
  return {
    killer: game.rolesPicked.killer !== null,
    detective: game.rolesPicked.detective !== null,
  };
}

/** Таймауты отложенного удаления: gameId → timeoutId */
const deleteTimeouts = new Map();

/**
 * Удаляет партию из хранилища.
 * @param {string} gameId
 */
export function deleteGame(gameId) {
  const tid = deleteTimeouts.get(gameId);
  if (tid) {
    clearTimeout(tid);
    deleteTimeouts.delete(gameId);
  }
  games.delete(gameId);
}

/**
 * Запланировать удаление партии через delay мс, если в комнате никого нет.
 * При join_lobby/join_room — отменить запланированное удаление.
 * @param {string} gameId
 * @param {number} delay — мс (по умолчанию 15000)
 */
export function scheduleDeleteIfEmpty(gameId, delay = 15000) {
  const tid = deleteTimeouts.get(gameId);
  if (tid) clearTimeout(tid);

  deleteTimeouts.set(
    gameId,
    setTimeout(() => {
      deleteTimeouts.delete(gameId);
      if (games.has(gameId)) {
        games.delete(gameId);
        console.log(`[delete_game] gameId=${gameId} — expired (no rejoin)`);
      }
    }, delay)
  );
}

/**
 * Отменить запланированное удаление (вызывать при join_lobby/join_room).
 * @param {string} gameId
 */
export function cancelScheduledDelete(gameId) {
  const tid = deleteTimeouts.get(gameId);
  if (tid) {
    clearTimeout(tid);
    deleteTimeouts.delete(gameId);
  }
}

/**
 * Возвращает количество активных партий (для мониторинга).
 */
export function gamesCount() {
  return games.size;
}
