import { DISTRICT_ORDER } from "./rules_game.js";

/**
 * Перемешивает массив на месте алгоритмом Фишера-Йетса.
 * @param {Array} arr
 * @returns {Array} тот же массив
 */
export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Возвращает n случайных элементов из массива (без изменения оригинала).
 * @param {Array} arr
 * @param {number} n
 * @returns {Array}
 */
export function pickRandom(arr, n) {
  return shuffleArray([...arr]).slice(0, n);
}

/**
 * Генерирует пул для фазы настройки:
 * 20 случайных персонажей и 3 случайные соцгруппы.
 * @param {Object[]} characters — полный массив из characters.json
 * @param {Object[]} socialGroups — массив из social_group.json
 * @returns {{ characterPool: Object[], socialGroupOptions: Object[] }}
 */
export function generateSetupPool(characters, socialGroups) {
  const characterPool = pickRandom(characters, 20);
  const socialGroupOptions = pickRandom(socialGroups, 3);
  return { characterPool, socialGroupOptions };
}

/**
 * Расставляет персонажей из setupPool по доске после завершения выбора убийцы.
 * Углы получают по 2 жителя, остальные по 1 (max 3 per district).
 * Возвращает новый массив board.
 * @param {Object[]} characterPool — 20 персонажей
 * @param {Object[]} districts
 * @returns {Object[]} board entries
 */
export function buildBoard(characterPool, districts) {
  const cornerIds = districts.filter((d) => d.corner).map((d) => d.id);
  const nonCornerIds = districts
    .filter((d) => !d.corner)
    .map((d) => d.id)
    .sort((a, b) => DISTRICT_ORDER.indexOf(a) - DISTRICT_ORDER.indexOf(b));

  const board = [];
  let charIndex = 0;

  for (const areaId of cornerIds) {
    board.push({ areaId, slotIndex: 0, characterId: characterPool[charIndex++].id, intimidated: false });
    board.push({ areaId, slotIndex: 1, characterId: characterPool[charIndex++].id, intimidated: false });
  }

  for (const areaId of nonCornerIds) {
    if (charIndex >= characterPool.length) break;
    board.push({ areaId, slotIndex: 0, characterId: characterPool[charIndex++].id, intimidated: false });
  }

  return board;
}

/**
 * Расставляет персонажей по доске по раскладке сценария.
 * @param {Object[]} characterPool — 20 персонажей
 * @param {Object} scenario — { residentsWithTwo: string[] }
 * @returns {Object[]} board entries
 */
export function buildBoardFromScenario(characterPool, scenario) {
  const twoResidentSet = new Set(scenario.residentsWithTwo || []);
  const twoResidentIds = DISTRICT_ORDER.filter((id) => twoResidentSet.has(id));
  const oneResidentIds = DISTRICT_ORDER.filter((id) => !twoResidentSet.has(id));

  const board = [];
  let charIndex = 0;

  for (const areaId of twoResidentIds) {
    if (charIndex + 1 < characterPool.length) {
      board.push({ areaId, slotIndex: 0, characterId: characterPool[charIndex++].id, intimidated: false });
      board.push({ areaId, slotIndex: 1, characterId: characterPool[charIndex++].id, intimidated: false });
    }
  }

  for (const areaId of oneResidentIds) {
    if (charIndex >= characterPool.length) break;
    board.push({ areaId, slotIndex: 0, characterId: characterPool[charIndex++].id, intimidated: false });
  }

  return board;
}

/**
 * Собирает начальный объект состояния игры для фазы настройки.
 * Возвращает state с phase="setup" и setupPool.
 *
 * @param {Object[]} characters
 * @param {Object[]} socialGroups
 * @param {Object}  [options]
 * @param {string}  [options.gameId]
 * @param {string}  [options.code]
 * @returns {Object}
 */
export function buildSetupState(characters, socialGroups, options = {}) {
  const { characterPool, socialGroupOptions } = generateSetupPool(characters, socialGroups);

  return {
    gameId: options.gameId || null,
    code: options.code || null,
    mode: "logic",
    phase: "setup",
    scenarioId: null,
    scenarioChosen: false,
    setupSubphase: "social_group",
    setupPool: {
      socialGroupOptions,
      characterPool,
      chosenSocialGroup: null,
      killerCharacterId: null,
      figurantCharacterId: null,
    },
    round: 1,
    maxRounds: 6,
    killerSubphase: null,
    detectiveSubphase: null,
    detectiveActionsLeft: 2,
    detectiveMovePointsLeft: 2,
    currentPlayerRole: "killer",
    players: [
      { role: "killer",    connected: true },
      { role: "detective", connected: true },
    ],
    board: [],
    buildings: [
      { type: "Полицейский участок", areaId: "west-side" },
      { type: "Полицейский участок", areaId: "east-side" },
      { type: "Закусочная",          areaId: "port" },
      { type: "Закусочная",          areaId: "richmond" },
      { type: "Больница",            areaId: "little-italy" },
      { type: "Больница",            areaId: "chinatown" },
      { type: "Пожарная часть",      areaId: "river-station" },
      { type: "Пожарная часть",      areaId: "university" },
    ],
    detectivePosition: { areaId: null },
    surveillanceTokens: [],
    victims: [],
    killerSkipUsed: false,
    intimidatedThisTurn: [],
    secret: {
      killerCharacterId: null,
      figurantCharacterId: null,
      motiveId: null,
      allySocialGroup: null,
    },
    scores: { killer: 0, detective: 0 },
  };
}

/**
 * Случайно распределяет 8 зданий по 8 разным районам (max 1 на район).
 * @param {Object[]} buildingTemplates — массив { type, areaId } из building.json (используем type)
 * @param {Object[]} districts
 * @returns {Object[]} [{ type, areaId }]
 */
export function distributeBuildingsRandom(buildingTemplates, districts) {
  const types = buildingTemplates.map((b) => b.type);
  const types8 = [...types, ...types];
  const shuffledTypes = shuffleArray([...types8]);
  const shuffledAreaIds = shuffleArray(districts.map((d) => d.id)).slice(0, 8);
  return shuffledAreaIds.map((areaId, i) => ({
    type: shuffledTypes[i],
    areaId,
  }));
}

/**
 * Финализирует состояние после настройки детектива:
 * выбирает мотив, записывает в secret, переводит в фазу killer.
 * board, buildings, detectivePosition уже заданы детективом.
 *
 * @param {Object} state — state с setupPool (secret данные) и заполненными board, buildings, detectivePosition
 * @param {Object[]} motives
 */
export function finalizeGameState(state, motives) {
  const { killerCharacterId, figurantCharacterId, chosenSocialGroup } = state.setupPool;

  let motivePool = motives.filter((m) => m.logicMode);
  if (state.setupPool?.motiveOptions?.length) {
    const fromScenario = motives.filter((m) => state.setupPool.motiveOptions.includes(m.id));
    if (fromScenario.length) motivePool = fromScenario;
  }
  const motiveId = motivePool[Math.floor(Math.random() * motivePool.length)].id;

  state.secret = {
    killerCharacterId,
    figurantCharacterId,
    motiveId,
    allySocialGroup: chosenSocialGroup,
  };

  state.phase = "killer";
  state.killerSubphase = "intimidation";
  state.setupSubphase = null;
  state.setupDetectiveSubphase = null;
  delete state.setupPool;
}

/**
 * Собирает начальный объект состояния игры для режима «Логика» (legacy / локальная игра).
 * Автоматически генерирует всё без выбора убийцы.
 *
 * @param {Object[]} characters
 * @param {Object[]} districts
 * @param {Object[]} motives
 * @param {Object[]} socialGroups
 * @param {Object}  [options]
 * @returns {Object}
 */
export function buildInitialState(characters, districts, motives, socialGroups, options = {}) {
  const chosen = pickRandom(characters, 20);
  const scenario = options.scenario || null;

  let board;
  let buildings;
  let motiveId;

  if (scenario) {
    board = buildBoardFromScenario(chosen, scenario);
    buildings = scenario.buildings ? JSON.parse(JSON.stringify(scenario.buildings)) : [];
    const motivePool = motives.filter((m) => scenario.motiveIds?.includes(m.id));
    motiveId = motivePool.length
      ? motivePool[Math.floor(Math.random() * motivePool.length)].id
      : motives.filter((m) => m.logicMode)[0]?.id ?? null;
  } else {
    const cornerIds = districts.filter((d) => d.corner).map((d) => d.id);
    const nonCornerIds = districts
      .filter((d) => !d.corner)
      .map((d) => d.id)
      .sort((a, b) => DISTRICT_ORDER.indexOf(a) - DISTRICT_ORDER.indexOf(b));

    board = [];
    let charIndex = 0;
    for (const areaId of cornerIds) {
      board.push({ areaId, slotIndex: 0, characterId: chosen[charIndex++].id, intimidated: false });
      board.push({ areaId, slotIndex: 1, characterId: chosen[charIndex++].id, intimidated: false });
    }
    for (const areaId of nonCornerIds) {
      if (charIndex >= chosen.length) break;
      board.push({ areaId, slotIndex: 0, characterId: chosen[charIndex++].id, intimidated: false });
    }

    buildings = [
      { type: "Полицейский участок", areaId: "west-side" },
      { type: "Полицейский участок", areaId: "east-side" },
      { type: "Закусочная", areaId: "port" },
      { type: "Закусочная", areaId: "richmond" },
      { type: "Больница", areaId: "little-italy" },
      { type: "Больница", areaId: "chinatown" },
      { type: "Пожарная часть", areaId: "river-station" },
      { type: "Пожарная часть", areaId: "university" },
    ];

    const logicMotives = motives.filter((m) => m.logicMode);
    motiveId = logicMotives[Math.floor(Math.random() * logicMotives.length)].id;
  }

  const [killerEntry, figurantEntry] = pickRandom(chosen, 2);
  const killerCharacterId = killerEntry.id;
  const figurantCharacterId = figurantEntry.id;
  const [allySocialGroup] = pickRandom(socialGroups, 3);

  const nonCornerIds = districts
    .filter((d) => !d.corner)
    .map((d) => d.id)
    .sort((a, b) => DISTRICT_ORDER.indexOf(a) - DISTRICT_ORDER.indexOf(b));
  const detectiveStartAreaId =
    options.detectiveStartAreaId ||
    nonCornerIds[Math.floor(Math.random() * nonCornerIds.length)];

  return {
    gameId: options.gameId || null,
    code: options.code || null,
    mode: "logic",
    round: 1,
    maxRounds: 6,
    phase: "killer",
    killerSubphase: "intimidation",
    detectiveSubphase: null,
    detectiveActionsLeft: 2,
    detectiveMovePointsLeft: 2,
    currentPlayerRole: "killer",
    players: [
      { role: "killer",    connected: true },
      { role: "detective", connected: true },
    ],
    board,
    buildings,
    detectivePosition: { areaId: detectiveStartAreaId },
    surveillanceTokens: [],
    victims: [],
    killerSkipUsed: false,
    intimidatedThisTurn: [],
    secret: {
      killerCharacterId,
      figurantCharacterId,
      motiveId,
      allySocialGroup,
    },
    scores: { killer: 0, detective: 0 },
  };
}
