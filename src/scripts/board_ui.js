/**
 * Отрисовка карты и панели состояния.
 */

import { getMapCells, getCellBlocks, getAreaIdFromCell } from "./receiving_data.js";
import {
  canIntimidate,
  canKill,
  canMoveTo,
  getResidentsInArea,
  getOrthogonalNeighbors,
  getBuildingType,
  isCrimeScene,
} from "./rules_game.js";
import { gameState } from "./game_state.js";
import { PHASE_LABELS } from "./constants.js";
import {
  renderSetupPhase,
  submitSetupMove,
  closeSetupOverlay,
  showScenarioChoiceModal,
  closeScenarioChoiceModal,
} from "./setup_ui.js";

/**
 * Обновление DOM по объекту состояния.
 */
export function applyGameState(newState) {
  gameState.state = newState;
  const st = gameState.state;

  if (st.phase === "scenario_choice" && !st.scenarioChosen) {
    showScenarioChoiceModal(
      st.gameId,
      gameState.allScenarios || [],
      applyGameState
    );
    return;
  }

  if (st.phase !== "scenario_choice") {
    closeScenarioChoiceModal();
  }

  if (st.phase === "setup" || st.phase === "setup_detective") {
    renderSetupPhase(st, submitSetupMove);
    if (st.phase === "setup_detective" && gameState.myRole === "detective") {
      renderBoard(true);
    }
    return;
  }

  closeSetupOverlay();

  const roundEl = document.getElementById("current-round");
  if (roundEl) roundEl.textContent = `Раунд ${st.round} из ${st.maxRounds}`;

  const phaseEl = document.getElementById("current-phase");
  if (phaseEl) {
    const key =
      st.phase === "city"
        ? "city"
        : st.phase === "killer"
          ? `killer_${st.killerSubphase}`
          : `detective_${st.detectiveSubphase}`;
    phaseEl.textContent = PHASE_LABELS[key] || st.phase;
  }

  const turnEl = document.getElementById("turn-indicator");
  if (turnEl) {
    const mine = gameState.myRole === st.currentPlayerRole;
    turnEl.textContent = mine ? "Ваш ход" : "Ход соперника";
    turnEl.className = "game-state-panel__turn" + (mine ? " game-state-panel__turn--mine" : "");
  }

  const codeEl = document.getElementById("display-game-code");
  if (codeEl && st.code) codeEl.textContent = `Код: ${st.code}`;

  const roleEl = document.getElementById("my-role-indicator");
  if (roleEl && gameState.myRole) {
    roleEl.textContent = gameState.myRole === "killer" ? "🔪 Убийца" : "🔍 Детектив";
    roleEl.title = gameState.myRole === "killer" ? "Вы играете за Убийцу" : "Вы играете за Детектива";
  }

  document.querySelectorAll(".crimes-slot").forEach((slot) => {
    const idx = parseInt(slot.dataset.crimeIndex, 10);
    const filled = idx < (st.victims?.length ?? 0);
    slot.classList.toggle("crimes-slot--filled", filled);
    slot.style.backgroundImage = filled ? `url(../assets/map/murdered_${idx + 1}.png)` : "";
    slot.style.backgroundSize = filled ? "contain" : "";
    slot.style.backgroundRepeat = filled ? "no-repeat" : "";
    slot.style.backgroundPosition = filled ? "center" : "";
  });

  renderBoard();
}

/**
 * Отрисовывает персонажей на карте.
 * @param {boolean} [setupDetectiveMode] — в режиме setup_detective добавляет классы подтверждённых блоков
 */
export function renderBoard(setupDetectiveMode = false) {
  const st = gameState.state;
  if (!st) return;

  const cells = getMapCells();
  const sub = st.setupDetectiveSubphase;
  const residentsConfirmed = setupDetectiveMode && sub !== "distribute_residents";
  const buildingsConfirmed = setupDetectiveMode && sub === "detective_position";

  cells.forEach((cell) => {
    const areaId = getAreaIdFromCell(cell);
    const district = gameState.allDistricts?.find((d) => d.id === areaId);
    if (district?.img) {
      cell.style.backgroundImage = `url(${district.img})`;
      cell.style.backgroundSize = "cover";
      cell.style.backgroundPosition = "center";
    } else {
      cell.style.backgroundImage = "";
    }

    const residents = (st.board || []).filter((e) => e.areaId === areaId);
    const blocks = getCellBlocks(cell);

    blocks.forEach((block, i) => {
      const entry = residents.find((e) => e.slotIndex === i);
      block.textContent = "";
      block.style.backgroundImage = "";
      const oldImg = block.querySelector("img");
      if (oldImg) oldImg.remove();
      block.classList.remove("block--intimidated", "block--occupied", "block--confirmed");
      if (entry) {
        block.classList.add("block--occupied");
        if (entry.intimidated) block.classList.add("block--intimidated");
        if (residentsConfirmed) block.classList.add("block--confirmed");
        const char = gameState.allCharacters?.find((c) => c.id === entry.characterId);
        const imgSrc = char && (entry.intimidated ? char.img_intimidated : char.img);
        if (imgSrc) {
          const img = document.createElement("img");
          img.src = imgSrc;
          img.alt = char?.profession || "";
          block.appendChild(img);
        } else {
          block.textContent = char ? char.profession[0].toUpperCase() : "?";
        }
        block.title = char ? `${char.profession} (${char.social_group})` : entry.characterId;
      }
    });

    const building = (st.buildings || []).find((b) => b.areaId === areaId);
    cell.dataset.building = building ? building.type : "";
    cell.classList.toggle("map-cell--building-confirmed", !!building && buildingsConfirmed);

    let buildingIcon = cell.querySelector(".map-cell__building-icon");
    if (building) {
      const buildingTemplate = gameState.allBuildings?.find((b) => b.type === building.type);
      if (buildingTemplate?.img) {
        if (!buildingIcon) {
          buildingIcon = document.createElement("div");
          buildingIcon.className = "map-cell__building-icon";
          cell.appendChild(buildingIcon);
        }
        buildingIcon.style.backgroundImage = `url(${buildingTemplate.img})`;
        buildingIcon.hidden = false;
      } else if (buildingIcon) {
        buildingIcon.hidden = true;
      }
    } else if (buildingIcon) {
      buildingIcon.hidden = true;
    }

    const isDetective = st.detectivePosition?.areaId === areaId;
    cell.classList.toggle("map-cell--detective", isDetective);

    const isCrime = st.victims?.some((v) => v.areaId === areaId) ?? false;
    cell.classList.toggle("map-cell--crime", isCrime);

    const hasSurveillance = (st.surveillanceTokens || []).some((t) => t.areaId === areaId);
    cell.classList.toggle("map-cell--surveillance", hasSurveillance);

    const selectable = !setupDetectiveMode && isMyTurn() && isCellSelectable(areaId);
    cell.classList.toggle("map-cell--selectable", selectable);
    cell.classList.toggle("map-cell--disabled", setupDetectiveMode || !selectable);
  });
}

export function isMyTurn() {
  return gameState.state && gameState.myRole && gameState.myRole === gameState.state.currentPlayerRole;
}

export function isCellSelectable(areaId) {
  const st = gameState.state;
  if (!st) return false;
  const residents = getResidentsInArea(st, areaId);

  if (st.phase === "killer") {
    if (st.killerSubphase === "intimidation") {
      return residents.some((e) => !e.intimidated && canIntimidate(st, e.characterId));
    }
    if (st.killerSubphase === "murder") {
      return residents.some((e) => canKill(st, e.characterId, gameState.allCharacters || []));
    }
  }

  if (st.phase === "detective") {
    if (st.detectiveSubphase === "urgent_call") {
      const lastVictim = st.victims[st.victims.length - 1];
      return lastVictim && areaId === lastVictim.areaId;
    }
    if (st.detectiveSubphase === "investigation") {
      return st.detectiveActionsLeft > 0 || st.detectiveMovePointsLeft > 0;
    }
  }

  if (st.phase === "city") {
    return residents.length > 0;
  }

  return false;
}

/**
 * Заполняет модал свидетелей мотивами и соцгруппами с изображениями.
 * Вызывается после загрузки allMotives и allSocialGroups.
 */
export function populateWitnessContent() {
  const motivesContainer = document.getElementById("witness-motives");
  const groupsContainer = document.getElementById("witness-groups");
  if (!motivesContainer || !groupsContainer) return;

  const motives = (gameState.allMotives || []).filter((m) => m.logicMode === true).slice(0, 6);
  const cells = motivesContainer.querySelectorAll(".witness-motive-cell");
  cells.forEach((cell, i) => {
    const m = motives[i];
    cell.style.backgroundImage = m?.img ? `url(${m.img})` : "";
    cell.style.backgroundSize = m?.img ? "contain" : "";
    cell.style.backgroundRepeat = m?.img ? "no-repeat" : "";
    cell.style.backgroundPosition = m?.img ? "center" : "";
  });

  const groups = gameState.allSocialGroups || [];
  const groupMap = Object.fromEntries(groups.map((g) => [g.title?.toLowerCase(), g]));
  groupsContainer.innerHTML = "";
  const groupIds = ["богема", "закон", "иммигранты", "рабочие", "маргиналы", "власть", "медицина", "пресса", "криминал"];
  groupIds.forEach((id) => {
    const g = groupMap[id];
    const span = document.createElement("span");
    span.className = "witness-group";
    span.dataset.group = id;
    if (g?.img) {
      const img = document.createElement("img");
      img.src = g.img;
      img.alt = g.title || id;
      img.className = "witness-group__img";
      span.appendChild(img);
    }
    span.appendChild(document.createTextNode(g?.title || id));
    groupsContainer.appendChild(span);
  });
}

/**
 * Модальное окно «Показания свидетелей».
 */
export function initWitnessModal() {
  const btn = document.getElementById("btn-witness");
  const overlay = document.getElementById("witness-modal");
  const closeBtn = document.getElementById("witness-modal-close");
  if (!btn || !overlay || !closeBtn) return;

  function open() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    closeBtn.focus();
  }
  function close() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });
}
