/**
 * Возвращает NodeList всех элементов .map-cell (с data-area-id).
 * @returns {NodeListOf<Element>}
 */
export function getMapCells() {
  return document.querySelectorAll(".map-cell");
}

/**
 * Для данной ячейки возвращает NodeList из .map-cell__block элементов.
 * @param {Element} cellElement — элемент .map-cell
 * @returns {NodeListOf<Element>}
 */
export function getCellBlocks(cellElement) {
  return cellElement.querySelectorAll(".map-cell__block");
}

/**
 * Возвращает data-area-id ячейки.
 * @param {Element} cellElement — элемент .map-cell
 * @returns {string}
 */
export function getAreaIdFromCell(cellElement) {
  return cellElement.dataset.areaId;
}
