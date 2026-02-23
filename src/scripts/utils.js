/**
 * Вспомогательные функции.
 */

export function getGameIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("gameId");
}
