"use strict";

const { randomUUID, randomBytes, randomInt, createHash, timingSafeEqual } = require("node:crypto");
const State = require("../js/state.js");

const { RoomError, fail, object, text, number } = require("./validation.js");
const { CheckManager } = require("./check-manager.js");
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (token) => createHash("sha256").update(token).digest();

// Explicit management operations; Check intents are handled separately.
const MANAGEMENT = {
  importCharacter: args => args.length === 1 && args[0] && typeof args[0] === "object",
  editCharacter: args => args.length === 2 && Boolean(text(args[0], "Character ID")) && Boolean(args[1]) && typeof args[1] === "object",
  setStrain: args => args.length === 3 && Boolean(text(args[0], "Character ID")) && Boolean(text(args[1], "Aspect ID")) && typeof args[2] === "boolean",
  useStrainRelief: args => args.length === 2 && Boolean(text(args[0], "Character ID")) && Boolean(text(args[1], "Aspect ID")),
  setStoryCharacterCount: args => args.length === 1 && Number.isInteger(args[0]) && args[0] >= 1 && args[0] <= 6,
  setAct: (args) => args.length === 1 && ["Prologue", "Act 1", "Act 2", "Act 3"].includes(args[0]),
  addOmenToBag: (args) => args.length === 0,
  removeOmenFromBag: (args) => args.length === 0,
  addCharacter: (args) => args.length === 0,
  removeCharacter: (args) => args.length === 1 && Boolean(text(args[0], "Character ID")),
  selectCharacter: (args) => args.length === 1 && Boolean(text(args[0], "Character ID")),
  renameCharacter: (args) => args.length === 2 && Boolean(text(args[0], "Character ID")) && Boolean(text(args[1], "Character name")),
  setSetting: (args) => args.length === 2 && ["autoApplyStrainFlaw", "lockActDuringPendingCheck", "allowPlayerCharacterEdits"].includes(args[0]) && typeof args[1] === "boolean",
  recordStrain: (args) => args.length === 1 && Boolean(text(args[0], "Aspect")),
  reviveCharacter: (args) => args.length === 0,
  clearLog: (args) => args.length === 0,
  resetGame: (args) => args.length === 0,
  importState: (args) => args.length === 1 && Boolean(args[0]) && typeof args[0] === "object",
  applyManual(args) {
    if (args.length !== 1) return false;
    const values = args[0];
    object(values, ["characterId", "safe", "omen", "host", "wounds", "active", "act", "strain", "cheatDeathUsed"]);
    text(values.characterId, "Character ID");
    for (const [key, max] of [["safe", 99], ["omen", 13], ["host", 13], ["wounds", 6]]) number(values[key], max);
    return [true, false, "true", "false"].includes(values.active) && ["Prologue", "Act 1", "Act 2", "Act 3"].includes(values.act) && typeof values.cheatDeathUsed === "boolean";
  },
};

class RoomManager {
  constructor({ log = () => {}, rng } = {}) {
    this.rooms = new Map();
    this.connections = new Map();
    this.log = log;
    this.checks = new CheckManager(this, rng);
  }

  room(code) {
    const normalized = text(code, "Room code", 32).toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) fail("ROOM_NOT_FOUND", "Room not found. Check the code or ask the Host to create a new room.");
    return room;
  }

  newCode() {
    const words = ["OMEN", "DREAD", "GRANNY", "RAVEN", "ASH", "CRYPT"];
    let code;
    do { code = `${words[randomInt(words.length)]}-${randomInt(1000, 10000)}`; } while (this.rooms.has(code));
    return code;
  }

  activity(room, message) {
    room.activity.push({ time: new Date().toISOString(), text: message });
    room.activity = room.activity.slice(-100);
    room.revision++;
    this.log(`[${room.code}] ${message}`);
  }

  addIdentity(room, socketId, displayName, role) {
    const token = randomBytes(32).toString("hex");
    const player = { id: randomUUID(), displayName, role, connected: true, assignedCharacterId: null, socketId, tokenHash: hash(token) };
    room.players.set(player.id, player);
    this.connections.set(socketId, { code: room.code, playerId: player.id });
    return { player, session: { roomCode: room.code, playerId: player.id, reconnectToken: token } };
  }

  ensureUnbound(socketId) {
    if (this.connections.has(socketId)) fail("ALREADY_JOINED", "Leave the current room before joining another.");
  }

  create(socketId, payload) {
    this.ensureUnbound(socketId);
    object(payload, ["displayName"]);
    const displayName = text(payload.displayName || "Host", "Display name", 60);
    const room = { code: this.newCode(), players: new Map(), hostPlayerId: null, gameState: State.defaultState(), gameVersion: 0, revision: 0, createdAt: new Date().toISOString(), activity: [] };
    const identity = this.addIdentity(room, socketId, displayName, "HOST");
    room.hostPlayerId = identity.player.id;
    this.rooms.set(room.code, room);
    this.activity(room, `${displayName} created the room.`);
    return { room, session: identity.session };
  }

  join(socketId, payload) {
    this.ensureUnbound(socketId);
    object(payload, ["roomCode", "displayName"]);
    const room = this.room(payload.roomCode);
    const displayName = text(payload.displayName, "Display name", 60);
    const occupied = [...room.players.values()].filter((player) => player.role === "PLAYER" || player.assignedCharacterId).length;
    if (occupied >= 6) fail("ROOM_FULL", "Room full: six player places are reserved, including disconnected players. Reconnect to reclaim your place.");
    const identity = this.addIdentity(room, socketId, displayName, "PLAYER");
    this.activity(room, `${displayName} joined the room.`);
    return { room, session: identity.session };
  }

  reconnect(socketId, payload) {
    this.ensureUnbound(socketId);
    object(payload, ["roomCode", "playerId", "reconnectToken"]);
    const room = this.room(payload.roomCode);
    const player = room.players.get(payload.playerId);
    if (!player || typeof payload.reconnectToken !== "string" || !/^[a-f0-9]{64}$/.test(payload.reconnectToken) || !timingSafeEqual(player.tokenHash, hash(payload.reconnectToken))) fail("INVALID_SESSION", "Unable to reconnect: invalid reconnect session.");
    const replacedSocketId = player.socketId;
    if (replacedSocketId) this.connections.delete(replacedSocketId);
    player.socketId = socketId;
    player.connected = true;
    this.connections.set(socketId, { code: room.code, playerId: player.id });
    this.activity(room, `${player.displayName} reconnected.`);
    return { room, session: { roomCode: room.code, playerId: player.id, reconnectToken: payload.reconnectToken }, replacedSocketId };
  }

  authorize(socketId, hostOnly = true) {
    const binding = this.connections.get(socketId);
    const room = binding && this.rooms.get(binding.code);
    const player = room && room.players.get(binding.playerId);
    if (!player || !player.connected || player.socketId !== socketId) fail("INVALID_SESSION", "A connected room session is required.");
    if (hostOnly && (player.role !== "HOST" || player.id !== room.hostPlayerId)) fail("HOST_REQUIRED", "Host permission required.");
    return { room, player };
  }

  disconnect(socketId) {
    const binding = this.connections.get(socketId);
    if (!binding) return null;
    const room = this.rooms.get(binding.code);
    const player = room.players.get(binding.playerId);
    this.connections.delete(socketId);
    if (player.socketId !== socketId) return null;
    player.connected = false;
    player.socketId = null;
    this.activity(room, `${player.displayName} disconnected.`);
    return room;
  }

  assign(socketId, payload) {
    const { room } = this.authorize(socketId);
    object(payload, ["playerId", "characterId"]);
    const player = room.players.get(text(payload.playerId, "Player ID"));
    if (!player) fail("PLAYER_NOT_FOUND", "Player not found in this room.");
    const check = room.gameState.currentCheck;
    if (State.hasUnresolvedCheck(room.gameState) && (player.id === check.playerId || player.assignedCharacterId === check.characterId || payload.characterId === check.characterId)) fail("CHECK_PENDING", "Resolve or cancel the pending Check before changing its assignment.");
    if (payload.characterId !== null) text(payload.characterId, "Character ID");
    const character = room.gameState.characters.find((entry) => entry.id === payload.characterId);
    if (payload.characterId !== null && !character) fail("CHARACTER_NOT_FOUND", "Character not found.");
    if (character && [...room.players.values()].some((other) => other.id !== player.id && other.assignedCharacterId === character.id)) fail("CHARACTER_ASSIGNED", "Character already assigned. Unassign the previous player first.");
    if (character && player.role === "HOST" && [...room.players.values()].filter((other) => other.role === "PLAYER").length >= 6) fail("ROOM_FULL", "Six player places are already reserved. The Host must remain unassigned.");
    player.assignedCharacterId = character ? character.id : null;
    this.activity(room, `${player.displayName} was ${character ? `assigned to ${character.name}` : "unassigned"}.`);
    return room;
  }

  checkVersion(room, version) {
    if (!Number.isSafeInteger(version) || version < 0) fail("INVALID_PAYLOAD", "Invalid state revision.");
    if (version !== room.gameVersion) fail("STALE_STATE", "The room changed. Latest state restored; please try the action again.");
  }

  acceptState(room, candidate) {
    let next;
    try {
      if (!candidate || candidate.schemaVersion !== State.SCHEMA_VERSION) fail("INVALID_STATE", "Current game schema required.");
      const errors = State.validateState(candidate);
      if (errors.length) fail("INVALID_STATE", errors.join(" "));
      next = State.normalizeState(candidate);
    } catch (error) {
      if (error instanceof RoomError) throw error;
      fail("INVALID_STATE", "Invalid game state or Check snapshot.");
    }
    room.gameState = next;
    room.gameVersion++;
    room.revision++;
    for (const player of room.players.values()) {
      if (player.assignedCharacterId && !next.characters.some((character) => character.id === player.assignedCharacterId)) {
        player.assignedCharacterId = null;
        this.activity(room, `${player.displayName} was unassigned because their character was removed.`);
      }
    }
  }

  action(socketId, payload) {
    const { room, player } = this.authorize(socketId, false);
    if (player.role !== "HOST") {
      if (payload?.action !== "editCharacter" || !room.gameState.settings.allowPlayerCharacterEdits || payload.args?.[0] !== player.assignedCharacterId || !player.assignedCharacterId) fail("HOST_REQUIRED", "You may only edit your assigned character when the Host allows editing.");
      const patch=payload.args[1], c=room.gameState.characters.find(c=>c.id===player.assignedCharacterId);
      if(!patch || typeof patch!=="object") fail("INVALID_PAYLOAD","Invalid character edit.");
      if(patch.aspects && (!Array.isArray(patch.aspects) || patch.aspects.some((a,i)=>!a || Object.keys(a).some(k=>!["id","type","name","rating","strained"].includes(k)) || a.strained!==c.aspects[i]?.strained))) fail("HOST_REQUIRED","Strain is Host controlled.");
      if(patch.perks && (!Array.isArray(patch.perks) || patch.perks.some(p=>!p || !!p.disabled!==!!c.perks.find(old=>old.id===p.id)?.disabled))) fail("HOST_REQUIRED","Disabled Perk state is Host controlled.");
    }
    object(payload, ["action", "args", "baseVersion"]);
    this.checkVersion(room, payload.baseVersion);
    if (typeof payload.action !== "string" || !Object.hasOwn(MANAGEMENT, payload.action) || !Array.isArray(payload.args) || !MANAGEMENT[payload.action](payload.args)) fail("INVALID_PAYLOAD", "Unknown or malformed management action.");
    if (["resetGame", "importState"].includes(payload.action) && State.hasUnresolvedCheck(room.gameState)) fail("CHECK_PENDING", "Cancel or resolve the pending Check before resetting or importing.");
    if (payload.action === "importState" && payload.args[0].currentCheck) fail("SERVER_AUTHORITATIVE", "Multiplayer imports cannot contain client Check results. Import a game with no Check.");
    const store = State.createStore({ storage: null, initialState: room.gameState });
    try {
      store[payload.action](...payload.args);
    } catch (error) { fail("ILLEGAL_ACTION", error instanceof TypeError ? "Invalid game state or action." : error.message); }
    this.acceptState(room, store.getState());
    return room;
  }

  checkState(socketId) {
    this.authorize(socketId);
    fail("SERVER_AUTHORITATIVE", "Client Check snapshots are no longer accepted. Send a Check action request.");
  }

  snapshot(room) {
    return clone({ code: room.code, hostPlayerId: room.hostPlayerId, createdAt: room.createdAt,
      gameVersion: room.gameVersion, revision: room.revision, gameState: room.gameState, activity: room.activity,
      players: [...room.players.values()].map(({ id, displayName, role, connected, assignedCharacterId }) => ({ id, displayName, role, connected, assignedCharacterId })) });
  }
}

module.exports = { RoomManager, RoomError };
