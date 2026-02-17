/**
 * Логика хода убийцы: выбор района/слота (и при необходимости персонажа).
 * Возвращает объект для submitMove (например { phase: 'killer', areaId, slotIndex }).
 * @param {string} areaId — id района (data-area-id)
 * @param {number} [slotIndex] — индекс слота в районе (0, 1, 2)
 */
export function killer_move(areaId, slotIndex) {}

/**
 * Логика хода детектива: опрос/выбор в районе. Возвращает объект для отправки на сервер.
 * @param {string} areaId
 * @param {number} [slotIndex]
 */
export function detective_move(areaId, slotIndex) {}

/**
 * Фаза города: движение персонажей (по правилам игры). Возвращает объект для submitMove.
 */
export function characters_move() {}
