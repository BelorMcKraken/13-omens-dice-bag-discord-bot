"use strict";
const { RoomError } = require("./room-manager.js");
const {handlePerk, EVENTS:PERK_EVENTS}=require("./perk-manager");
const { EVENTS } = require("./check-manager.js");

function registerSocketHandlers(io, manager) {
  const broadcast = (room) => io.to(room.code).emit("room:state", manager.snapshot(room));
  io.on("connection", (socket) => {
    function handle(event, fn) {
      socket.on(event, (payload, ack) => {
        if (typeof ack !== "function") return;
        try { ack({ ok: true, ...fn(payload) }); }
        catch (error) {
          ack({ ok: false, error: { code: error instanceof RoomError ? error.code : "INVALID_PAYLOAD", message: error instanceof RoomError ? error.message : "Invalid request." } });
          // Recover from a stale Host edit without applying it or retrying it implicitly.
          if (error.code === "STALE_STATE") {
            const { room } = manager.authorize(socket.id, false);
            socket.emit("room:state", manager.snapshot(room));
          }
        }
      });
    }
    for (const [event, method] of [["room:create", "create"], ["room:join", "join"], ["room:reconnect", "reconnect"]]) {
      handle(event, (payload) => {
        const result = manager[method](socket.id, payload);
        if (result.replacedSocketId) {
          const old = io.sockets.sockets.get(result.replacedSocketId);
          if (old) { old.emit("session:replaced"); old.disconnect(true); }
        }
        socket.join(result.room.code);
        broadcast(result.room);
        return { session: result.session, room: manager.snapshot(result.room) };
      });
    }
    for (const [event, method] of [["game:action", "action"], ["game:check-state", "checkState"], ["player:assign-character", "assign"]]) {
      handle(event, (payload) => {
        const room = manager[method](socket.id, payload);
        broadcast(room);
        return { room: manager.snapshot(room) };
      });
    }
    for (const event of PERK_EVENTS) handle(event,payload=>{const room=handlePerk(manager,socket.id,event,payload);broadcast(room);return {room:manager.snapshot(room)};});
    for (const event of EVENTS) {
      handle(event, (payload) => {
        const room = manager.checks.handle(socket.id, event, payload);
        broadcast(room);
        return { room: manager.snapshot(room) };
      });
    }
    for (const event of ["check:set-dice", "check:set-result", "check:set-total", "check:set-wounds", "check:replace-pending-check"]) {
      handle(event, () => {
        manager.authorize(socket.id, false);
        throw new RoomError("SERVER_AUTHORITATIVE", "Clients may request Check actions, never submit outcomes.");
      });
    }
    handle("room:sync", (payload) => {
      if (payload !== null && (typeof payload !== "object" || Object.keys(payload).length)) throw new RoomError("INVALID_PAYLOAD", "Invalid sync request.");
      return { room: manager.snapshot(manager.authorize(socket.id, false).room) };
    });
    handle("room:leave", () => {
      const room = manager.disconnect(socket.id);
      if (room) { socket.leave(room.code); broadcast(room); }
      return {};
    });
    socket.on("disconnect", () => {
      const room = manager.disconnect(socket.id);
      if (room) broadcast(room);
    });
  });
}
module.exports = { registerSocketHandlers };
