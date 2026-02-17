/**
 * По объекту персонажа (или id) проверить, запуган ли он (intimidated). Возвращает boolean.
 * @param {Object|string} character — объект персонажа или id
 */
export function check_intimidated(character) {}

/**
 * Проверка допустимости хода (например перемещение между районами/слотами в фазе города).
 * Возвращает boolean или объект с причиной ошибки.
 * @param {string} phase — фаза (killer | detective | city)
 * @param {Object|string} from — источник (район/слот)
 * @param {Object|string} to — цель
 */
export function check_move(phase, from, to) {}
