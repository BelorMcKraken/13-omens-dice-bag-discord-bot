(function (root, factory) {
  const Rules = typeof module === "object" && module.exports ? require("./rules.js") : root.ThirteenOmensRules;
  const createStore = (options) => {
    const store = factory(Rules, options);
    store.createStore = createStore;
    return store;
  };
  const api = createStore();
  api.createStore = createStore;
  root.ThirteenOmensState = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Rules, options) {
  "use strict";
  options = options || {};

  const STORAGE_KEY = "thirteen-omens-dice-bag-state-v1";
  const SCHEMA_VERSION = 5;

  function newCharacter(name = "Character 1") {
    return { id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `char-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, archetype: "", description: "", notes: "", aspects: Rules.defaultAspects(), perkUsage: {}, perks: [], gear: [], strainReliefUsed: false, wounds: 0, active: true, cheatDeathUsed: false, safeDiceLost: 0, strain: {}, statusMessage: "" };
  }

  function defaultState() {
    const character = newCharacter();
    return { schemaVersion: SCHEMA_VERSION, version: SCHEMA_VERSION, act: "Prologue",
      sceneNumber: 1, storyCharacterCount: 1, perishedCharacterIds: [], bag: { safe: 8, omen: 0 }, hostOmens: 13, characters: [character], selectedCharacterId: character.id,
      settings: { autoApplyStrainFlaw: false, lockActDuringPendingCheck: true, allowPlayerCharacterEdits: true }, currentCheck: null,
      history: [{ time: new Date().toISOString(), text: "Game Started" }] };
  }

  const storage = Object.hasOwn(options, "storage") ? options.storage : typeof localStorage !== "undefined" ? localStorage : null;
  let transport = null;
  let mode = "solo";
  let state = options.initialState ? normalizeState(options.initialState) : loadState();
  const sanitizeInteger = Rules.clampInteger;

  function normalizeState(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid game state.");
    const next = JSON.parse(JSON.stringify(input));
    const legacy = !Object.hasOwn(next, "characters");
    if (legacy) {
      if (!next.character || typeof next.character !== "object") throw new Error("Missing character state.");
      const character = { ...newCharacter(), ...next.character };
      character.id = character.id || newCharacter().id;
      character.name = character.name || "Character 1";
      next.characters = [character];
      next.selectedCharacterId = character.id;
      delete next.character;
    }
    next.settings = { autoApplyStrainFlaw: false, lockActDuringPendingCheck: true, allowPlayerCharacterEdits: true, ...next.settings };
    next.history = Array.isArray(next.history) ? next.history.slice(-250) : [];
    if (Array.isArray(next.characters)) next.characters = next.characters.map((character) => ({
      safeDiceLost: 0, statusMessage: "", ...character,
      name: typeof character.name === "string" ? character.name.trim() : character.name,
    }));
    if (next.currentCheck && !next.currentCheck.phase && (input.schemaVersion || input.version || 1) < 2) next.currentCheck = null;
    if (next.currentCheck && (input.schemaVersion || input.version || 1) < 3) {
      next.currentCheck.characterId ??= next.selectedCharacterId;
      next.currentCheck.act ??= next.act;
      next.currentCheck.characterName ??= next.characters[0].name;
    }
    if ((input.schemaVersion || input.version || 1) < 4) {
      next.storyCharacterCount ??= next.characters.length;
      next.perishedCharacterIds ??= next.characters.filter(c => !c.active).map(c => c.id);
      for (const c of next.characters) {
        c.archetype ??= ""; c.description ??= ""; c.notes ??= "";
        c.gear ??= []; c.perks ??= []; c.strainReliefUsed ??= false;
        c.aspects ??= Rules.defaultAspects();
        // Preserve unmatched legacy Strain as named story slots when possible,
        // and keep overflow keys in the compatibility map rather than lose data.
        const unknown = Object.keys(c.strain || {}).filter(key => !Rules.findAspect(c, key));
        unknown.slice(0, 5).forEach((key, i) => { c.aspects[5 + i].name = key; });
        for (const a of c.aspects) { a.strained = Boolean(c.strain?.[a.id] || c.strain?.[a.name]); if (a.name !== a.id) delete c.strain[a.name]; c.strain[a.id] = Number(a.strained); }
      }
    }
    if ((input.schemaVersion || input.version || 1) < 5) {
      next.sceneNumber ??= 1;
      for (const c of next.characters) { c.perkUsage ??= {}; c.perks = c.perks.map(p=>({...p,ruleKey:Rules.Perks.PERK_RULES[p.ruleKey]?p.ruleKey:null,disabled:Boolean(p.disabled)})); }
    }
    next.currentCheck ??= null;
    next.schemaVersion = next.version = SCHEMA_VERSION;
    const errors = validateState(next);
    if (errors.length) throw new Error(errors.join(" "));
    return next;
  }

  function hasUnresolvedCheck(candidate) {
    return Boolean(candidate.currentCheck && candidate.currentCheck.phase !== Rules.PHASE_RESOLVED);
  }

  function validateState(candidate) {
    const errors = [];
    const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
    if (!Rules.ACTS.includes(candidate.act)) errors.push("Invalid act.");
    if (!candidate.bag || !integer(candidate.bag.safe, 99) || !integer(candidate.bag.omen, 13) || !integer(candidate.hostOmens, 13)) errors.push("Invalid dice counts.");
    if (!Number.isSafeInteger(candidate.sceneNumber) || candidate.sceneNumber < 1) errors.push("Invalid scene.");
    const characters = candidate.characters;
    if (!Array.isArray(characters) || characters.length < 1 || characters.length > 6) return [...errors, "Must have 1–6 characters."];
    const ids = new Set();
    for (const character of characters) {
      if (!character || typeof character.id !== "string" || !character.id.trim() || ids.has(character.id)) { errors.push("Invalid or duplicate character ID."); continue; }
      ids.add(character.id);
      if (typeof character.name !== "string" || !character.name.trim() || character.name.length > 120) errors.push("Character names cannot be blank.");
      if (!integer(character.wounds, 6) || typeof character.active !== "boolean" || typeof character.cheatDeathUsed !== "boolean" || !integer(character.safeDiceLost, 99)) errors.push("Invalid character Wounds or status.");
      if (!character.strain || typeof character.strain !== "object" || Array.isArray(character.strain) || Object.entries(character.strain).some(([key, value]) => !key.trim() || !(typeof value === "boolean" || integer(value, Number.MAX_SAFE_INTEGER)))) errors.push("Invalid character Strain.");
    }
    if (!Number.isInteger(candidate.storyCharacterCount) || candidate.storyCharacterCount < 1 || candidate.storyCharacterCount > 6 || !Array.isArray(candidate.perishedCharacterIds) || candidate.perishedCharacterIds.some(id => typeof id !== "string") || new Set(candidate.perishedCharacterIds).size !== candidate.perishedCharacterIds.length) errors.push("Invalid story group rules.");
    for (const c of characters) {
      if (!c.perkUsage || typeof c.perkUsage !== 'object' || Array.isArray(c.perkUsage) || Object.values(c.perkUsage).some(u=>!u || typeof u.storyUsed!=='boolean' || !Array.isArray(u.actsUsed) || u.actsUsed.some(a=>!Rules.ACTS.includes(a)) || !Array.isArray(u.scenesUsed) || u.scenesUsed.some(n=>!Number.isSafeInteger(n)||n<1))) errors.push("Invalid Perk usage.");
      if (c.perks?.some(p=>p.ruleKey!=null&&!Object.hasOwn(Rules.Perks.PERK_RULES,p.ruleKey) || p.disabled!==undefined&&typeof p.disabled!=='boolean')) errors.push("Invalid Perk rule.");
      if (["archetype", "description", "notes"].some(k => typeof c[k] !== "string" || c[k].length > 4000) || typeof c.strainReliefUsed !== "boolean") errors.push("Invalid character sheet.");
      if (!Array.isArray(c.aspects) || c.aspects.length !== 10 || c.aspects.some((a, i) => !a || a.id !== (i < 5 ? Rules.CORE_NAMES[i].toLowerCase() : `story-${i - 4}`) || a.type !== (i < 5 ? "core" : "story") || (i < 5 && a.name !== Rules.CORE_NAMES[i]) || typeof a.name !== "string" || !a.name.trim() || a.name.length > 120 || typeof a.rating !== "string" || !Object.hasOwn(Rules.ASPECTS, a.rating) || typeof a.strained !== "boolean")) errors.push("Invalid Aspects: five Core and five Story slots required.");
      for (const key of ["gear", "perks"]) if (!Array.isArray(c[key]) || c[key].length > 50 || new Set(c[key].map(e => e?.id)).size !== c[key].length || c[key].some(e => !e || typeof e.id !== "string" || e.id.length > 120 || !e.id || typeof e.name !== "string" || !e.name.trim() || e.name.length > 120 || typeof e.notes !== "string" || e.notes.length > 4000)) errors.push("Invalid Gear/Perks.");
    }
    if (!ids.has(candidate.selectedCharacterId)) errors.push("Invalid selected character ID.");
    if (!candidate.settings || typeof candidate.settings.autoApplyStrainFlaw !== "boolean" || typeof candidate.settings.lockActDuringPendingCheck !== "boolean" || (candidate.settings.allowPlayerCharacterEdits !== undefined && typeof candidate.settings.allowPlayerCharacterEdits !== "boolean")) errors.push("Invalid Host settings.");
    if (!Array.isArray(candidate.history) || candidate.history.some((entry) => !entry || typeof entry.text !== "string" || typeof entry.time !== "string" || !Number.isFinite(Date.parse(entry.time)))) errors.push("Invalid session history.");
    const check = candidate.currentCheck;
    if (check) {
      if (!Rules.ACTS.includes(check.act) || !ids.has(check.characterId)) errors.push("Invalid Check character or Act snapshot.");
      if (![Rules.PHASE_REQUESTED, Rules.PHASE_DRAWN, Rules.PHASE_ROLLED, Rules.PHASE_AWAITING_WOUND, Rules.PHASE_RESOLVED].includes(check.phase) || !Array.isArray(check.dice) || (check.phase === Rules.PHASE_REQUESTED ? check.dice.length !== 0 : check.dice.length < 2) || !check.configuration || !check.composition) errors.push("Invalid pending Check.");
      else {
        if (typeof check.forcedOmenCommitted !== "boolean" || check.dice.filter((die) => die && die.source === "forced").length !== Number(check.forcedOmenCommitted)) errors.push("Invalid Forced Omen commitment.");
        if (!Number.isFinite(check.finalTn) || !["NORMAL", "EDGE", "FLAW"].includes(check.composition.resolutionMode)) errors.push("Invalid Check configuration.");
        for (const roll of [check.originalRoll, check.reroll].filter(Boolean)) {
          if (!Array.isArray(roll.dice) || roll.dice.length !== check.dice.length || roll.dice.some((die, i) => !die || !integer(die.result, 6) || die.result < 1 || die.type !== check.dice[i].type || die.source !== check.dice[i].source) || !Number.isFinite(roll.total) || typeof roll.result !== "string" || !roll.wound || typeof roll.wound.triggered !== "boolean" || !Array.isArray(roll.wound.qualifyingDice) || (roll.wound.triggered && !roll.wound.selectedWoundDie)) errors.push("Invalid Check roll.");
        }
        if (check.dice.some((die) => !die || ![Rules.DIE_SAFE, Rules.DIE_OMEN].includes(die.type) || !["bag", "forced"].includes(die.source))) errors.push("Invalid Check dice.");
        if (check.phase !== Rules.PHASE_REQUESTED && check.phase !== Rules.PHASE_DRAWN && !check.valiantResolved && (!check.originalRoll || !Rules.getSelectedRoll(check))) errors.push("Missing Check roll.");
      }
    }
    if (!errors.length && !Rules.validateOmenEconomy(candidate)) errors.push("Omen economy must total 13 across Host, bag, all characters' Wounds, and pending Forced Omen.");
    return errors;
  }

  function saveState() {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const loaded = normalizeState(JSON.parse(raw));
      storage?.setItem(STORAGE_KEY, JSON.stringify(loaded));
      return loaded;
    } catch (error) {
      console.warn("Could not load saved 13 Omens state.", error);
      return defaultState();
    }
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function addHistory(text) {
    state.history.push({ time: new Date().toISOString(), text });
    state.history = state.history.slice(-250);
  }

  function commit(mutator, logMessage) {
    const draft = getState();
    mutator(draft);
    const next = normalizeState(draft);
    const message = typeof logMessage === "function" ? logMessage(next) : logMessage;
    if (message) next.history = [...next.history, { time: new Date().toISOString(), text: message }].slice(-250);
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return getState();
  }

  function resetGame() {
    state = { ...defaultState(), settings: { ...state.settings } };
    saveState();
    return getState();
  }

  function importState(candidate) {
    const next = normalizeState(candidate);
    const errors = validateState(next);
    if (errors.length) throw new Error(errors.join(" "));
    next.history.push({ time: new Date().toISOString(), text: "Imported game state" });
    next.history = next.history.slice(-250);
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return getState();
  }

  function clearLog() {
    return commit((draft) => {
      draft.history = [];
    }, "Log cleared");
  }

  function blockIfPending(draft) {
    if (hasUnresolvedCheck(draft)) throw new Error("Cancel or resolve the pending Check before changing persistent state.");
  }

  function setAct(act) {
    return commit((draft) => {
      if (draft.settings.lockActDuringPendingCheck) blockIfPending(draft);
      draft.act = act;
    }, `Act changed to ${act}`);
  }

  function addOmenToBag() {
    return commit((draft) => {
      blockIfPending(draft);
      if (draft.hostOmens < 1) throw new Error("No Host Omens remain.");
      draft.hostOmens -= 1;
      draft.bag.omen += 1;
    }, "Omen added to bag");
  }

  function removeOmenFromBag() {
    return commit((draft) => {
      blockIfPending(draft);
      if (draft.bag.omen < 1) throw new Error("No Omen Dice are in the bag.");
      draft.bag.omen -= 1;
      draft.hostOmens += 1;
    }, "Omen removed from bag");
  }

  function applyManual(values) {
    return commit((draft) => {
      blockIfPending(draft);
      draft.bag.safe = sanitizeInteger(values.safe, 0, 99);
      draft.bag.omen = sanitizeInteger(values.omen, 0, 13);
      draft.hostOmens = sanitizeInteger(values.host, 0, 13);
      const character = draft.characters.find((entry) => entry.id === (values.characterId || draft.selectedCharacterId));
      if (!character) throw new Error("Unknown character.");
      character.wounds = sanitizeInteger(values.wounds, 0, 6);
      character.active = values.active === "true" || values.active === true;
      draft.act = Rules.ACTS.includes(values.act) ? values.act : draft.act;
      if (values.strain !== undefined) {
        character.strain = values.strain;
        for (const a of character.aspects) a.strained = Boolean(values.strain[a.id] || values.strain[a.name]);
      }
      if (character.active && character.wounds >= Rules.getDeathThreshold(draft, character)) { draft.bag.omen += character.wounds; character.wounds = 0; Rules.markPerished(draft, character); }
      else if (!character.active) Rules.markPerished(draft, character);
      if (values.cheatDeathUsed !== undefined) character.cheatDeathUsed = values.cheatDeathUsed;
    }, (draft) => `${draft.characters.find((entry) => entry.id === (values.characterId || draft.selectedCharacterId)).name} — Host tools adjusted game state`);
  }

  function drawCheck(options, rng) {
    return commit((draft) => {
      if (hasUnresolvedCheck(draft)) throw new Error("Resolve or cancel the pending Check before drawing another.");
      const check = Rules.drawCheckDice(draft, options, rng);
      if (check.forcedOmenCommitted) draft.hostOmens -= 1;
      draft.currentCheck = check;
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — ${draft.currentCheck.configuration.aspect} Check (${draft.currentCheck.act}): ${formatDraw(draft.currentCheck)}`);
  }

  function rollCheck(rng) {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      draft.currentCheck = Rules.rollPendingCheck(draft.currentCheck, draft.currentCheck.act, rng);
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — Roll: ${formatRoll(draft.currentCheck && Rules.getSelectedRoll(draft.currentCheck))}`);
  }

  function rerollCheck(rng) {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      draft.currentCheck = Rules.rerollPendingCheck(draft.currentCheck, draft.currentCheck.act, rng);
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — Reroll Same Dice: ${formatRoll(Rules.getSelectedRoll(draft.currentCheck))}`);
  }

  function chooseRoll(rollName) {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      draft.currentCheck = Rules.selectRoll(draft.currentCheck, rollName);
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — Selected ${rollName === "reroll" ? "Reroll" : "Original"} result`);
  }

  function finishCheck() {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      const selected = Rules.getSelectedRoll(draft.currentCheck);
      if (!selected) throw new Error("Roll the Check before finishing it.");
      if (selected.wound.triggered && !draft.currentCheck.configuration.harmless) throw new Error("Resolve the Wound before finishing this Check.");
      const next =
        draft.currentCheck.configuration.harmless && selected.wound.triggered
          ? Rules.resolveHarmless(draft, draft.currentCheck, draft.currentCheck.configuration.aspect)
          : Rules.finishNoWound(draft, draft.currentCheck);
      Object.assign(draft, next);
      draft.currentCheck.phase = Rules.PHASE_RESOLVED;
      draft.currentCheck.resolved = true;
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — Check resolved${draft.currentCheck.configuration.harmless && Rules.getSelectedRoll(draft.currentCheck).wound.triggered ? "; Strain recorded: " + draft.currentCheck.configuration.aspect : ""}`);
  }

  function cancelCheck() {
    const name = state.currentCheck ? Rules.getCharacter(state, state.currentCheck).name : "Character";
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check is available to cancel.");
      Rules.Perks.refunds(draft, draft.currentCheck);
      if (draft.currentCheck.forcedOmenCommitted) draft.hostOmens += 1;
      draft.currentCheck = null;
    }, `${name} — Pending Check canceled; temporary dice restored`);
  }

  function takeWound() {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      const selected = Rules.getSelectedRoll(draft.currentCheck);
      if (!selected || !selected.wound.triggered || draft.currentCheck.configuration.harmless) throw new Error("No Omen Wound to resolve.");
      const next = Rules.resolveWound(draft, draft.currentCheck);
      Object.assign(draft, next);
      draft.currentCheck.phase = Rules.PHASE_RESOLVED;
      draft.currentCheck.resolved = true;
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} took an Omen Wound${Rules.getCharacter(draft, draft.currentCheck).active ? "" : " and succumbed to Death/Despair; their Wound Omens returned to the bag"}`);
  }

  function cheatDeath() {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      if (!Rules.getSelectedRoll(draft.currentCheck) || draft.currentCheck.configuration.harmless) throw new Error("No Omen Wound to resolve.");
      const next = Rules.resolveCheatDeath(draft, draft.currentCheck);
      Object.assign(draft, next);
      draft.currentCheck.phase = Rules.PHASE_RESOLVED;
      draft.currentCheck.resolved = true;
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} used Cheat Death`);
  }

  function valiantSacrifice() {
    return commit((draft) => {
      if (!hasUnresolvedCheck(draft)) throw new Error("No pending Check.");
      const next = Rules.resolveValiantSacrifice(draft, draft.currentCheck);
      Object.assign(draft, next);
      draft.currentCheck.phase = Rules.PHASE_RESOLVED;
      draft.currentCheck.resolved = true;
      draft.currentCheck.valiantResolved = true;
    }, (draft) => `${Rules.getCharacter(draft, draft.currentCheck).name} — Valiant Sacrifice resolved before rolling`);
  }

  function reviveCharacter() {
    return commit((draft) => {
      blockIfPending(draft);
      Rules.getCharacter(draft).active = true;
      Rules.getCharacter(draft).statusMessage = "Character status manually set to active.";
    }, (draft) => `${Rules.getCharacter(draft).name} — status reset to active`);
  }

  function recordStrain(aspect) {
    return commit((draft) => {
      blockIfPending(draft);
      const key = aspect || "Unassigned";
      Rules.setAspectStrain(Rules.getCharacter(draft), key, 1);
    }, (draft) => `${Rules.getCharacter(draft).name} — Strain recorded: ${aspect || "Unassigned"}`);
  }

  function setSetting(key, value) {
    return commit((draft) => {
      if (!["autoApplyStrainFlaw", "lockActDuringPendingCheck", "allowPlayerCharacterEdits"].includes(key) || typeof value !== "boolean") throw new Error("Invalid setting.");
      draft.settings[key] = value;
    });
  }

  function addCharacter() {
    return commit((draft) => {
      if (draft.characters.length >= 6) throw new Error("Maximum 6 characters reached.");
      draft.characters.push(newCharacter(`Character ${draft.characters.length + 1}`));
    }, "Character added");
  }

  function selectCharacter(id) {
    return commit((draft) => {
      blockIfPending(draft);
      if (!draft.characters.some((character) => character.id === id)) throw new Error("Unknown character.");
      draft.selectedCharacterId = id;
    });
  }

  function renameCharacter(id, name) {
    return commit((draft) => {
      if (typeof name !== "string" || !name.trim()) throw new Error("Character names cannot be blank.");
      const character = draft.characters.find((entry) => entry.id === id);
      if (!character) throw new Error("Unknown character.");
      character.name = name.trim();
    });
  }

  function removeCharacter(id) {
    const name = state.characters.find((entry) => entry.id === id)?.name || "Character";
    return commit((draft) => {
      if (draft.characters.length === 1) throw new Error("Cannot remove the final character.");
      if (hasUnresolvedCheck(draft) && draft.currentCheck.characterId === id) throw new Error("Cancel or resolve this character's pending Check before removal.");
      const character = draft.characters.find((entry) => entry.id === id);
      if (!character) throw new Error("Unknown character.");
      draft.bag.omen += character.wounds;
      draft.characters = draft.characters.filter((entry) => entry.id !== id);
      if (draft.selectedCharacterId === id) draft.selectedCharacterId = draft.characters[0].id;
      if (draft.currentCheck && draft.currentCheck.characterId === id) draft.currentCheck = null;
    }, `${name} removed; their Wound Omens returned to the bag`);
  }

  function advanceScene() {
    return commit(draft=>{blockIfPending(draft);draft.sceneNumber+=1;},draft=>'Scene '+draft.sceneNumber+' began.');
  }
  function setPerkDisabled(id, perkId, disabled) {
    return commit(draft=>{blockIfPending(draft);const p=draft.characters.find(c=>c.id===id)?.perks.find(p=>p.id===perkId);if(!p||typeof disabled!=='boolean')throw new Error('Unknown Perk.');p.disabled=disabled;},draft=>{const c=draft.characters.find(c=>c.id===id);return 'Host '+(disabled?'disabled ':'restored ')+c.name+"'s "+c.perks.find(p=>p.id===perkId).name+' Perk.';});
  }
  function activatePerk(id, perkId, aspectId, rng) {
    return commit(draft=>{
      const c=draft.characters.find(c=>c.id===id),p=c?.perks.find(p=>p.id===perkId),check=hasUnresolvedCheck(draft)?draft.currentCheck:null;
      if(!p||!Rules.Perks.eligible(c,p,draft,check))throw new Error('Perk is unavailable for this character, Aspect, usage or phase.');
      const rule=Rules.Perks.PERK_RULES[p.ruleKey];
      if(rule.type==='strain') {Rules.removeStrain(c,aspectId);Rules.Perks.markPerkUsed(c,p,draft);return;}
      const activation={characterId:id,perkId,ruleKey:p.ruleKey,name:rule.name,previousUsage:c.perkUsage[p.ruleKey]?JSON.parse(JSON.stringify(c.perkUsage[p.ruleKey])):null};
      if(rule.type==='reroll') {
        draft.currentCheck=Rules.rerollPendingCheck(check,check.act,rng);
        draft.currentCheck.perkReroll=true;
        Rules.Perks.markPerkUsed(c,p,draft,check);
        draft.currentCheck.perkActivations=[...(check.perkActivations||[]),activation];return;
      }
      if(rule.type==='lucky') {
        const luck=Rules.getAspect(c,'luck');
        check.originalAspectId??=check.configuration.aspectId;check.originalAspectName??=check.configuration.aspect;
        check.effectiveAspectId='luck';Object.assign(check.configuration,{aspectId:'luck',aspect:luck.name,rating:luck.rating,baseTn:Rules.getTargetNumberForRating(luck.rating)});
        check.finalTn=Rules.determineFinalTN(check.configuration.baseTn,check.configuration.difficultyModifier);
        check.automaticFlaws=Rules.automaticFlawSources(draft,'luck',check);
      }
      if(['edge','bossy'].includes(rule.type))activation.edge=1;
      if(['cancel','aid'].includes(rule.type))activation.cancel=1;
      if(['keep','bossy'].includes(rule.type))activation.keep=true;
      check.perkActivations=[...(check.perkActivations||[]),activation];
      const previousCount=check.composition.totalPhysicalDice;
      Rules.refreshCheckModifiers(draft,check);
      if(check.phase===Rules.PHASE_DRAWN) {
        const returned=previousCount-check.composition.totalPhysicalDice;
        if(returned<0)throw new Error('Activate this Perk before drawing.');
        for(let i=0;i<returned;i++){
          let index=check.dice.findIndex(d=>d.source==='bag'&&d.type===Rules.DIE_SAFE);
          if(index<0)index=check.dice.findIndex(d=>d.source==='bag');
          if(index<0)throw new Error('No eligible die to return.');
          check.returnedDice=[...(check.returnedDice||[]),...check.dice.splice(index,1)];
        }
        const owner=Rules.getCharacter(draft,check);
        check.valiantAvailable=owner.active&&owner.wounds>=3&&check.dice.some(d=>d.type===Rules.DIE_OMEN);
      }
      Rules.Perks.markPerkUsed(c,p,draft,check);
    },draft=>{const c=draft.characters.find(c=>c.id===id),p=c.perks.find(p=>p.id===perkId);return c.name+' used '+p.name+' in '+(draft.currentCheck?.act||draft.act)+(aspectId?' and removed '+Rules.getAspect(c,aspectId).name+' Strain':'')+'.';});
  }

  const characterKeys = Object.keys(newCharacter());
  function exportCharacter(id) {
    const c = state.characters.find(c => c.id === id);
    if (!c) throw new Error("Character not found.");
    const character = Object.fromEntries(characterKeys.map(k => [k, JSON.parse(JSON.stringify(c[k]))]));
    character.perkUsage = Object.fromEntries(Object.entries(c.perkUsage).map(([key,u])=>[key,{storyUsed:u.storyUsed,actsUsed:[...u.actsUsed],scenesUsed:[...u.scenesUsed]}]));
    character.aspects = c.aspects.map(({id,type,name,rating,strained}) => ({id,type,name,rating,strained}));
    character.perks = c.perks.map(({id,name,notes,ruleKey,disabled}) => ({id,name,notes,ruleKey:ruleKey||null,disabled:!!disabled}));
    character.gear = c.gear.map(({id,name,notes}) => ({id,name,notes}));
    return {type:"13-omens-character", version:1, exportedAt:new Date().toISOString(), character};
  }
  function importCharacter(file) {
    if (!file || file.type !== "13-omens-character" || file.version !== 1 || Object.keys(file).some(k=>!["type","version","exportedAt","character"].includes(k))) throw new Error("Invalid character file type or version.");
    const c = JSON.parse(JSON.stringify(file.character || {}));
    if (Object.keys(c).some(k=>!characterKeys.includes(k))) throw new Error("Character file contains protected or unknown fields.");
    for (const [key, allowed] of [["aspects",["id","type","name","rating","strained"]],["perks",["id","name","notes","ruleKey","disabled"]],["gear",["id","name","notes"]]]) {
      if (!Array.isArray(c[key]) || c[key].some(e=>!e || Object.keys(e).some(k=>!allowed.includes(k)))) throw new Error("Invalid character entries.");
    }
    if (typeof c.name!=="string" || c.name.length>120 || typeof c.statusMessage!=="string" || c.statusMessage.length>4000) throw new Error("Invalid character text.");
    if (!c.perkUsage || typeof c.perkUsage !== 'object' || Object.entries(c.perkUsage).some(([key,u])=> !Object.hasOwn(Rules.Perks.PERK_RULES,key) || !u || Object.keys(u).some(k=>!['storyUsed','actsUsed','scenesUsed'].includes(k)))) throw new Error("Invalid Perk usage fields.");
    c.id = newCharacter().id;
    const probe = defaultState(); probe.characters=[c]; probe.selectedCharacterId=c.id; probe.hostOmens=13-c.wounds;
    const errors=validateState(probe); if(errors.length) throw new Error(errors.join(" "));
    return commit(draft=>{
      blockIfPending(draft);
      if(draft.characters.length>=6) throw new Error("Cannot import character: room already has the maximum number of characters.");
      if(draft.hostOmens<c.wounds) throw new Error("Cannot import character: not enough Host Omens to preserve imported Wounds.");
      draft.hostOmens-=c.wounds; draft.characters.push(c); draft.selectedCharacterId=c.id;
      if(!c.active) draft.perishedCharacterIds.push(c.id);
    }, "Imported character: "+c.name);
  }

  function editCharacter(id, patch) {
    return commit(draft => {
      const c = draft.characters.find(c => c.id === id);
      if (!c || !patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid character edit.");
      const allowed = ["name", "archetype", "description", "notes", "aspects", "gear", "perks"];
      if (Object.keys(patch).some(k => !allowed.includes(k))) throw new Error("Unknown character field.");
      // Full committed sheet edits, never arbitrary mechanics or identity replacement.
      if (patch.aspects) {
        if (!Array.isArray(patch.aspects) || patch.aspects.some(a=>!a || Object.keys(a).some(k=>!["id","type","name","rating","strained"].includes(k)))) throw new Error("Invalid Aspects.");
        if (hasUnresolvedCheck(draft) && patch.aspects.some((a, i) => a.strained !== c.aspects[i]?.strained)) throw new Error("Resolve the pending Check before changing Strain.");
      }
      if (patch.gear && (!Array.isArray(patch.gear) || patch.gear.some(e=>!e || Object.keys(e).some(k=>!["id","name","notes"].includes(k))))) throw new Error("Invalid Gear edit.");
      if (patch.perks) {
        if (!Array.isArray(patch.perks) || patch.perks.some(p=>Object.keys(p).some(k=>!['id','name','notes','ruleKey','disabled'].includes(k)))) throw new Error("Invalid Perk edit.");
        patch = {...patch, perks:patch.perks.map(p=>({...p,ruleKey:p.ruleKey||null,disabled:Boolean(p.disabled)}))};
        const perkFields = entries => entries.map(p=>({id:p.id,name:p.name,notes:p.notes,ruleKey:p.ruleKey||null,disabled:Boolean(p.disabled)}));
        if (hasUnresolvedCheck(draft) && JSON.stringify(perkFields(patch.perks)) !== JSON.stringify(perkFields(c.perks))) throw new Error("Resolve the pending Check before changing Perks.");
      }
      Object.assign(c, JSON.parse(JSON.stringify(patch)));
      if (typeof c.name === "string") c.name = c.name.trim();
      for (const a of c.aspects) { delete c.strain[a.name]; c.strain[a.id] = Number(a.strained); }
    }, draft => `${draft.characters.find(c => c.id === id).name} — Host saved character sheet (${Object.keys(patch).join(", ")})`);
  }
  function setStrain(id, aspectId, strained) {
    return commit(draft => {
      blockIfPending(draft);
      const c = draft.characters.find(c => c.id === id), a = c && Rules.getAspect(c, aspectId);
      if (!a || typeof strained !== "boolean") throw new Error("Invalid Aspect Strain.");
      Rules.setAspectStrain(c, aspectId, strained);
    }, draft => `${draft.characters.find(c => c.id === id).name} — ${strained ? "Added" : "Removed"} Strain: ${Rules.getAspect(draft.characters.find(c => c.id === id), aspectId).name}`);
  }
  function useStrainRelief(id, aspectId) {
    return commit(draft => {
      blockIfPending(draft);
      const c = draft.characters.find(c => c.id === id), a = c && Rules.getAspect(c, aspectId);
      if (draft.storyCharacterCount !== 3 || !c?.active || c.strainReliefUsed || !a?.strained) throw new Error("Small-group Strain Relief is not available.");
      Rules.removeStrain(c, aspectId); c.strainReliefUsed = true;
    }, "Used once-per-story three-character Strain Relief");
  }
  function setStoryCharacterCount(count) {
    return commit(draft => {
      blockIfPending(draft);
      if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error("Story size must be 1–6.");
      // Explicit correction; never silently kill or revive on group configuration.
      if (draft.characters.some(c => c.active && c.wounds >= Rules.getDeathThreshold({ ...draft, storyCharacterCount: count }, c))) throw new Error("Correct Wounds before lowering the death threshold.");
      draft.storyCharacterCount = count;
    }, `Story character count set to ${count}`);
  }

  function formatDraw(check) {
    if (!check) return "";
    return check.dice.map((die) => `${die.type}${die.source === "forced" ? " (Forced)" : " (Bag)"}`).join(" / ");
  }

  function formatRoll(roll) {
    if (!roll) return "";
    return `${roll.dice.map((die) => `${die.source === "forced" ? "Forced " : ""}${die.type} ${die.result}`).join(" / ")}; total ${roll.total}; ${roll.result}`;
  }

  const api = {
    exportCharacter, importCharacter, activatePerk, setPerkDisabled, advanceScene, editCharacter, setStrain, useStrainRelief, setStoryCharacterCount,
    setSetting,
    addCharacter,
    selectCharacter,
    renameCharacter,
    removeCharacter,
    hasUnresolvedCheck,
    normalizeState,
    STORAGE_KEY,
    SCHEMA_VERSION,
    defaultState,
    getState,
    resetGame,
    importState,
    validateState,
    clearLog,
    setAct,
    addOmenToBag,
    removeOmenFromBag,
    applyManual,
    drawCheck,
    rollCheck,
    rerollCheck,
    chooseRoll,
    finishCheck,
    cancelCheck,
    takeWound,
    cheatDeath,
    valiantSacrifice,
    reviveCharacter,
    recordStrain,
    getMode: () => mode,
    enterMultiplayer(snapshot, dispatcher) {
      state = normalizeState(snapshot);
      transport = dispatcher;
      mode = "multiplayer";
      return getState();
    },
    receiveSharedState(snapshot) {
      if (mode !== "multiplayer") throw new Error("Not in multiplayer mode.");
      state = normalizeState(snapshot);
      return getState();
    },
    leaveMultiplayer() {
      transport = null;
      mode = "solo";
      state = loadState();
      return getState();
    },
  };
  // Keep synchronous solo APIs; multiplayer dispatch never writes the solo save.
  const mutations = ["importCharacter","activatePerk", "setPerkDisabled", "advanceScene", "editCharacter", "setStrain", "useStrainRelief", "setStoryCharacterCount", "setSetting", "addCharacter", "selectCharacter", "renameCharacter", "removeCharacter", "resetGame", "importState", "clearLog", "setAct", "addOmenToBag", "removeOmenFromBag", "applyManual", "drawCheck", "rollCheck", "rerollCheck", "chooseRoll", "finishCheck", "cancelCheck", "takeWound", "cheatDeath", "valiantSacrifice", "reviveCharacter", "recordStrain"];
  for (const action of mutations) {
    const local = api[action];
    api[action] = (...args) => mode === "multiplayer" ? transport(action, args, getState()) : local(...args);
  }
  return api;
});
