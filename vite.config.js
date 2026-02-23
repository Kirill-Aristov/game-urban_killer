import { defineConfig } from "vite";
import { cpSync } from "fs";

export default defineConfig({
  plugins: [
    {
      // Копирует папку data/ в dist/data/ после сборки,
      // чтобы fetch('/data/...') работал в production и npm run preview.
      name: "copy-data-dir",
      apply: "build",
      closeBundle() {
        cpSync("data", "dist/data", { recursive: true });
      },
    },
  ],
  server: {
    proxy: {
      // REST healthcheck (опционально)
      "/api": "http://localhost:3000",
      // Socket.IO — обязателен ws: true для WebSocket-апгрейда
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});
