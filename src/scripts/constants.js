/**
 * Константы игры.
 */

export const MY_ROLE_KEY_PREFIX = "role_";

export const PHASE_LABELS = {
  killer_intimidation:     "Фаза убийцы — Запугивание",
  killer_murder:           "Фаза убийцы — Убийство",
  detective_urgent_call:   "Фаза детектива — Срочный вызов",
  detective_investigation: "Фаза детектива — Расследование",
  city:                    "Фаза города",
  setup:                   "Подготовка партии",
};

export const CORNER_DISTRICTS = [
  { id: "roki-hill", name: "Роки Хилл" },
  { id: "golden-beach", name: "Золотой пляж" },
  { id: "stadium", name: "Стадион" },
  { id: "old-town", name: "Старый город" },
];

export const SETUP_PANEL_BUTTON_IDS = [
  "btn-panel-residents-random",
  "btn-panel-residents-confirm",
  "btn-panel-buildings-random",
  "btn-panel-buildings-confirm",
  "btn-panel-position-random",
];
