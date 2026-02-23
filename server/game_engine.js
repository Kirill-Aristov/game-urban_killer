/**
 * Серверный движок применения ходов.
 * Повторяет логику applyLocalMove из main.js, но без DOM.
 * Импортирует правила из src/scripts/rules_game.js (ES-модули, Node 18+).
 */

import {
  canIntimidate,
  canKill,
  canMoveTo,
  getBoardEntry,
  getResidentsInArea,
  getOrthogonalNeighbors,
  getBuildingType,
  isCrimeScene,
  isMurderComplete,
  checkVictory,
  getSurveillanceAnswer,
  mustAnswerHonestly,
} from "../src/scripts/rules_game.js";

import {
  buildBoard,
  buildBoardFromScenario,
  distributeBuildingsRandom,
  finalizeGameState,
} from "../src/scripts/initialization_game.js";

/**
 * Применяет ход к состоянию партии и возвращает новое состояние.
 * Не мутирует входной объект — создаёт глубокую копию.
 *
 * @param {Object} state             — текущее состояние
 * @param {Object} payload           — описание хода
 * @param {Object[]} allChars        — массив персонажей из characters.json
 * @param {Object[]} districts        — массив районов из districts.json
 * @param {Object[]} motives         — массив мотивов из motives.json
 * @param {Object[]} buildingTemplates — массив { type, areaId } из building.json
 * @param {Object[]} scenarios — массив сценариев из scenarios.json
 * @returns {{ state: Object, error: string|null, gameOver: boolean, winner: string|null }}
 */
export function applyMove(state, payload, allChars, districts = [], motives = [], buildingTemplates = [], scenarios = []) {
  const st = JSON.parse(JSON.stringify(state));
  const { action } = payload;
  let gameOver = false;
  let winner = null;
  let error = null;

  switch (action) {
    // ── Выбор сценария ────────────────────────────────────────────────────────

    case "pick_scenario": {
      if (st.phase !== "scenario_choice" || st.scenarioChosen) {
        error = "wrongPhase";
        break;
      }
      const { scenarioId } = payload;
      if (scenarioId !== null && scenarioId !== undefined) {
        const scenario = scenarios.find((s) => s.id === scenarioId);
        if (!scenario) {
          error = "invalidScenario";
          break;
        }
        st.scenarioId = scenarioId;
        st.setupPool.motiveOptions = [...(scenario.motiveIds || [])];
      }
      st.scenarioChosen = true;
      st.phase = "setup";
      break;
    }

    // ── Фаза настройки ────────────────────────────────────────────────────────

    case "setup_social_group": {
      if (st.phase !== "setup" || st.setupSubphase !== "social_group") {
        error = "wrongPhase";
        break;
      }
      const chosen = st.setupPool.socialGroupOptions.find((g) => g.title === payload.value);
      if (!chosen) { error = "invalidSocialGroup"; break; }
      st.setupPool.chosenSocialGroup = chosen;
      st.setupSubphase = "killer_identity";
      break;
    }

    case "setup_killer_identity": {
      if (st.phase !== "setup" || st.setupSubphase !== "killer_identity") {
        error = "wrongPhase";
        break;
      }
      const char = st.setupPool.characterPool.find((c) => c.id === payload.characterId);
      if (!char) { error = "charNotFound"; break; }
      st.setupPool.killerCharacterId = payload.characterId;
      st.setupSubphase = "figurant";
      break;
    }

    case "setup_figurant": {
      if (st.phase !== "setup" || st.setupSubphase !== "figurant") {
        error = "wrongPhase";
        break;
      }
      if (payload.characterId === st.setupPool.killerCharacterId) {
        error = "sameAsKiller";
        break;
      }
      const char = st.setupPool.characterPool.find((c) => c.id === payload.characterId);
      if (!char) { error = "charNotFound"; break; }
      st.setupPool.figurantCharacterId = payload.characterId;

      st.phase = "setup_detective";
      st.setupSubphase = null;
      st.board = [];
      st.buildings = [];
      st.detectivePosition = { areaId: null };

      if (st.scenarioId && scenarios.length) {
        const scenario = scenarios.find((s) => s.id === st.scenarioId);
        if (scenario) {
          st.board = buildBoardFromScenario(st.setupPool.characterPool, scenario);
          st.buildings = scenario.buildings ? JSON.parse(JSON.stringify(scenario.buildings)) : [];
          st.setupDetectiveSubphase = "detective_position";
        } else {
          st.setupDetectiveSubphase = "distribute_residents";
        }
      } else {
        st.setupDetectiveSubphase = "distribute_residents";
      }
      break;
    }

    case "setup_distribute_residents_random": {
      if (st.phase !== "setup_detective" || st.setupDetectiveSubphase !== "distribute_residents") {
        error = "wrongPhase";
        break;
      }
      st.board = buildBoard(st.setupPool.characterPool, districts);
      break;
    }

    case "setup_confirm_residents": {
      if (st.phase !== "setup_detective" || st.setupDetectiveSubphase !== "distribute_residents") {
        error = "wrongPhase";
        break;
      }
      if (st.board.length < 20) {
        error = "distributeResidentsFirst";
        break;
      }
      st.setupDetectiveSubphase = "distribute_buildings";
      break;
    }

    case "setup_distribute_buildings_random": {
      if (st.phase !== "setup_detective" || st.setupDetectiveSubphase !== "distribute_buildings") {
        error = "wrongPhase";
        break;
      }
      st.buildings = distributeBuildingsRandom(buildingTemplates, districts);
      break;
    }

    case "setup_confirm_buildings": {
      if (st.phase !== "setup_detective" || st.setupDetectiveSubphase !== "distribute_buildings") {
        error = "wrongPhase";
        break;
      }
      if (st.buildings.length < 8) {
        error = "distributeBuildingsFirst";
        break;
      }
      st.setupDetectiveSubphase = "detective_position";
      break;
    }

    case "setup_detective_position": {
      if (st.phase !== "setup_detective" || st.setupDetectiveSubphase !== "detective_position") {
        error = "wrongPhase";
        break;
      }
      const corner = districts.find((d) => d.id === payload.areaId && d.corner);
      if (!corner) {
        error = "mustBeCorner";
        break;
      }
      st.detectivePosition = { areaId: payload.areaId };
      finalizeGameState(st, motives);
      break;
    }

    // ── Игровые ходы ──────────────────────────────────────────────────────────

    case "intimidate": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canIntimidate(st, payload.characterId)) {
        error = "cannotIntimidate";
        break;
      }
      entry.intimidated = true;
      st._intimidatedCount = (st._intimidatedCount || 0) + 1;
      if (st._intimidatedCount >= 2) {
        st._intimidatedCount = 0;
        st.killerSubphase = "murder";
      }
      break;
    }

    case "kill": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canKill(st, payload.characterId, allChars)) {
        error = "cannotKill";
        break;
      }
      st.victims.push({
        characterId: payload.characterId,
        areaId: entry.areaId,
        crimeIndex: st.victims.length,
      });
      st.board = st.board.filter((e) => e.characterId !== payload.characterId);

      if (isMurderComplete(st)) {
        gameOver = true;
        break;
      }

      st.phase = "detective";
      st.killerSubphase = null;
      st.detectiveSubphase = "urgent_call";
      st.currentPlayerRole = "detective";
      break;
    }

    case "skip": {
      if (st.killerSkipUsed) {
        gameOver = true;
        winner = "detective";
        break;
      }
      st.killerSkipUsed = true;
      st.phase = "detective";
      st.killerSubphase = null;
      st.detectiveSubphase = "urgent_call";
      st.currentPlayerRole = "detective";
      break;
    }

    case "urgent_call": {
      const lastVictim = st.victims[st.victims.length - 1];
      if (!lastVictim) { error = "noVictim"; break; }
      st.detectivePosition = { areaId: payload.toAreaId };
      const residents = getResidentsInArea(st, payload.toAreaId);
      residents.forEach((e) => {
        const neighbors = getOrthogonalNeighbors(payload.toAreaId).filter(
          (n) => !isCrimeScene(st, n) && getResidentsInArea(st, n).length < 3
        );
        if (neighbors.length > 0) {
          const to = neighbors[0];
          e.areaId = to;
          e.slotIndex = getResidentsInArea(st, to).length - 1;
        }
      });
      st.detectiveSubphase = "investigation";
      st.detectiveActionsLeft = 2;
      st.detectiveMovePointsLeft = 2;
      break;
    }

    case "move": {
      const neighbors = getOrthogonalNeighbors(st.detectivePosition.areaId);
      if (!neighbors.includes(payload.toAreaId) || st.detectiveMovePointsLeft <= 0) {
        error = "cannotMove";
        break;
      }
      st.detectivePosition = { areaId: payload.toAreaId };
      st.detectiveMovePointsLeft--;
      checkDetectiveEnd(st);
      break;
    }

    case "interrogate": {
      if (st.detectiveActionsLeft <= 0) { error = "noActions"; break; }
      const char = allChars.find((c) => c.id === payload.characterId);
      if (!char) { error = "charNotFound"; break; }
      const honest = mustAnswerHonestly(st, payload.characterId, allChars);
      const answerValue = honest ? char[payload.question] : null;
      st._lastAnswer = { type: "interrogate", honest, answer: answerValue, question: payload.question };
      st.detectiveActionsLeft--;
      checkDetectiveEnd(st);
      break;
    }

    case "surveillance": {
      if (st.detectiveActionsLeft <= 0) { error = "noActions"; break; }
      const canKillNow = getSurveillanceAnswer(st, payload.characterId, allChars);
      st.surveillanceTokens.push({ areaId: st.detectivePosition.areaId });
      st._lastAnswer = { type: "surveillance", answer: canKillNow };
      st.detectiveActionsLeft--;
      checkDetectiveEnd(st);
      break;
    }

    case "building": {
      if (st.detectiveActionsLeft <= 0) { error = "noActions"; break; }
      const btype = getBuildingType(st, st.detectivePosition.areaId);
      if (!btype) { error = "noBuilding"; break; }
      applyBuildingEffect(st, btype, payload, allChars);
      st.detectiveActionsLeft--;
      checkDetectiveEnd(st);
      break;
    }

    case "move_resident": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry) { error = "charNotFound"; break; }
      if (!canMoveTo(st, payload.toAreaId)) { error = "cannotMove"; break; }
      entry.areaId = payload.toAreaId;
      entry.slotIndex = getResidentsInArea(st, payload.toAreaId).length;
      break;
    }

    case "move_character": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canMoveTo(st, payload.toAreaId)) { error = "cannotMove"; break; }
      entry.areaId = payload.toAreaId;
      entry.slotIndex = getResidentsInArea(st, payload.toAreaId).length - 1;
      advanceCityPhase(st);
      break;
    }

    case "accuse": {
      const w = checkVictory(st, payload.killerCharacterId, payload.motiveId);
      gameOver = true;
      winner = w;
      break;
    }

    default:
      error = "unknownAction";
  }

  return { state: st, error, gameOver, winner };
}

function checkDetectiveEnd(st) {
  if (st.detectiveActionsLeft > 0 || st.detectiveMovePointsLeft > 0) return;
  startCityPhase(st);
}

function startCityPhase(st) {
  getResidentsInArea(st, st.detectivePosition.areaId).forEach((e) => {
    e.intimidated = false;
  });
  st.phase = "city";
  st.detectiveSubphase = null;
  st.currentPlayerRole = "killer";
}

function advanceCityPhase(st) {
  if (st.currentPlayerRole === "killer") {
    st.currentPlayerRole = "detective";
  } else {
    st.round++;
    if (st.round > st.maxRounds) {
      return;
    }
    st.phase = "killer";
    st.killerSubphase = "intimidation";
    st.detectiveSubphase = null;
    st.detectiveActionsLeft = 2;
    st.detectiveMovePointsLeft = 2;
    st.currentPlayerRole = "killer";
  }
}

function applyBuildingEffect(st, buildingType, payload, allChars) {
  switch (buildingType) {
    case "Полицейский участок":
      st.surveillanceTokens.push({ areaId: st.detectivePosition.areaId });
      st._lastAnswer = { type: "police", info: "Добавлен жетон слежки" };
      break;
    case "Закусочная": {
      const char = allChars.find((c) => c.id === payload.characterId);
      if (!char) break;
      const honest = mustAnswerHonestly(st, payload.characterId, allChars);
      const answer = honest ? char[payload.question || "gender"] : null;
      st._lastAnswer = { type: "diner", honest, answer, question: payload.question || "gender" };
      break;
    }
    case "Больница": {
      const entry = getBoardEntry(st, payload.characterId);
      if (entry) {
        entry.intimidated = false;
        st._lastAnswer = { type: "hospital", characterId: payload.characterId };
      }
      break;
    }
    case "Пожарная часть": {
      const group = payload.socialGroup;
      if (!group) break;
      const groupIds = new Set(allChars.filter((c) => c.social_group === group).map((c) => c.id));
      st.board.forEach((e) => {
        if (!groupIds.has(e.characterId)) return;
        const neighbors = getOrthogonalNeighbors(e.areaId).filter(
          (n) => !isCrimeScene(st, n) && getResidentsInArea(st, n).length < 3
        );
        if (neighbors.length > 0) {
          e.areaId = neighbors[0];
          e.slotIndex = getResidentsInArea(st, neighbors[0]).length - 1;
        }
      });
      st._lastAnswer = { type: "fireStation", socialGroup: group };
      break;
    }
  }
}
