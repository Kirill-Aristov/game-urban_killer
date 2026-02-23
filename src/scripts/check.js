import { canMoveTo, getOrthogonalNeighbors } from "./rules_game.js";

/**
 * Проверяет, запуган ли персонаж по записи с доски.
 * @param {{ intimidated: boolean }} boardEntry — объект из state.board
 * @returns {boolean}
 */
export function check_intimidated(boardEntry) {
  return Boolean(boardEntry && boardEntry.intimidated);
}

/**
 * Проверяет допустимость перемещения жителя между кварталами в разных фазах.
 *
 * @param {string} phase — "killer" | "detective" | "city"
 * @param {string} fromAreaId
 * @param {string} toAreaId
 * @param {Object} state — текущее состояние игры
 * @returns {{ ok: boolean, reason?: string }}
 */
export function check_move(phase, fromAreaId, toAreaId, state) {
  if (!fromAreaId || !toAreaId) {
    return { ok: false, reason: "Не указан квартал источника или цели" };
  }

  if (fromAreaId === toAreaId) {
    return { ok: false, reason: "Квартал источника совпадает с целевым" };
  }

  // Цель должна быть ортогональным соседом источника
  const neighbors = getOrthogonalNeighbors(fromAreaId);
  if (!neighbors.includes(toAreaId)) {
    return { ok: false, reason: "Кварталы не являются соседними" };
  }

  // Цель не должна быть местом преступления и не должна быть переполнена
  if (!canMoveTo(state, toAreaId)) {
    return { ok: false, reason: "Целевой квартал является местом преступления или заполнен (3 жителя)" };
  }

  if (phase === "detective") {
    // При срочном вызове нельзя перемещать жителей на место последнего преступления
    const lastVictim = state.victims[state.victims.length - 1];
    if (lastVictim && toAreaId === lastVictim.areaId) {
      return { ok: false, reason: "Нельзя переместить жителя на место преступления" };
    }
  }

  return { ok: true };
}
