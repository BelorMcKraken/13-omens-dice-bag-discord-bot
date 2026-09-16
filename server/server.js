"use strict";
const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { RoomManager } = require("./room-manager.js");
const { registerSocketHandlers } = require("./socket-handlers.js");

function createServer({ log = console.log, rng } = {}) {
  const app = express();
  app.disable("x-powered-by");
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 512 * 1024 });
  const manager = new RoomManager({ log, rng });
  registerSocketHandlers(io, manager);
  const root = path.resolve(__dirname, "..");
  // Serve only public client files. Never expose server code, tests, or dependencies.
  app.get(["/", "/index.html"], (_, res) => res.sendFile(path.join(root, "index.html")));
  app.use("/js", express.static(path.join(root, "js")));
  app.use("/css", express.static(path.join(root, "css")));
  app.get("/health", (_, res) => res.json({ ok: true, mode: "multiplayer-pass-4" }));
  return { app, server, io, manager };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  const { server } = createServer();
  server.listen(port, "0.0.0.0", () => console.log(`13 Omens development server: http://localhost:${port} (LAN enabled; rooms are in memory)`));
  server.on("error", (error) => { console.error(`Server could not start: ${error.code}`); process.exitCode = 1; });
}
module.exports = { createServer };
