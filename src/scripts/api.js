/**
 * Socket.IO клиент — единая точка подключения к серверу.
 *
 * Экспортирует:
 *   getSocket()                      — синглтон io()
 *   apiCreateGame(name)              → Promise<{ gameId, code }>
 *   apiJoinGame(code)                → Promise<{ gameId }>
 *   apiPickRole(gameId, role)        — выбор роли в комнате
 *   apiJoinRoom(gameId, role)        — восстановление соединения после reload
 *   apiMove(gameId, payload, role)   — отправка хода (без промиса, ответ через onState)
 *   onStateUpdate(cb)    — подписка на входящие обновления состояния
 *   offStateUpdate(cb)   — отписка
 *   onRoomRoles(cb)      — подписка на обновления занятости ролей
 *   offRoomRoles(cb)     — отписка
 *   onGameError(cb)      — подписка на серверные ошибки
 *   onPlayerJoined(cb)   — уведомление об подключении второго игрока
 */

import { io } from "socket.io-client";

let _socket = null;

/**
 * Возвращает синглтон Socket.IO соединения.
 * @returns {import("socket.io-client").Socket}
 */
export function getSocket() {
  if (!_socket) {
    _socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    _socket.on("connect", () =>
      console.log("[socket] connected:", _socket.id)
    );
    _socket.on("disconnect", (reason) =>
      console.log("[socket] disconnected:", reason)
    );
    _socket.on("connect_error", (err) =>
      console.warn("[socket] connect error:", err.message)
    );
  }
  return _socket;
}

/**
 * Создаёт новую партию через Socket.IO.
 * @param {string} [playerName]
 * @returns {Promise<{ gameId: string, code: string }>}
 */
export function apiCreateGame(playerName) {
  return new Promise((resolve, reject) => {
    const s = getSocket();

    const onCreated = (data) => { cleanup(); resolve(data); };
    const onError = ({ message }) => { cleanup(); reject(new Error(message)); };

    function cleanup() {
      s.off("game_created", onCreated);
      s.off("game_error", onError);
    }

    s.once("game_created", onCreated);
    s.once("game_error", onError);
    s.emit("create_game", { playerName: playerName || "" });
  });
}

/**
 * Подключается к партии по 5-символьному коду.
 * @param {string} code
 * @returns {Promise<{ gameId: string }>}
 */
export function apiJoinGame(code) {
  return new Promise((resolve, reject) => {
    const s = getSocket();

    const onJoined = (data) => { cleanup(); resolve(data); };
    const onError = ({ message }) => { cleanup(); reject(new Error(message)); };

    function cleanup() {
      s.off("game_joined", onJoined);
      s.off("game_error", onError);
    }

    s.once("game_joined", onJoined);
    s.once("game_error", onError);
    s.emit("join_game", { code });
  });
}

/**
 * Отправляет выбор роли в комнате.
 * Ответ придёт через событие room_roles.
 * @param {string} gameId
 * @param {"killer"|"detective"} role
 */
export function apiPickRole(gameId, role) {
  getSocket().emit("pick_role", { gameId, role });
}

/**
 * Входит в лобби комнаты (без роли). Сокет получает room_roles и сможет
 * участвовать в broadcast state_update. Нужно вызывать при загрузке map.html
 * с gameId до выбора роли.
 * @param {string} gameId
 */
export function apiJoinLobby(gameId) {
  getSocket().emit("join_lobby", { gameId });
}

/**
 * Восстанавливает подключение к существующей партии после reload страницы.
 * @param {string} gameId
 * @param {string} role
 */
export function apiJoinRoom(gameId, role) {
  getSocket().emit("join_room", { gameId, role });
}

/**
 * Отправляет ход на сервер.
 * @param {string} gameId
 * @param {Object} payload
 * @param {string} role
 */
export function apiMove(gameId, payload, role) {
  getSocket().emit("make_move", { gameId, payload, role });
}

/**
 * Подписывается на обновления состояния партии.
 * @param {(data: { state: Object, gameOver: boolean, winner: string|null }) => void} callback
 */
export function onStateUpdate(callback) {
  getSocket().on("state_update", callback);
}

/**
 * Отписывается от обновлений состояния.
 * @param {Function} callback
 */
export function offStateUpdate(callback) {
  getSocket().off("state_update", callback);
}

/**
 * Подписывается на обновления занятости ролей в комнате.
 * @param {(data: { killer: boolean, detective: boolean }) => void} callback
 */
export function onRoomRoles(callback) {
  getSocket().on("room_roles", callback);
}

/**
 * Отписывается от обновлений ролей.
 * @param {Function} callback
 */
export function offRoomRoles(callback) {
  getSocket().off("room_roles", callback);
}

/**
 * Подписывается на серверные ошибки.
 * @param {(data: { message: string }) => void} callback
 */
export function onGameError(callback) {
  getSocket().on("game_error", callback);
}

/**
 * Подписывается на уведомление о подключении второго игрока.
 * @param {(data: {}) => void} callback
 */
export function onPlayerJoined(callback) {
  getSocket().on("player_joined", callback);
}
