(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ThirteenOmensNetwork = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const IDENTITY_KEY = "thirteen-omens-multiplayer-identity-v1";
  const CHECK_EVENTS = { drawCheck: "check:draw", rollCheck: "check:roll", rerollCheck: "check:reroll", chooseRoll: "check:select-roll", finishCheck: "check:finish", cancelCheck: "check:cancel", takeWound: "check:take-wound", cheatDeath: "check:cheat-death", valiantSacrifice: "check:valiant-sacrifice" };

  function createClient({ ioFactory, store, storage, onChange = () => {}, url }) {
    let socket, room = null, session = null, status = "idle", error = "", busy = false, intent = null, active = false;
    let connectResolve, connectReject;
    try { session = JSON.parse(storage.getItem(IDENTITY_KEY) || "null"); } catch (_) { /* Corrupt identity is handled by reconnect validation. */ }
    if (session && (typeof session.roomCode !== "string" || typeof session.playerId !== "string" || typeof session.reconnectToken !== "string")) {
      session = null;
      try { storage.removeItem(IDENTITY_KEY); } catch (_) { /* Storage may be unavailable. */ }
    }
    const me = () => room && session && room.players.find((player) => player.id === session.playerId);
    const view = () => ({ room, player: me(), status, error, busy, canResume: Boolean(session), active });
    const notify = () => onChange(view());

    function request(event, payload) {
      if (!socket || !socket.connected) return Promise.reject(new Error("Server connection lost. Attempting to reconnect…"));
      return new Promise((resolve, reject) => {
        socket.timeout(5000).emit(event, payload, (timeout, response) => {
          if (timeout) return reject(new Error("Server did not confirm the request. Check the latest room state before trying again."));
          if (!response || !response.ok) {
            const failure = new Error(response?.error?.message || "Unable to complete the request.");
            failure.code = response?.error?.code;
            reject(failure);
          } else resolve(response);
        });
      });
    }

    function receive(snapshot) {
      if (!active || !session || snapshot.code !== session.roomCode || (room && snapshot.revision < room.revision)) return;
      room = snapshot;
      if (store.getMode() !== "multiplayer") store.enterMultiplayer(room.gameState, dispatch);
      else store.receiveSharedState(room.gameState);
      notify();
    }

    function ensureSocket() {
      if (socket) return;
      socket = ioFactory(url, { autoConnect: false, reconnection: true, timeout: 5000 });
      socket.on("room:state", receive);
      socket.on("connect", async () => {
        if (!active) return;
        status = "connecting"; notify();
        try {
          const operation = intent || { event: "room:reconnect", payload: session };
          intent = null;
          const result = await request(operation.event, operation.payload);
          if (!active) return;
          session = result.session;
          error = "";
          try { storage.setItem(IDENTITY_KEY, JSON.stringify(session)); }
          catch (_) { error = "Connected, but this browser could not save your reconnect identity. Keep this page open."; }
          status = "connected";
          room = null;
          receive(result.room);
          connectResolve?.(view()); connectResolve = connectReject = null;
        } catch (failure) {
          if (!active) return;
          error = failure.message;
          status = "disconnected";
          if (["INVALID_SESSION", "ROOM_NOT_FOUND"].includes(failure.code)) { session = null; storage.removeItem(IDENTITY_KEY); }
          // An unacknowledged initial create/join must not be re-emitted automatically.
          socket.disconnect();
          connectReject?.(failure); connectResolve = connectReject = null;
          notify();
        }
      });
      socket.on("disconnect", () => {
        if (active && status !== "replaced" && status !== "disconnected") {
          status = "reconnecting"; error = "Connection lost. Attempting to reconnect…"; notify();
        }
      });
      socket.on("connect_error", () => {
        if (!active) return;
        status = "reconnecting"; error = "Unable to reach server. Attempting to reconnect…";
        connectReject?.(new Error(error)); connectResolve = connectReject = null; notify();
      });
      socket.on("session:replaced", () => {
        status = "replaced"; error = "This identity reconnected in another tab. Return to the main menu here.";
        socket.disconnect(); notify();
      });
    }

    function start(event, payload) {
      if (active) return Promise.reject(new Error("Return to the main menu before opening another room."));
      active = true; status = "connecting"; error = ""; room = null;
      intent = { event, payload };
      ensureSocket(); notify();
      const ready = new Promise((resolve, reject) => { connectResolve = resolve; connectReject = reject; });
      socket.connect();
      return ready;
    }

    async function mutate(event, payload) {
      if (status !== "connected" || !active) throw new Error("Server connection lost. Wait for reconnection before changing the game.");
      if (!(event === "game:action" && payload.action === "editCharacter") && (!event.startsWith("perk:") && !event.startsWith("check:") || ["check:create", "check:cancel", "check:takeover"].includes(event)) && me()?.role !== "HOST") throw new Error("Host permission required.");
      if (busy) throw new Error("Wait for the current action to finish.");
      busy = true; error = ""; notify();
      try {
        const response = await request(event, payload);
        receive(response.room);
        return store.getState();
      } catch (failure) {
        error = socket.connected ? failure.message : "Connection lost. Attempting to reconnect…";
        if (socket.connected) {
          try { const latest = await request("room:sync", {}); receive(latest.room); } catch (_) { /* Connection indicator stays visible. */ }
        }
        throw failure;
      } finally { busy = false; notify(); }
    }

    function dispatch(action, args, snapshot) {
      if(action==='advanceScene')return mutate('scene:advance',{baseVersion:room.gameVersion});
      if(action==='activatePerk'||action==='setPerkDisabled') {
        const pending=snapshot.currentCheck&&snapshot.currentCheck.phase!=='RESOLVED';
        const event=action==='setPerkDisabled'?(args[2]?'perk:disable':'perk:restore'):args[2]?'perk:strain-remove':'perk:activate';
        return mutate(event,{baseVersion:room.gameVersion,characterId:args[0],perkId:args[1],...(pending?{checkId:snapshot.currentCheck.id}:{}),...(event==='perk:strain-remove'?{aspectId:args[2]}:{})});
      }
      if (Object.hasOwn(CHECK_EVENTS, action)) {
        if (action !== "chooseRoll" && args.length) return Promise.reject(new Error("Multiplayer Check actions accept no client dice or randomness."));
        return checkAction(CHECK_EVENTS[action], action === "chooseRoll" ? { rollName: args[0] } : {});
      }
      if (status !== "connected" || (me()?.role !== "HOST" && action !== "editCharacter") || busy) return Promise.reject(new Error("Connected Host permission required; wait for any pending action."));
      return mutate("game:action", { action, args, baseVersion: room.gameVersion });
    }

    function checkAction(event, details = {}) {
      const check = room?.gameState.currentCheck;
      if (!check) return Promise.reject(new Error("No Check pending."));
      return mutate(event, { ...details, checkId: check.id, baseVersion: room.gameVersion });
    }

    function leave() {
      active = false;
      socket?.disconnect();
      connectReject?.(new Error("Connection canceled.")); connectResolve = connectReject = null;
      room = null; status = "idle"; error = ""; busy = false;
      store.leaveMultiplayer(); notify();
    }

    return {
      view, leave,
      create: (displayName) => start("room:create", { displayName }),
      join: (roomCode, displayName) => start("room:join", { roomCode, displayName }),
      resume: () => session ? start("room:reconnect", session) : Promise.reject(new Error("No saved multiplayer identity.")),
      assign: (playerId, characterId) => mutate("player:assign-character", { playerId, characterId }),
      callCheck: (configuration) => mutate("check:create", { configuration, baseVersion: room.gameVersion }),
      check: checkAction,
    };
  }
  return { createClient, IDENTITY_KEY };
});
