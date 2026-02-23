/**
 * BroadcastChannel-синхронизация состояния игры между вкладками одного браузера.
 * Работает без сервера: подходит для игры в разных вкладках/окнах на одной машине.
 */

/**
 * Создаёт объект синхронизации через BroadcastChannel.
 * Канал именуется "game:<gameId>", чтобы вкладки одной партии получали только свои сообщения.
 *
 * @param {string} gameId
 * @returns {{ send: (state: Object) => void, onMessage: (cb: (state: Object) => void) => void, destroy: () => void }}
 */
export function createBroadcast(gameId) {
  if (!gameId || typeof BroadcastChannel === "undefined") {
    return { send: () => {}, onMessage: () => {}, destroy: () => {} };
  }

  const channel = new BroadcastChannel("game:" + gameId);
  let messageCallback = null;

  channel.addEventListener("message", (event) => {
    if (!event.data || !messageCallback) return;
    if (event.data.type === "state") {
      messageCallback(event.data.state);
    } else {
      // Служебные сообщения (roleChosen и др.) передаём как есть
      messageCallback(event.data);
    }
  });

  return {
    /**
     * Публикует новое состояние всем другим вкладкам этой партии.
     * @param {Object} state
     */
    send(state) {
      try {
        channel.postMessage({ type: "state", state });
      } catch (e) {
        console.warn("BroadcastChannel send error:", e);
      }
    },

    /**
     * Подписывается на входящие обновления состояния от других вкладок.
     * @param {(state: Object) => void} callback
     */
    onMessage(callback) {
      messageCallback = callback;
    },

    /**
     * Закрывает канал и освобождает ресурсы.
     */
    destroy() {
      channel.close();
      messageCallback = null;
    },
  };
}
