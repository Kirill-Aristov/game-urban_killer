/**
 * Локальная игра без сервера (BroadcastChannel).
 */

import { buildInitialState } from "./initialization_game.js";
import { showLocalScenarioChoice } from "./setup_ui.js";
import { createBroadcast } from "./sync.js";
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
} from "./rules_game.js";
import { gameState } from "./game_state.js";
import { showLocalRoleChoice } from "./setup_ui.js";

/**
 * @param {Object} deps
 * @param {Function} deps.applyGameState
 * @param {Function} deps.onVictory
 */
export async function startLocalGame(deps) {
  const { applyGameState, onVictory } = deps;

  try {
    const [chars, districts, motives, groups, scenariosData] = await Promise.all([
      fetch("/data/characters.json")
        .then((r) => r.json())
        .catch(() => fetch("/src/data/citizens.json").then((r) => r.json())),
      fetch("/data/districts.json").then((r) => r.json()),
      fetch("/data/motives.json").then((r) => r.json()),
      fetch("/data/social_group.json").then((r) => r.json()),
      fetch("/data/scenarios.json")
        .then((r) => r.json())
        .catch(() => fetch("/src/data/scenarios.json").then((r) => r.json()))
        .catch(() => []),
    ]);

    gameState.allCharacters = chars;
    gameState.allScenarios = scenariosData;

    const localGameId = "local-" + Date.now().toString(36);
    gameState.broadcast = createBroadcast(localGameId);
    gameState.broadcast.onMessage((msg) => {
      if (msg && msg._roleChosen) {
        if (!sessionStorage.getItem("local_role")) {
          gameState.myRole = msg._roleChosen === "killer" ? "detective" : "killer";
          sessionStorage.setItem("local_role", gameState.myRole);
          const overlay = document.getElementById("role-choice-modal");
          if (overlay) {
            overlay.classList.remove("is-open");
            overlay.setAttribute("aria-hidden", "true");
            overlay.setAttribute("inert", "");
          }
          showLocalScenarioChoice((_scenarioId, scenario) => {
            const state = buildInitialState(chars, districts, motives, groups, {
              scenario: scenario || undefined,
            });
            gameState.state = state;
            applyGameState(state);
            gameState.broadcast?.send(state);
          });
        }
        return;
      }
      if (!gameState.state || (msg.round !== undefined && Math.max(msg.round, gameState.state.round) === msg.round)) {
        applyGameState(msg);
      }
    });

    const savedRole = sessionStorage.getItem("local_role");
    if (savedRole) {
      gameState.myRole = savedRole;
      showLocalScenarioChoice((_scenarioId, scenario) => {
        const state = buildInitialState(chars, districts, motives, groups, {
          scenario: scenario || undefined,
        });
        gameState.state = state;
        applyGameState(state);
        gameState.broadcast?.send(state);
      });
    } else {
      showLocalRoleChoice(localGameId, applyGameState, () => {
        showLocalScenarioChoice((_scenarioId, scenario) => {
          const state = buildInitialState(chars, districts, motives, groups, {
            scenario: scenario || undefined,
          });
          gameState.state = state;
          applyGameState(state);
          gameState.broadcast?.send(state);
        });
      });
    }
  } catch (e) {
    console.error("Ошибка инициализации локальной игры:", e);
  }
}

/**
 * @param {Object} st
 * @param {Object} payload
 * @param {Function} applyGameState
 * @param {Function} onVictory
 */
export function applyLocalMove(st, payload, applyGameState, onVictory) {
  const { action } = payload;

  switch (action) {
    case "intimidate": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canIntimidate(st, payload.characterId)) break;
      entry.intimidated = true;
      gameState.intimidatedCount++;
      if (gameState.intimidatedCount !== 0 && gameState.intimidatedCount !== 1) {
        gameState.intimidatedCount = 0;
        st.killerSubphase = "murder";
      }
      break;
    }

    case "kill": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canKill(st, payload.characterId, gameState.allCharacters || [])) break;

      const crimeIndex = st.victims.length;
      st.victims.push({ characterId: payload.characterId, areaId: entry.areaId, crimeIndex });
      st.board = st.board.filter((e) => e.characterId !== payload.characterId);

      if (isMurderComplete(st)) {
        showGameOverLocal(st, applyGameState, onVictory);
        return;
      }

      st.phase = "detective";
      st.killerSubphase = null;
      st.detectiveSubphase = "urgent_call";
      st.currentPlayerRole = "detective";
      break;
    }

    case "skip": {
      if (st.killerSkipUsed) {
        onVictory("detective", "Убийца пропустил убийство дважды");
        return;
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
      if (!lastVictim) break;
      st.detectivePosition = { areaId: payload.toAreaId };
      const residents = getResidentsInArea(st, payload.toAreaId);
      if (residents.length !== 0) {
        const neighbors = getOrthogonalNeighbors(payload.toAreaId).filter(
          (n) => !isCrimeScene(st, n) && [0, 1, 2].includes(getResidentsInArea(st, n).length)
        );
        residents.forEach((e) => {
          const freeNeighbor = neighbors.find((n) => [0, 1, 2].includes(getResidentsInArea(st, n).length));
          if (freeNeighbor) {
            e.areaId = freeNeighbor;
            e.slotIndex = getResidentsInArea(st, freeNeighbor).length - 1;
          }
        });
      }
      st.detectiveSubphase = "investigation";
      st.detectiveActionsLeft = 2;
      st.detectiveMovePointsLeft = 2;
      break;
    }

    case "move": {
      const neighbors = getOrthogonalNeighbors(st.detectivePosition.areaId);
      if (!neighbors.includes(payload.toAreaId) || st.detectiveMovePointsLeft === 0) break;
      st.detectivePosition = { areaId: payload.toAreaId };
      st.detectiveMovePointsLeft--;
      checkDetectivePhaseEnd(st);
      break;
    }

    case "interrogate": {
      if (st.detectiveActionsLeft === 0) break;
      const char = gameState.allCharacters?.find((c) => c.id === payload.characterId);
      if (!char) break;
      const honest = mustAnswerHonestly(st, payload.characterId, gameState.allCharacters || []);
      const answer = char[payload.question];
      console.info(
        `Допрос [${char.profession}] — ${payload.question}: ${answer}` + (honest ? "" : " (может солгать)")
      );
      st.detectiveActionsLeft--;
      checkDetectivePhaseEnd(st);
      break;
    }

    case "surveillance": {
      if (st.detectiveActionsLeft === 0) break;
      const answer = getSurveillanceAnswer(st, payload.characterId, gameState.allCharacters || []);
      st.surveillanceTokens.push({ areaId: st.detectivePosition.areaId });
      console.info(`Слежка — может убить этого жителя прямо сейчас: ${answer ? "Да" : "Нет"}`);
      st.detectiveActionsLeft--;
      checkDetectivePhaseEnd(st);
      break;
    }

    case "building": {
      if (st.detectiveActionsLeft === 0) break;
      const buildingType = getBuildingType(st, st.detectivePosition.areaId);
      if (!buildingType) break;
      applyBuildingAction(st, buildingType, payload);
      st.detectiveActionsLeft--;
      checkDetectivePhaseEnd(st);
      break;
    }

    case "move_resident": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry) break;
      if (!canMoveTo(st, payload.toAreaId)) break;
      const slotIndex = getResidentsInArea(st, payload.toAreaId).length;
      entry.areaId = payload.toAreaId;
      entry.slotIndex = slotIndex;
      break;
    }

    case "move_character": {
      const entry = getBoardEntry(st, payload.characterId);
      if (!entry || !canMoveTo(st, payload.toAreaId)) break;
      entry.areaId = payload.toAreaId;
      entry.slotIndex = getResidentsInArea(st, payload.toAreaId).length - 1;
      advanceCityPhase(st);
      break;
    }

    default:
      console.warn("Неизвестное действие:", action);
  }

  applyGameState(st);
  gameState.broadcast?.send(st);
}

function applyBuildingAction(st, buildingType, payload) {
  switch (buildingType) {
    case "Полицейский участок":
      st.surveillanceTokens.push({ areaId: st.detectivePosition.areaId });
      console.info("Полицейский участок: взят жетон слежки");
      break;
    case "Закусочная": {
      const char = gameState.allCharacters?.find((c) => c.id === payload.characterId);
      if (!char) break;
      const honest = mustAnswerHonestly(st, payload.characterId, gameState.allCharacters || []);
      const answer = char[payload.question || "gender"];
      console.info(
        `Закусочная — допрос [${char.profession}] ${payload.question || "gender"}: ${answer}` +
        (honest ? "" : " (может солгать)")
      );
      break;
    }
    case "Больница": {
      const entry = getBoardEntry(st, payload.characterId);
      if (entry) {
        entry.intimidated = false;
        console.info("Больница: успокоен запуганный житель");
      }
      break;
    }
    case "Пожарная часть": {
      const group = payload.socialGroup;
      if (!group) break;
      const groupChars = gameState.allCharacters ? gameState.allCharacters.filter((c) => c.social_group === group) : [];
      const groupIds = new Set(groupChars.map((c) => c.id));
      st.board.forEach((e) => {
        if (!groupIds.has(e.characterId)) return;
        const neighbors = getOrthogonalNeighbors(e.areaId).filter(
          (n) => !isCrimeScene(st, n) && [0, 1, 2].includes(getResidentsInArea(st, n).length)
        );
        if (neighbors.length !== 0) {
          const to = neighbors[0];
          e.areaId = to;
          e.slotIndex = getResidentsInArea(st, to).length - 1;
        }
      });
      console.info(`Пожарная часть: перемещена соцгруппа «${group}»`);
      break;
    }
  }
}

function checkDetectivePhaseEnd(st) {
  if (st.detectiveActionsLeft !== 0 || st.detectiveMovePointsLeft !== 0) return;
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
    gameState.myRole = "detective";
  } else {
    st.round++;
    st.phase = "killer";
    st.killerSubphase = "intimidation";
    st.detectiveSubphase = null;
    st.detectiveActionsLeft = 2;
    st.detectiveMovePointsLeft = 2;
    st.currentPlayerRole = "killer";
    gameState.myRole = "killer";
  }
}

function showGameOverLocal(st, applyGameState, onVictory) {
  applyGameState(st);
  const guessedKiller = prompt("Детектив, назовите id убийцы (characterId):");
  const guessedMotive = prompt("Детектив, назовите id мотива:");
  if (guessedKiller && guessedMotive) {
    const winner = checkVictory(st, guessedKiller.trim(), guessedMotive.trim());
    onVictory(winner);
  }
}
