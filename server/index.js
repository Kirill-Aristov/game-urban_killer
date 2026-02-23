/**
 * Socket.IO сервер для мультиплеерного режима.
 *
 * События (клиент → сервер):
 *   create_game  { playerName }               → game_created { gameId, code }
 *   join_game    { code }                     → game_joined  { gameId }
 *   join_lobby   { gameId }                   → room_roles   (вход в комнату без роли)
 *   pick_role    { gameId, role }             → room_roles   { killer, detective }
 *                                               → state_update { state } (когда обе роли заняты)
 *   join_room    { gameId, role }             → state_update { state }   (reconnect)
 *   make_move    { gameId, payload, role }    → state_update { state, gameOver, winner }
 *
 * События (сервер → клиент):
 *   game_created   { gameId, code }
 *   game_joined    { gameId }
 *   room_roles     { killer: bool, detective: bool }
 *   state_update   { state, gameOver, winner }
 *   game_error     { message }
 */

import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { buildSetupState } from "../src/scripts/initialization_game.js";
import { applyMove } from "./game_engine.js";
import {
  createGame,
  getGame,
  findByCode,
  updateState,
  pickRole,
  getRolesPicked,
  cancelScheduledDelete,
  scheduleDeleteIfEmpty,
} from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../src/data");

let characters;
try {
  characters = JSON.parse(readFileSync(join(DATA_DIR, "characters.json"), "utf8"));
} catch {
  characters = JSON.parse(readFileSync(join(DATA_DIR, "citizens.json"), "utf8"));
}
const districts    = JSON.parse(readFileSync(join(DATA_DIR, "districts.json"),     "utf8"));
const motives      = JSON.parse(readFileSync(join(DATA_DIR, "motives.json"),       "utf8"));
const socialGroups = JSON.parse(readFileSync(join(DATA_DIR, "social_group.json"),  "utf8"));
const buildings    = JSON.parse(readFileSync(join(DATA_DIR, "building.json"),      "utf8"));
const scenarios    = JSON.parse(readFileSync(join(DATA_DIR, "scenarios.json"),    "utf8"));

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.get("/health", (_req, res) => res.json({ ok: true, games: 0 }));

/**
 * Формирует копию состояния для конкретной роли.
 * В фазе setup детектив не видит setupPool (секретные данные убийцы).
 */
function stateFor(rawState, role) {
  const s = JSON.parse(JSON.stringify(rawState));
  if (role !== "killer") {
    delete s.secret;
    delete s._intimidatedCount;
    if (s.phase === "setup" || s.phase === "setup_detective") {
      delete s.setupPool;
    }
  }
  // Убийца не видит распределение жителей и зданий во время настройки детектива
  if (role === "killer" && s.phase === "setup_detective") {
    s.board = [];
    s.buildings = [];
  }
  return s;
}

/**
 * Рассылает обновлённое состояние всем сокетам в комнате gameId.
 */
async function broadcastState(gameId, rawState, extra = {}) {
  const sockets = await io.in(gameId).fetchSockets();
  for (const s of sockets) {
    s.emit("state_update", {
      state: stateFor(rawState, s.data.role),
      gameOver: extra.gameOver || false,
      winner: extra.winner || null,
    });
  }
}

io.on("connection", (socket) => {
  console.log("[connect]", socket.id);

  // ── Создать партию ────────────────────────────────────────────────────────
  socket.on("create_game", ({ playerName } = {}) => {
    const gameId = crypto.randomUUID();
    const code   = Math.random().toString(36).slice(2, 7).toUpperCase();

    // Начальное состояние — фаза setup (роли ещё не выбраны)
    const state = buildSetupState(characters, socialGroups, { gameId, code });
    createGame(gameId, code, state);

    socket.join(gameId);
    socket.data.gameId = gameId;

    socket.emit("game_created", { gameId, code });
    console.log(`[create_game] gameId=${gameId} code=${code}`);
  });

  // ── Подключиться по коду ─────────────────────────────────────────────────
  socket.on("join_game", ({ code } = {}) => {
    if (!code) {
      socket.emit("game_error", { message: "code required" });
      return;
    }

    const found = findByCode(code.trim().toUpperCase());
    if (!found) {
      socket.emit("game_error", { message: "game not found" });
      return;
    }

    const { gameId } = found;
    cancelScheduledDelete(gameId);
    socket.join(gameId);
    socket.data.gameId = gameId;

    socket.emit("game_joined", { gameId });
    socket.to(gameId).emit("player_joined", {});
    console.log(`[join_game] code=${code} gameId=${gameId}`);
  });

  // ── Войти в лобби (без роли) — для участия в room_roles/state_update ─────
  socket.on("join_lobby", ({ gameId } = {}) => {
    const game = getGame(gameId);
    if (!game) {
      socket.emit("game_error", { message: "game not found" });
      return;
    }

    cancelScheduledDelete(gameId);
    socket.join(gameId);
    socket.data.gameId = gameId;

    const roles = getRolesPicked(gameId);
    socket.emit("room_roles", roles);
    console.log(`[join_lobby] gameId=${gameId}`);
  });

  // ── Выбор роли ───────────────────────────────────────────────────────────
  socket.on("pick_role", async ({ gameId, role } = {}) => {
    const game = getGame(gameId);
    if (!game) {
      socket.emit("game_error", { message: "game not found" });
      return;
    }
    if (role !== "killer" && role !== "detective") {
      socket.emit("game_error", { message: "invalid role" });
      return;
    }

    const ok = pickRole(gameId, role, socket.id);
    if (!ok) {
      socket.emit("game_error", { message: "role already taken" });
      socket.emit("room_roles", getRolesPicked(gameId));
      return;
    }

    socket.data.role = role;

    const roles = getRolesPicked(gameId);
    io.in(gameId).emit("room_roles", roles);
    console.log(`[pick_role] gameId=${gameId} role=${role}`);

    if (roles.killer && roles.detective) {
      game.state.phase = "scenario_choice";
      game.state.scenarioChosen = false;
      await broadcastState(gameId, game.state);
      console.log(`[scenario_choice] gameId=${gameId}`);
    }
  });

  // ── Повторное подключение (reload страницы) ───────────────────────────────
  socket.on("join_room", ({ gameId, role } = {}) => {
    const game = getGame(gameId);
    if (!game) {
      socket.emit("game_error", { message: "game not found" });
      return;
    }

    cancelScheduledDelete(gameId);
    socket.join(gameId);
    socket.data.gameId = gameId;
    socket.data.role   = role;

    socket.emit("state_update", {
      state: stateFor(game.state, role),
      gameOver: false,
      winner: null,
    });

    // Синхронизировать состояние ролей (для UI модала)
    const roles = getRolesPicked(gameId);
    socket.emit("room_roles", roles);

    console.log(`[join_room] gameId=${gameId} role=${role}`);
  });

  // ── Применить ход ─────────────────────────────────────────────────────────
  socket.on("make_move", ({ gameId, payload, role } = {}) => {
    const game = getGame(gameId);
    if (!game) {
      socket.emit("game_error", { message: "game not found" });
      return;
    }

    if (game.state.phase === "scenario_choice") {
      const isPickScenario = payload?.action === "pick_scenario";
      if (!isPickScenario) {
        socket.emit("game_error", { message: "pick scenario first" });
        return;
      }
    } else if (game.state.phase === "setup") {
      if (role !== "killer") {
        socket.emit("game_error", { message: "only killer acts during setup" });
        return;
      }
    } else if (game.state.phase === "setup_detective") {
      if (role !== "detective") {
        socket.emit("game_error", { message: "only detective acts during setup" });
        return;
      }
    } else if (game.state.currentPlayerRole !== role) {
      socket.emit("game_error", { message: "not your turn" });
      return;
    }

    const { state: newState, error, gameOver, winner } = applyMove(
      game.state,
      payload,
      characters,
      districts,
      motives,
      buildings,
      scenarios
    );

    if (error) {
      socket.emit("game_error", { message: error });
      return;
    }

    updateState(gameId, newState);
    broadcastState(gameId, newState, { gameOver, winner });
    console.log(`[make_move] gameId=${gameId} action=${payload?.action} gameOver=${gameOver}`);
  });

  // ── Отключение ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    console.log("[disconnect]", socket.id, socket.data);
    const { gameId } = socket.data;
    if (gameId) {
      const sockets = await io.in(gameId).fetchSockets();
      if (sockets.length === 0) {
        scheduleDeleteIfEmpty(gameId, 15000);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server → http://localhost:${PORT}`);
});
