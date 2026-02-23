import { apiCreateGame, apiJoinGame } from "./scripts/api.js";

/**
 * Инициализация главной страницы: подписка на кнопки «Создать партию» и «Подключиться».
 */
function initStartPage() {
  const roomInput = document.getElementById("room-name-input");
  const codeInput = document.getElementById("game-code-input");
  const btnCreate = document.getElementById("btn-create-game");
  const btnJoin   = document.getElementById("btn-join-game");

  if (btnCreate) {
    btnCreate.addEventListener("click", () => {
      const name = roomInput ? roomInput.value.trim() : "";
      if (!name) {
        if (roomInput) roomInput.classList.add("error_input");
        return;
      }
      if (roomInput) roomInput.classList.remove("error_input");
      createGame(name);
    });
  }

  if (roomInput) {
    roomInput.addEventListener("input", () => roomInput.classList.remove("error_input"));
    roomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnCreate && btnCreate.click();
    });
  }

  if (btnJoin) {
    btnJoin.addEventListener("click", () => {
      const code = codeInput ? codeInput.value.trim() : "";
      if (!code) {
        if (codeInput) codeInput.classList.add("error_input");
        return;
      }
      if (codeInput) codeInput.classList.remove("error_input");
      joinGame(code);
    });
  }

  if (codeInput) {
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnJoin && btnJoin.click();
    });
    codeInput.addEventListener("input", () => codeInput.classList.remove("error_input"));
  }
}

document.addEventListener("DOMContentLoaded", initStartPage);

/**
 * Создаёт партию через Socket.IO (событие create_game на сервере).
 * Получает gameId, code, role → сохраняет роль, переходит на map.html.
 * @param {string} playerName
 */
async function createGame(playerName) {
  const btn = document.getElementById("btn-create-game");
  if (btn) { btn.disabled = true; btn.textContent = "Создание..."; }

  try {
    const { gameId, code } = await apiCreateGame(playerName);

    const codeDisplay = document.getElementById("display-game-code");
    if (codeDisplay) codeDisplay.textContent = code;

    window.location.href = `./map.html?gameId=${encodeURIComponent(gameId)}`;
  } catch (e) {
    console.error("[createGame] error:", e);
    const gameId = playerName.replace(/\s+/g, "-") + "-" + Date.now().toString(36);
    window.location.href = `./map.html?gameId=${encodeURIComponent(gameId)}`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Создать партию"; }
  }
}

/**
 * Подключается к партии по коду через Socket.IO (событие join_game).
 * @param {string} code — 5-символьный код партии
 */
async function joinGame(code) {
  const btn      = document.getElementById("btn-join-game");
  const codeInput = document.getElementById("game-code-input");
  if (btn) { btn.disabled = true; btn.textContent = "Подключение..."; }

  try {
    const { gameId } = await apiJoinGame(code.toUpperCase());
    window.location.href = `./map.html?gameId=${encodeURIComponent(gameId)}`;
  } catch (e) {
    console.error("[joinGame] error:", e);
    if (codeInput) codeInput.classList.add("error_input");
    alert("Партия не найдена. Проверьте код.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Подключиться"; }
  }
}
