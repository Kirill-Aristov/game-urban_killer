/**
 * Загрузка статических данных (персонажи, районы).
 */

import { gameState } from "./game_state.js";

export async function loadCharacters() {
  try {
    const res = await fetch("/data/characters.json");
    gameState.allCharacters = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/citizens.json");
      gameState.allCharacters = await res.json();
    } catch {
      gameState.allCharacters = [];
    }
  }
}

export async function loadDistricts() {
  try {
    const res = await fetch("/data/districts.json");
    gameState.allDistricts = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/districts.json");
      gameState.allDistricts = await res.json();
    } catch {
      gameState.allDistricts = [];
    }
  }
}

export async function loadScenarios() {
  try {
    const res = await fetch("/data/scenarios.json");
    gameState.allScenarios = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/scenarios.json");
      gameState.allScenarios = await res.json();
    } catch {
      gameState.allScenarios = [];
    }
  }
}

export async function loadBuildings() {
  try {
    const res = await fetch("/data/building.json");
    gameState.allBuildings = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/building.json");
      gameState.allBuildings = await res.json();
    } catch {
      gameState.allBuildings = [];
    }
  }
}

export async function loadMotives() {
  try {
    const res = await fetch("/data/motives.json");
    gameState.allMotives = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/motives.json");
      gameState.allMotives = await res.json();
    } catch {
      gameState.allMotives = [];
    }
  }
}

export async function loadSocialGroups() {
  try {
    const res = await fetch("/data/social_group.json");
    gameState.allSocialGroups = await res.json();
  } catch {
    try {
      const res = await fetch("/src/data/social_group.json");
      gameState.allSocialGroups = await res.json();
    } catch {
      gameState.allSocialGroups = [];
    }
  }
}
