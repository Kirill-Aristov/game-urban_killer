/**
 * UI фазы настройки: выбор роли, соцгруппа, убийца, фигурант, распределение детектива.
 */

import {
  apiMove,
  apiPickRole,
  onRoomRoles,
  offRoomRoles,
} from "./api.js";
import { gameState } from "./game_state.js";
import { CORNER_DISTRICTS, MY_ROLE_KEY_PREFIX, SETUP_PANEL_BUTTON_IDS } from "./constants.js";
import { getGameIdFromUrl } from "./utils.js";

let detectiveSetupHandlersInitialized = false;
let detectivePanelHandlersInitialized = false;

/**
 * @param {Function} applyGameState — колбэк обновления состояния (из board_ui)
 */
export function initRoleChoiceModal(gameId, applyGameState) {
  const overlay = document.getElementById("role-choice-modal");
  if (!overlay) return;

  const linkOutput = document.getElementById("role-choice-link");
  const copyBtn = overlay.querySelector("#role-choice-copy");
  const roleButtons = overlay.querySelectorAll(".role-choice-btn");

  if (linkOutput) linkOutput.textContent = window.location.href;

  let pendingRole = null;
  let lastRoles = { killer: false, detective: false };

  gameState.resetPendingRole = () => {
    pendingRole = null;
    applyRolesState(lastRoles);
  };

  function applyRolesState(roles) {
    lastRoles = roles;
    roleButtons.forEach((btn) => {
      const role = btn.getAttribute("data-role");
      const taken = roles[role];
      btn.disabled = taken;
      btn.title = taken ? "Роль уже занята" : "";
    });
  }

  function onRolesUpdate(roles) {
    applyRolesState(roles);
    if (!pendingRole) return;
    if (roles[pendingRole]) {
      gameState.myRole = pendingRole;
      sessionStorage.setItem(MY_ROLE_KEY_PREFIX + gameId, pendingRole);
      pendingRole = null;
      gameState.resetPendingRole = null;
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("inert", "");
      offRoomRoles(onRolesUpdate);
    }
  }

  onRoomRoles(onRolesUpdate);

  roleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-role");
      if (btn.disabled) return;
      pendingRole = role;
      roleButtons.forEach((b) => { b.disabled = true; });
      apiPickRole(gameId, role);
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        copyBtn.textContent = "Скопировано";
        setTimeout(() => { copyBtn.textContent = "Копировать"; }, 2000);
      });
    });
  }

  overlay.removeAttribute("inert");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

/**
 * Показывает модал выбора сценария (фаза scenario_choice).
 * @param {string} gameId
 * @param {Object[]} scenarios — массив из scenarios.json
 * @param {Function} applyGameState
 */
export function showScenarioChoiceModal(gameId, scenarios, applyGameState) {
  const overlay = document.getElementById("scenario-choice-modal");
  if (!overlay) return;

  const container = document.getElementById("scenario-choice-buttons");
  if (!container) return;

  const customBtn = container.querySelector('[data-scenario-id=""]');
  const existingScenarioBtns = container.querySelectorAll('.scenario-choice-btn:not([data-scenario-id=""])');
  existingScenarioBtns.forEach((b) => b.remove());

  (scenarios || []).forEach((scenario) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--primary scenario-choice-btn";
    btn.setAttribute("data-scenario-id", scenario.id);
    btn.textContent = scenario.name;
    btn.onclick = () => {
      submitSetupMove({ action: "pick_scenario", scenarioId: scenario.id });
      container.querySelectorAll(".scenario-choice-btn").forEach((b) => { b.disabled = true; });
    };
    container.insertBefore(btn, customBtn);
  });

  if (customBtn) {
    customBtn.disabled = false;
    customBtn.onclick = () => {
      submitSetupMove({ action: "pick_scenario", scenarioId: null });
      container.querySelectorAll(".scenario-choice-btn").forEach((b) => { b.disabled = true; });
    };
  }

  container.querySelectorAll(".scenario-choice-btn").forEach((b) => { b.disabled = false; });

  overlay.removeAttribute("inert");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

/**
 * Закрывает модал выбора сценария.
 */
export function closeScenarioChoiceModal() {
  const overlay = document.getElementById("scenario-choice-modal");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("inert", "");
}

/**
 * Выбор роли для локальной игры.
 */
export function showLocalRoleChoice(localGameId, applyGameState, onRolePicked) {
  const overlay = document.getElementById("role-choice-modal");
  if (!overlay) {
    gameState.myRole = "killer";
    if (onRolePicked) onRolePicked("killer");
    return;
  }

  const linkBlock = overlay.querySelector(".role-choice-modal__link-block");
  if (linkBlock) linkBlock.hidden = true;

  const roleButtons = overlay.querySelectorAll(".role-choice-btn");
  roleButtons.forEach((btn) => {
    btn.disabled = false;
    btn.style.display = "";
    btn.onclick = () => {
      const role = btn.getAttribute("data-role");
      gameState.myRole = role;
      sessionStorage.setItem("local_role", role);
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("inert", "");
      gameState.broadcast?.send({ _localGameId: localGameId, _roleChosen: role });
      if (onRolePicked) onRolePicked(role);
    };
  });

  overlay.removeAttribute("inert");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

/**
 * Выбор сценария для локальной игры (после выбора роли).
 * @param {Function} onScenarioPicked — (scenarioId: ScenarioId, scenario: Object|null) => void
 */
export function showLocalScenarioChoice(onScenarioPicked) {
  const overlay = document.getElementById("scenario-choice-modal");
  if (!overlay) {
    onScenarioPicked(null, null);
    return;
  }

  const scenarios = gameState.allScenarios || [];
  const container = document.getElementById("scenario-choice-buttons");
  if (!container) {
    onScenarioPicked(null, null);
    return;
  }

  const customBtn = container.querySelector('[data-scenario-id=""]');
  const existingScenarioBtns = container.querySelectorAll('.scenario-choice-btn:not([data-scenario-id=""])');
  existingScenarioBtns.forEach((b) => b.remove());

  scenarios.forEach((scenario) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--primary scenario-choice-btn";
    btn.setAttribute("data-scenario-id", scenario.id);
    btn.textContent = scenario.name;
    btn.onclick = () => {
      closeScenarioChoiceModal();
      onScenarioPicked(scenario.id, scenario);
    };
    container.insertBefore(btn, customBtn);
  });

  if (customBtn) {
    customBtn.disabled = false;
    customBtn.onclick = () => {
      closeScenarioChoiceModal();
      onScenarioPicked(null, null);
    };
  }

  overlay.removeAttribute("inert");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

export function renderSetupPhase(st, submitSetupMove) {
  const overlay = document.getElementById("setup-overlay");
  if (!overlay) return;

  overlay.removeAttribute("inert");
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");

  const waitingEl = document.getElementById("setup-waiting");
  const waitingDetectiveEl = document.getElementById("setup-waiting-detective");
  const socialSection = document.getElementById("setup-social-group");
  const killerSection = document.getElementById("setup-killer-identity");
  const figurantSection = document.getElementById("setup-figurant");
  const residentsSection = document.getElementById("setup-distribute-residents");
  const buildingsSection = document.getElementById("setup-distribute-buildings");
  const positionSection = document.getElementById("setup-detective-position");

  if (st.phase === "setup_detective") {
    waitingEl.hidden = true;
    socialSection.hidden = true;
    killerSection.hidden = true;
    figurantSection.hidden = true;

    const detPanel = document.getElementById("setup-detective-panel");
    if (detPanel) detPanel.hidden = true;

    if (gameState.myRole !== "detective") {
      waitingDetectiveEl.hidden = false;
      residentsSection.hidden = true;
      buildingsSection.hidden = true;
      positionSection.hidden = true;
      return;
    }

    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("inert", "");

    waitingDetectiveEl.hidden = true;
    residentsSection.hidden = true;
    buildingsSection.hidden = true;
    positionSection.hidden = true;

    if (detPanel) {
      detPanel.hidden = false;
      const sub = st.setupDetectiveSubphase;
      const resSection = document.getElementById("setup-panel-residents");
      const bldSection = document.getElementById("setup-panel-buildings");
      const posSection = document.getElementById("setup-panel-position");
      if (resSection) {
        resSection.hidden = sub !== "distribute_residents";
        resSection.classList.toggle("setup-detective-panel__section--confirmed", sub !== "distribute_residents");
      }
      if (bldSection) {
        bldSection.hidden = sub !== "distribute_buildings";
        bldSection.classList.toggle("setup-detective-panel__section--confirmed", sub === "detective_position");
      }
      if (posSection) posSection.hidden = sub !== "detective_position";

      initDetectivePanelHandlers();
      if (sub === "detective_position") {
        renderDetectivePositionPanelButtons();
      }
    }
    return;
  }

  waitingDetectiveEl.hidden = true;
  residentsSection.hidden = true;
  buildingsSection.hidden = true;
  positionSection.hidden = true;

  if (gameState.myRole !== "killer") {
    waitingEl.hidden = false;
    socialSection.hidden = true;
    killerSection.hidden = true;
    figurantSection.hidden = true;
    return;
  }

  const pool = st.setupPool;
  const sub = st.setupSubphase;

  waitingEl.hidden = true;
  socialSection.hidden = sub !== "social_group";
  killerSection.hidden = sub !== "killer_identity";
  figurantSection.hidden = sub !== "figurant";

  if (sub === "social_group") {
    renderSocialGroupCards(pool.socialGroupOptions, submitSetupMove);
  }
  if (sub === "killer_identity") {
    const summaryEl = document.getElementById("setup-summary-social");
    if (summaryEl && pool.chosenSocialGroup) {
      summaryEl.textContent = `Соцгруппа: ${pool.chosenSocialGroup.title}`;
    }
    renderCharacterCards("setup-killer-cards", pool.characterPool, (charId) => {
      submitSetupMove({ action: "setup_killer_identity", characterId: charId });
    });
  }
  if (sub === "figurant") {
    const summaryEl = document.getElementById("setup-summary-killer");
    if (summaryEl) {
      const killerChar = pool.characterPool.find((c) => c.id === pool.killerCharacterId);
      summaryEl.textContent = killerChar
        ? `Убийца: ${killerChar.profession} (${killerChar.social_group})`
        : "";
    }
    const remaining = pool.characterPool.filter((c) => c.id !== pool.killerCharacterId);
    renderCharacterCards("setup-figurant-cards", remaining, (charId) => {
      submitSetupMove({ action: "setup_figurant", characterId: charId });
    });
  }
}

function initDetectivePanelHandlers() {
  if (detectivePanelHandlersInitialized) return;
  detectivePanelHandlersInitialized = true;

  const bind = (id, action) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => submitSetupMoveWithLock(action);
  };

  bind("btn-panel-residents-random", { action: "setup_distribute_residents_random" });
  bind("btn-panel-residents-confirm", { action: "setup_confirm_residents" });
  bind("btn-panel-buildings-random", { action: "setup_distribute_buildings_random" });
  bind("btn-panel-buildings-confirm", { action: "setup_confirm_buildings" });

  const btnPositionRandom = document.getElementById("btn-panel-position-random");
  if (btnPositionRandom) {
    btnPositionRandom.onclick = () => {
      const corner = CORNER_DISTRICTS[Math.floor(Math.random() * CORNER_DISTRICTS.length)];
      submitSetupMoveWithLock({ action: "setup_detective_position", areaId: corner.id });
    };
  }
}

function renderDetectivePositionPanelButtons() {
  const container = document.getElementById("setup-panel-corner-buttons");
  if (!container) return;
  container.innerHTML = "";

  const corners = gameState.allDistricts?.filter((d) => d.corner) || CORNER_DISTRICTS;
  corners.forEach((d) => {
    const district = typeof d === "object" && d.name ? d : CORNER_DISTRICTS.find((c) => c.id === d.id) || { id: d.id, name: d.id };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--primary";
    btn.textContent = district.name;
    btn.onclick = () => submitSetupMoveWithLock({ action: "setup_detective_position", areaId: district.id });
    container.appendChild(btn);
  });
}

function renderSocialGroupCards(groups, submitSetupMove) {
  const container = document.getElementById("setup-social-cards");
  if (!container) return;
  container.innerHTML = "";

  groups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "setup-card";
    if (group.img) {
      const img = document.createElement("img");
      img.src = group.img;
      img.alt = group.title;
      btn.appendChild(img);
    }
    btn.addEventListener("click", () => submitSetupMove({ action: "setup_social_group", value: group.title }));
    container.appendChild(btn);
  });
}

function renderCharacterCards(containerId, chars, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  chars.forEach((char) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "setup-card";
    if (char.img) {
      const img = document.createElement("img");
      img.src = char.img;
      img.alt = char.profession;
      btn.appendChild(img);
    }
    btn.addEventListener("click", () => onSelect(char.id));
    container.appendChild(btn);
  });
}

export function submitSetupMove(payload) {
  const gameId = getGameIdFromUrl();
  if (gameId && gameState.myRole) {
    apiMove(gameId, payload, gameState.myRole);
  }
}

export function submitSetupMoveWithLock(payload) {
  setSetupButtonsDisabled(true);
  submitSetupMove(payload);
}

export function setSetupButtonsDisabled(disabled) {
  SETUP_PANEL_BUTTON_IDS.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
  document.querySelectorAll("#setup-panel-corner-buttons .btn").forEach((b) => { b.disabled = disabled; });
}

export function closeSetupOverlay() {
  const overlay = document.getElementById("setup-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("inert", "");
}
