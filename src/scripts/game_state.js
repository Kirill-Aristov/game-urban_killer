/**
 * Глобальное состояние приложения.
 * Мутабельные ссылки, используемые модулями.
 */

export const gameState = {
  state: null,
  myRole: null,
  allCharacters: null,
  allDistricts: null,
  allBuildings: null,
  allMotives: null,
  allScenarios: null,
  allSocialGroups: null,
  broadcast: null,
  intimidatedCount: 0,
  resetPendingRole: null,
};
