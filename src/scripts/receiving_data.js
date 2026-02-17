/**
 * Возвращает NodeList или массив всех элементов .map-cell (с data-area-id).
 */
export function getMapCells() {}

/**
 * Для данной ячейки возвращает массив из трёх .map-cell__block (или объект с индексами).
 * @param {Element} cellElement — элемент .map-cell
 */
export function getCellBlocks(cellElement) {}

/**
 * Вернуть data-area-id ячейки.
 * @param {Element} cellElement — элемент .map-cell
 */
export function getAreaIdFromCell(cellElement) {}
