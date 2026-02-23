/**
 * Формирование payload ходов для передачи в submitMove / applyLocalMove.
 * Каждая функция возвращает объект, описывающий действие игрока.
 */

/**
 * Ход убийцы.
 *
 * Подфаза "intimidation":
 *   killer_move("intimidation", characterId) → { action: "intimidate", characterId }
 *   Вызывается дважды (для двух запугиваемых).
 *
 * Подфаза "murder":
 *   killer_move("murder", characterId) → { action: "kill", characterId }
 *   killer_move("murder", null)        → { action: "skip" }
 *
 * @param {string} subphase — "intimidation" | "murder"
 * @param {string|null} characterId — id персонажа (null для skip)
 * @returns {Object}
 */
export function killer_move(subphase, characterId) {
  if (subphase === "intimidation") {
    return { action: "intimidate", characterId };
  }
  if (subphase === "murder") {
    if (!characterId) return { action: "skip" };
    return { action: "kill", characterId };
  }
  throw new Error(`Неизвестная подфаза убийцы: ${subphase}`);
}

/**
 * Ход детектива.
 *
 * Действия:
 *   "urgent_call"  — переместиться в квартал убийства
 *     { action: "urgent_call", toAreaId }
 *
 *   "move"         — очко движения: переместить фишку
 *     { action: "move", toAreaId }
 *
 *   "interrogate"  — допрос жителя
 *     { action: "interrogate", characterId, question }
 *     question: "gender" | "age" | "body_type" | "height"
 *
 *   "surveillance" — слежка за жителем
 *     { action: "surveillance", characterId }
 *
 *   "building"     — действие здания в текущем квартале
 *     { action: "building", buildingType, ...params }
 *     params для "Закусочная": { characterId, question }
 *     params для "Больница":   { characterId }
 *     params для "Пожарная часть": { socialGroup }
 *
 *   "move_resident" — перемещение жителя при срочном вызове
 *     { action: "move_resident", characterId, toAreaId }
 *
 * @param {string} action
 * @param {Object} [params]
 * @returns {Object}
 */
export function detective_move(action, params = {}) {
  return { action, ...params };
}

/**
 * Фаза города: перемещение жителя одной соцгруппы.
 *
 * @param {string} characterId
 * @param {string} fromAreaId
 * @param {string} toAreaId
 * @returns {Object}
 */
export function characters_move(characterId, fromAreaId, toAreaId) {
  return { action: "move_character", characterId, fromAreaId, toAreaId };
}
