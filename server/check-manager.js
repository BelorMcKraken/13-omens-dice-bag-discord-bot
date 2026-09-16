"use strict";
const { randomInt, randomUUID } = require("node:crypto");
const Rules = require("../js/rules.js");
const State = require("../js/state.js");
const { fail, object, text, number } = require("./validation.js");

const EVENTS = ["check:create", "check:set-rating", "check:draw", "check:roll", "check:reroll", "check:select-roll", "check:take-wound", "check:cheat-death", "check:valiant-sacrifice", "check:finish", "check:cancel", "check:takeover"];
const METHODS = { "check:roll": "rollCheck", "check:reroll": "rerollCheck", "check:select-roll": "chooseRoll", "check:take-wound": "takeWound", "check:cheat-death": "cheatDeath", "check:valiant-sacrifice": "valiantSacrifice", "check:finish": "finishCheck", "check:cancel": "cancelCheck" };
const clone = (value) => JSON.parse(JSON.stringify(value));

class CheckManager {
  constructor(rooms, rng = (min, max) => randomInt(min, max + 1)) { this.rooms = rooms; this.rng = rng; }

  configuration(input, state) {
    object(input, ["characterId", "aspectId", "manualTn", "baseTn", "aspect", "difficultyModifier", "edges", "flaws", "risky", "harmless", "forcedOmen"]);
    const characterId = text(input.characterId, "Character ID");
    const character = state.characters.find(c => c.id === characterId);
    if (!character || !character.active) fail("INACTIVE_CHARACTER", "An active character is required for a Check.");
    for (const key of ["manualTn", "risky", "harmless", "forcedOmen"]) if (typeof input[key] !== "boolean") fail("INVALID_PAYLOAD", `Invalid ${key} setting.`);
    if (![-2, -1, 0, 1, 2].includes(input.difficultyModifier)) fail("INVALID_PAYLOAD", "Choose a known Difficulty.");
    const edges = number(input.edges, 2), flaws = number(input.flaws, 2);
    let aspect, aspectId, rating, baseTn;
    if (input.manualTn) {
      if (input.aspectId !== undefined) fail("INVALID_PAYLOAD", "Manual Checks do not select a stored Aspect.");
      aspect = text(input.aspect || "Manual Check", "Aspect"); baseTn = number(input.baseTn, 30);
      if (baseTn < 1) fail("INVALID_PAYLOAD", "Base TN must be at least 1.");
    } else {
      if (input.baseTn !== undefined || input.aspect !== undefined) fail("INVALID_PAYLOAD", "Normal Checks derive Rating and TN from the character sheet.");
      const stored = Rules.getAspect(character, input.aspectId);
      if (!stored) fail("INVALID_PAYLOAD", "Choose an Aspect on this character.");
      ({ id: aspectId, name: aspect, rating } = stored); baseTn = Rules.getTargetNumberForRating(rating);
    }
    return { characterId, configuration: { aspectId, aspect, rating, manualTn: input.manualTn, baseTn,
      allowPlayerRating: false, difficultyModifier: input.difficultyModifier, edges, flaws,
      risky: input.risky, harmless: input.harmless, forcedOmen: input.forcedOmen } };
  }

  create(socketId, payload) {
    const { room, player: host } = this.rooms.authorize(socketId);
    object(payload, ["configuration", "baseVersion"]);
    this.rooms.checkVersion(room, payload.baseVersion);
    if (State.hasUnresolvedCheck(room.gameState)) fail("CHECK_PENDING", "Resolve or cancel the current Check first.");
    const { characterId, configuration } = this.configuration(payload.configuration, room.gameState);
    const character = room.gameState.characters.find((entry) => entry.id === characterId);
    if (!character || !character.active) fail("INACTIVE_CHARACTER", "An active character is required for a Check.");
    const assigned = [...room.players.values()].find((entry) => entry.assignedCharacterId === characterId);
    const automaticFlaws = Rules.automaticFlawSources(room.gameState, configuration.aspectId || configuration.aspect, { characterId });
    const composition = Rules.calculateCheckComposition({ ...configuration, automaticFlaws: automaticFlaws.wounds + automaticFlaws.strain });
    const check = { id: randomUUID(), characterId, characterName: character.name, playerId: assigned?.id || null,
      hostTakeover: !assigned || assigned.role === "HOST", act: room.gameState.act, phase: Rules.PHASE_REQUESTED,
      configuration, composition, automaticFlaws, finalTn: Rules.determineFinalTN(configuration.baseTn, configuration.difficultyModifier),
      dice: [], originalRoll: null, reroll: null, selectedRoll: null, forcedOmenCommitted: false, valiantAvailable: false, resolved: false };
    check.sceneNumber = room.gameState.sceneNumber; check.woundThreshold = Rules.getWoundThreshold(character, check.act);
    check.perkActivations = []; check.originalAspectId = configuration.aspectId; check.originalAspectName = configuration.aspect; check.effectiveAspectId = configuration.aspectId;
    Rules.refreshCheckModifiers(room.gameState, check);
    const next = clone(room.gameState); next.currentCheck = check; next.selectedCharacterId = characterId;
    const difficulty = Object.entries(Rules.DIFFICULTIES).find(([, value]) => value === configuration.difficultyModifier)[0];
    this.log(next, `${host.displayName} called for ${character.name} to make a ${difficulty} ${configuration.aspect} Check (${check.act}).`);
    if (Rules.Perks.hasPerk(character,"the-truth")) this.log(next, `${character.name} — The Truth: Omen Wound threshold 1; death threshold 2; Cheat Death forbidden.`);
    this.rooms.acceptState(room, next);
    return room;
  }

  log(state, message) { state.history = [...state.history, { time: new Date().toISOString(), text: message }].slice(-250); }

  actor(socketId, payload, event) {
    const { room, player } = this.rooms.authorize(socketId, false);
    const extra = event === "check:set-rating" ? ["rating"] : event === "check:select-roll" ? ["rollName"] : [];
    object(payload, ["checkId", "baseVersion", ...extra]);
    this.rooms.checkVersion(room, payload.baseVersion);
    const check = room.gameState.currentCheck;
    if (!State.hasUnresolvedCheck(room.gameState) || check.id !== payload.checkId) fail("NO_PENDING_CHECK", "This Check is no longer pending.");
    const isHost = player.role === "HOST" && player.id === room.hostPlayerId;
    if (["check:cancel", "check:takeover"].includes(event)) {
      if (!isHost) fail("HOST_REQUIRED", "Host permission required.");
    } else if (isHost) {
      if (!check.hostTakeover) fail("TAKEOVER_REQUIRED", "Take over this Check before acting for the Player.");
    } else if (check.hostTakeover || check.playerId !== player.id || player.assignedCharacterId !== check.characterId) {
      fail("CHECK_OWNER_REQUIRED", "Only the assigned Player may control this Check.");
    }
    const character = room.gameState.characters.find((entry) => entry.id === check.characterId);
    if ((!character || !character.active) && event !== "check:cancel") fail("INACTIVE_CHARACTER", "This Check requires an active character.");
    return { room, player, check, character, isHost };
  }

  handle(socketId, event, payload) {
    if (!EVENTS.includes(event)) fail("INVALID_PAYLOAD", "Unknown Check action.");
    if (event === "check:create") return this.create(socketId, payload);
    const { room, player, check, character, isHost } = this.actor(socketId, payload, event);
    let next;
    const requirePhase = (...phases) => { if (!phases.includes(check.phase)) fail("ILLEGAL_PHASE", "That action is not available in this Check phase."); };
    if (event === "check:takeover") {
      if (check.hostTakeover) fail("ILLEGAL_ACTION", "The Host already controls this Check.");
      next = clone(room.gameState); next.currentCheck.hostTakeover = true;
      this.log(next, `${player.displayName} took over ${character.name}'s Check.`);
    } else if (event === "check:set-rating") {
      requirePhase(Rules.PHASE_REQUESTED);
      if (!check.configuration.allowPlayerRating) fail("RATING_LOCKED", "The Host has locked the Rating/TN.");
      if (typeof payload.rating !== "string" || !Object.hasOwn(Rules.ASPECTS, payload.rating)) fail("INVALID_PAYLOAD", "Choose a known Rating.");
      next = clone(room.gameState);
      next.currentCheck.configuration.rating = payload.rating;
      next.currentCheck.configuration.baseTn = Rules.getTargetNumberForRating(payload.rating);
      next.currentCheck.finalTn = Rules.determineFinalTN(Rules.getTargetNumberForRating(payload.rating), check.configuration.difficultyModifier);
      this.log(next, `${character.name} confirmed ${payload.rating} Rating (base TN ${Rules.getTargetNumberForRating(payload.rating)}).`);
    } else if (event === "check:draw") {
      requirePhase(Rules.PHASE_REQUESTED);
      // Reuse the existing transaction creation, on the requested owner and snapshotted Act.
      const drawState = clone(room.gameState);
      drawState.currentCheck = null; drawState.selectedCharacterId = check.characterId; drawState.act = check.act;
      const store = State.createStore({ storage: null, initialState: drawState });
      try { store.drawCheck({ ...check.configuration, automaticFlawSnapshot: check.automaticFlaws, compositionSnapshot: check.composition }, this.rng); } catch (error) { fail("ILLEGAL_ACTION", error.message); }
      next = store.getState(); next.act = room.gameState.act; next.selectedCharacterId = room.gameState.selectedCharacterId;
      Object.assign(next.currentCheck, { id: check.id, playerId: check.playerId, hostTakeover: check.hostTakeover,
        sceneNumber: check.sceneNumber, woundThreshold: check.woundThreshold, perkActivations: check.perkActivations, keepStrategy: check.keepStrategy, modifierSources: check.modifierSources, originalAspectId: check.originalAspectId, originalAspectName: check.originalAspectName, effectiveAspectId: check.effectiveAspectId,
        configuration: { ...check.configuration, ...next.currentCheck.configuration } });
    } else {
      if (event === "check:roll" || event === "check:valiant-sacrifice") requirePhase(Rules.PHASE_DRAWN);
      if (["check:reroll", "check:select-roll"].includes(event)) requirePhase(Rules.PHASE_ROLLED, Rules.PHASE_AWAITING_WOUND);
      if (["check:reroll", "check:select-roll"].includes(event) && !isHost) fail("HOST_REQUIRED", "Generic rerolls are Host debug tools. Use Awkward Pause if available.");
      if (event === "check:select-roll" && check.perkReroll) fail("ILLEGAL_ACTION", "Awkward Pause automatically keeps the better result.");
      if (event === "check:reroll" && check.reroll) fail("ILLEGAL_ACTION", "This Check has already been rerolled.");
      if (event === "check:select-roll" && (!check.reroll || !["original", "reroll"].includes(payload.rollName))) fail("ILLEGAL_ACTION", "Choose an available roll.");
      if (["check:take-wound", "check:cheat-death"].includes(event)) requirePhase(Rules.PHASE_AWAITING_WOUND);
      if (event === "check:finish") requirePhase(Rules.PHASE_ROLLED);
      const store = State.createStore({ storage: null, initialState: room.gameState });
      const args = event === "check:select-roll" ? [payload.rollName] : ["check:roll", "check:reroll"].includes(event) ? [this.rng] : [];
      try { store[METHODS[event]](...args); } catch (error) { fail("ILLEGAL_ACTION", error.message); }
      next = store.getState();
    }
    if (isHost && event !== "check:takeover") this.log(next, `${player.displayName} acted for ${character.name}: ${event.slice(6)}.`);
    this.rooms.acceptState(room, next);
    return room;
  }
}
module.exports = { CheckManager, EVENTS };
