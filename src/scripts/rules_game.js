/**
 * Правила режима «Логика». Чистые функции, не обращаются к DOM.
 * Все функции принимают объект state в формате game_state_example.json.
 */

// Порядок районов в сетке 4×4 (строки слева направо, сверху вниз)
export const DISTRICT_ORDER = [
  "roki-hill",        // 0,0
  "port",             // 0,1
  "little-italy",     // 0,2
  "golden-beach",     // 0,3
  "west-side",        // 1,0
  "business-center",  // 1,1
  "president-square", // 1,2
  "east-side",        // 1,3
  "chinatown",        // 2,0
  "central-park",     // 2,1
  "santa-cruz",       // 2,2
  "river-station",    // 2,3
  "stadium",          // 3,0
  "richmond",         // 3,1
  "university",       // 3,2
  "old-town",         // 3,3
];

const COLS = 4;

/**
 * Позиция района в сетке.
 * @param {string} areaId
 * @returns {{ row: number, col: number } | null}
 */
export function getRowCol(areaId) {
  const idx = DISTRICT_ORDER.indexOf(areaId);
  if (idx === -1) return null;
  return { row: Math.floor(idx / COLS), col: idx % COLS };
}

/**
 * Ортогональные соседи района (вверх, вниз, влево, вправо).
 * Используется для перемещения жителей, срочного вызова, движения детектива.
 * @param {string} areaId
 * @returns {string[]}
 */
export function getOrthogonalNeighbors(areaId) {
  const pos = getRowCol(areaId);
  if (!pos) return [];
  const { row, col } = pos;
  const neighbors = [];
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < COLS && c >= 0 && c < COLS) {
      neighbors.push(DISTRICT_ORDER[r * COLS + c]);
    }
  }
  return neighbors;
}

/**
 * Все соседи района (8 направлений, включая диагонали).
 * Используется для мотива «Вигилант»: убийца не может убивать в этих кварталах.
 * @param {string} areaId
 * @returns {string[]}
 */
export function getSurroundingNeighbors(areaId) {
  const pos = getRowCol(areaId);
  if (!pos) return [];
  const { row, col } = pos;
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < COLS && c >= 0 && c < COLS) {
        neighbors.push(DISTRICT_ORDER[r * COLS + c]);
      }
    }
  }
  return neighbors;
}

/**
 * Находит запись персонажа на доске.
 * @param {Object} state
 * @param {string} characterId
 * @returns {{ areaId: string, slotIndex: number, characterId: string, intimidated: boolean } | null}
 */
export function getBoardEntry(state, characterId) {
  return state.board.find((e) => e.characterId === characterId) || null;
}

/**
 * Возвращает всех жителей в данном квартале.
 * @param {Object} state
 * @param {string} areaId
 * @returns {Array}
 */
export function getResidentsInArea(state, areaId) {
  return state.board.filter((e) => e.areaId === areaId);
}

/**
 * Проверяет, есть ли здание в квартале.
 * @param {Object} state
 * @param {string} areaId
 * @returns {boolean}
 */
export function hasBuildingInArea(state, areaId) {
  return state.buildings.some((b) => b.areaId === areaId);
}

/**
 * Возвращает тип здания в квартале или null.
 * @param {Object} state
 * @param {string} areaId
 * @returns {string | null}
 */
export function getBuildingType(state, areaId) {
  const b = state.buildings.find((b) => b.areaId === areaId);
  return b ? b.type : null;
}

/**
 * Проверяет, является ли квартал местом преступления.
 * @param {Object} state
 * @param {string} areaId
 * @returns {boolean}
 */
export function isCrimeScene(state, areaId) {
  return state.victims.some((v) => v.areaId === areaId);
}

/**
 * Проверяет допустимость запугивания персонажа:
 * нельзя запугивать жителей в квартале детектива.
 * @param {Object} state
 * @param {string} characterId
 * @returns {boolean}
 */
export function canIntimidate(state, characterId) {
  const entry = getBoardEntry(state, characterId);
  if (!entry) return false;
  return entry.areaId !== state.detectivePosition.areaId;
}

/**
 * Проверяет соответствие кандидата конкретному мотиву убийцы.
 * @param {string} motiveId
 * @param {Object} state
 * @param {string} characterId — id кандидата на убийство
 * @param {Object[]} allCharacters — полный массив персонажей из characters.json
 * @returns {boolean}
 */
export function checkMotive(motiveId, state, characterId, allCharacters) {
  const entry = getBoardEntry(state, characterId);
  if (!entry) return false;
  const char = allCharacters.find((c) => c.id === characterId);
  if (!char) return false;

  const getChar = (id) => allCharacters.find((c) => c.id === id);
  const victimChars = state.victims.map((v) => getChar(v.characterId)).filter(Boolean);

  switch (motiveId) {
    case "maniac": {
      // Все жертвы одного пола
      if (victimChars.length === 0) return true;
      const gender = victimChars[0].gender;
      return victimChars.every((c) => c.gender === gender) && char.gender === gender;
    }
    case "hitman": {
      // В квартале кандидата ровно 1 житель
      return getResidentsInArea(state, entry.areaId).length === 1;
    }
    case "sadist": {
      // Кандидат не запуган
      return !entry.intimidated;
    }
    case "vigilante": {
      // Квартал кандидата не входит в 8 соседей детектива
      const forbidden = getSurroundingNeighbors(state.detectivePosition.areaId);
      return !forbidden.includes(entry.areaId);
    }
    case "psychopath": {
      // Среди жертв и кандидата не более 2 различных возрастов
      const ages = new Set(victimChars.map((c) => c.age));
      ages.add(char.age);
      return ages.size <= 2;
    }
    case "spy": {
      // Квартал кандидата содержит здание
      return hasBuildingInArea(state, entry.areaId);
    }
    default:
      return true;
  }
}

/**
 * Проверяет, может ли убийца убить данного персонажа:
 * - персонаж на доске,
 * - не в квартале детектива,
 * - не сам убийца,
 * - соответствует мотиву.
 * @param {Object} state
 * @param {string} characterId
 * @param {Object[]} allCharacters
 * @returns {boolean}
 */
export function canKill(state, characterId, allCharacters) {
  const entry = getBoardEntry(state, characterId);
  if (!entry) return false;
  if (entry.areaId === state.detectivePosition.areaId) return false;
  if (characterId === state.secret.killerCharacterId) return false;
  return checkMotive(state.secret.motiveId, state, characterId, allCharacters);
}

/**
 * Проверяет, можно ли переместить жителя в данный квартал:
 * - не место преступления,
 * - в квартале менее 3 жителей (после добавления будет ≤ 3).
 * @param {Object} state
 * @param {string} toAreaId
 * @returns {boolean}
 */
export function canMoveTo(state, toAreaId) {
  if (isCrimeScene(state, toAreaId)) return false;
  const residents = getResidentsInArea(state, toAreaId);
  return residents.length < 3;
}

/**
 * Проверяет завершённость убийств (5 жертв).
 * @param {Object} state
 * @returns {boolean}
 */
export function isMurderComplete(state) {
  return state.victims.length >= 5;
}

/**
 * Определяет победителя по заявлению детектива.
 * @param {Object} state — должен содержать state.secret
 * @param {string} guessedKillerCharId
 * @param {string} guessedMotiveId
 * @returns {"detective" | "killer"}
 */
export function checkVictory(state, guessedKillerCharId, guessedMotiveId) {
  const correctKiller = state.secret.killerCharacterId === guessedKillerCharId;
  const correctMotive = state.secret.motiveId === guessedMotiveId;
  return correctKiller && correctMotive ? "detective" : "killer";
}

/**
 * Честный ответ на вопрос слежки:
 * «Убийца мог бы убить этого жителя прямо сейчас (по правилам мотива)?»
 * Не учитывает союзника/фигуранта — слежка всегда честная.
 * @param {Object} state
 * @param {string} characterId — наблюдаемый житель
 * @param {Object[]} allCharacters
 * @returns {boolean}
 */
export function getSurveillanceAnswer(state, characterId, allCharacters) {
  return canKill(state, characterId, allCharacters);
}

/**
 * Честный ответ на вопрос допроса по атрибуту.
 * Убийца может солгать, если житель — сам убийца, фигурант или союзник по соцгруппе.
 * Возвращает true если убийца обязан отвечать честно.
 * @param {Object} state
 * @param {string} characterId — допрашиваемый
 * @param {Object[]} allCharacters
 * @returns {boolean} — true = честный ответ обязателен
 */
export function mustAnswerHonestly(state, characterId, allCharacters) {
  if (characterId === state.secret.killerCharacterId) return false;
  if (characterId === state.secret.figurantCharacterId) return false;
  const char = allCharacters.find((c) => c.id === characterId);
  if (char && char.social_group === state.secret.allySocialGroup) return false;
  return true;
}
