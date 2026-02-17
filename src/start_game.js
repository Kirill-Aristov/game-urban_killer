/**
 * Инициализация главной страницы: подписка на кнопки «Создать партию» и «Подключиться», на поле кода. Вызвать при загрузке.
 */
function initStartPage() {}

/**
 * Запрос POST /game, получение gameId и code, сохранение в sessionStorage/localStorage, переход на map.html?gameId=...
 */
function createGame() {}

/**
 * Запрос POST /game/join с кодом, при успехе — сохранение gameId и роли, переход на карту.
 * @param {string} code — код партии
 */
function joinGame(code) {}

/**
 * Переход на map.html без сервера (локальная партия).
 */
function goToMap() {}
