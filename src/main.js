/**
 * Точка входа для страницы карты (map.html).
 * Оркестрирует инициализацию, сетевые/локальные подключения, обработку кликов.
 */

import {
  apiMove,
  apiJoinRoom,
  apiJoinLobby,
  onStateUpdate,
  offStateUpdate,
  onRoomRoles,
  onGameError,
  onPlayerJoined,
} from "./scripts/api.js";
import { killer_move, detective_move, characters_move } from "./scripts/move.js";
import { getMapCells, getAreaIdFromCell } from "./scripts/receiving_data.js";
import { createBroadcast } from "./scripts/sync.js";
import {
  canIntimidate,
  canKill,
  canMoveTo,
  getResidentsInArea,
  getOrthogonalNeighbors,
} from "./scripts/rules_game.js";

import {
  loadCharacters,
  loadDistricts,
  loadScenarios,
  loadBuildings,
  loadMotives,
  loadSocialGroups,
} from "./scripts/data_loader.js";
import { gameState } from "./scripts/game_state.js";
import { MY_ROLE_KEY_PREFIX } from "./scripts/constants.js";
import { getGameIdFromUrl } from "./scripts/utils.js";
import { initRoleChoiceModal, setSetupButtonsDisabled } from "./scripts/setup_ui.js";
import {
  applyGameState,
  initWitnessModal,
  populateWitnessContent,
  isMyTurn,
} from "./scripts/board_ui.js";
import { startLocalGame, applyLocalMove } from "./scripts/local_game.js";

// ── Обработчики ─────────────────────────────────────────────────────────────

function handleServerState({ state: newState, gameOver, winner }) {
  applyGameState(newState);
  if (gameState.broadcast) gameState.broadcast.send(newState);
  if (gameOver) showVictory(winner);
  setSetupButtonsDisabled(false);
}

function handleGameError({ message }) {
  console.warn("[game_error]", message);
  if (message === "role already taken") {
    if (gameState.resetPendingRole) gameState.resetPendingRole();
    alert("Эта роль уже занята. Выберите другую.");
  }
}

function stopConnection() {
  offStateUpdate(handleServerState);
  if (gameState.broadcast) {
    gameState.broadcast.destroy();
    gameState.broadcast = null;
  }
}

function showVictory(winner, reason) {
  const msg =
    winner === "detective"
      ? "Победа Детектива! Убийца раскрыт."
      : "Победа Убийцы! Детектив ошибся.";
  alert(reason ? `${msg}\n${reason}` : msg);
  stopConnection();
}

// ── Инициализация карты ─────────────────────────────────────────────────────

async function initMap() {
  initWitnessModal();
  await Promise.all([
    loadCharacters(),
    loadDistricts(),
    loadScenarios(),
    loadBuildings(),
    loadMotives(),
    loadSocialGroups(),
  ]);
  populateWitnessContent();

  const gameId = getGameIdFromUrl();

  if (gameId) {
    gameState.myRole = sessionStorage.getItem(MY_ROLE_KEY_PREFIX + gameId) || null;
    gameState.broadcast = createBroadcast(gameId);
    gameState.broadcast.onMessage((newState) => {
      if (!gameState.state || newState.round >= gameState.state.round) {
        applyGameState(newState);
      }
    });

    onStateUpdate(handleServerState);
    onGameError(handleGameError);
    onPlayerJoined(() => console.info("[player_joined]"));

    if (gameState.myRole) {
      apiJoinRoom(gameId, gameState.myRole);
    } else {
      apiJoinLobby(gameId);
      initRoleChoiceModal(gameId, applyGameState);
    }
  } else {
    await startLocalGame({
      applyGameState,
      onVictory: showVictory,
    });
  }

  getMapCells().forEach((cell) => {
    cell.addEventListener("click", () => onCellClick(cell));
  });
}

// ── Обработка кликов по ячейкам ─────────────────────────────────────────────

function onCellClick(cellElement) {
  const st = gameState.state;
  if (!st || !isMyTurn()) return;

  const areaId = getAreaIdFromCell(cellElement);
  const residents = getResidentsInArea(st, areaId);

  if (st.phase === "killer") {
    if (st.killerSubphase === "intimidation") {
      const target = residents.find((e) => !e.intimidated && canIntimidate(st, e.characterId));
      if (!target) return;
      submitMove(killer_move("intimidation", target.characterId));
    } else if (st.killerSubphase === "murder") {
      const target = residents.find((e) => canKill(st, e.characterId, gameState.allCharacters || []));
      if (!target) return;
      submitMove(killer_move("murder", target.characterId));
    }
    return;
  }

  if (st.phase === "detective") {
    if (st.detectiveSubphase === "urgent_call") {
      const lastVictim = st.victims[st.victims.length - 1];
      if (!lastVictim || areaId !== lastVictim.areaId) return;
      submitMove(detective_move("urgent_call", { toAreaId: areaId }));
      return;
    }
    if (st.detectiveSubphase === "investigation") {
      if (st.detectiveMovePointsLeft > 0) {
        const neighbors = getOrthogonalNeighbors(st.detectivePosition.areaId);
        if (neighbors.includes(areaId)) {
          submitMove(detective_move("move", { toAreaId: areaId }));
          return;
        }
      }
      if (st.detectiveActionsLeft > 0 && areaId === st.detectivePosition.areaId) {
        const target = residents.find((e) => !e.intimidated);
        if (target) {
          submitMove(detective_move("interrogate", { characterId: target.characterId, question: "gender" }));
        }
      }
      return;
    }
  }

  if (st.phase === "city") {
    if (residents.length > 0) {
      const target = residents[0];
      const neighbors = getOrthogonalNeighbors(areaId);
      const toAreaId = neighbors.find((n) => canMoveTo(st, n));
      if (toAreaId) {
        submitMove(characters_move(target.characterId, areaId, toAreaId));
      }
    }
  }
}

function submitMove(payload) {
  const gameId = getGameIdFromUrl();
  if (gameId && gameState.myRole) {
    apiMove(gameId, payload, gameState.myRole);
  } else {
    applyLocalMove(gameState.state, payload, applyGameState, showVictory);
  }
}

// ── Запуск ───────────────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMap);
} else {
  initMap();
}
