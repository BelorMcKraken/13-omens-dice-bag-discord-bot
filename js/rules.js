(function (root, factory) {
  const Perks = typeof module === "object" && module.exports ? require("./perks.js") : root.ThirteenOmensPerks;
  const api = factory(Perks);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ThirteenOmensRules = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Perks) {
  "use strict";

  const DIE_SAFE = "SAFE";
  const DIE_OMEN = "OMEN";
  const PHASE_REQUESTED = "AWAITING_PLAYER";
  const PHASE_DRAWN = "DRAWN";
  const PHASE_ROLLED = "ROLLED";
  const PHASE_AWAITING_WOUND = "AWAITING_WOUND_RESOLUTION";
  const PHASE_RESOLVED = "RESOLVED";
  const ACTS = ["Prologue", "Act 1", "Act 2", "Act 3"];
  const ASPECTS = { Great: 4, Good: 5, Average: 7, Bad: 9, Terrible: 10 };
  const DIFFICULTIES = { "Very Easy": -2, Easy: -1, Average: 0, Hard: 1, "Very Hard": 2 };

  function clampInteger(value, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
  }

  function nonnegativeInteger(value) {
    const number = Number(value || 0);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error("Flaws must be a nonnegative integer.");
    return number;
  }

  function getCharacter(state, check) {
    if (!state.characters) return state.character; // Legacy rules callers.
    const id = check && check.characterId || state.selectedCharacterId;
    const character = state.characters.find((entry) => entry.id === id);
    if (!character) throw new Error("Check character is missing.");
    return character;
  }

  const CORE_NAMES = ["Courage", "Evade", "Fight", "Luck", "Perception"];
  function defaultAspects() {
    return [...CORE_NAMES.map(name => ({ id: name.toLowerCase(), type: "core", name, rating: "Average", strained: false })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `story-${i + 1}`, type: "story", name: `Story Aspect ${i + 1}`, rating: "Average", strained: false }))];
  }
  function getAspect(character, id) { return character.aspects?.find(a => a.id === id); }
  function findAspect(character, key) { return character.aspects?.find(a => a.id === key || a.name === key); }
  function setAspectStrain(character, key, value) {
    const aspect = findAspect(character, key);
    if (aspect) { aspect.strained = Boolean(value); delete character.strain[aspect.name]; character.strain[aspect.id] = Number(Boolean(value)); }
    else character.strain[key] = value;
  }
  function getDeathThreshold(state, character) {
    if (Perks.hasPerk(character, "the-truth")) return 2;
    const count = state.storyCharacterCount;
    if (!count) return 4; // Standalone legacy rules callers.
    return count === 6 ? ((state.perishedCharacterIds || []).length >= 2 ? 3 : 2) : ({ 1: 6, 2: 5, 3: 4, 4: 4, 5: 3 })[count];
  }
  function getAutomaticWoundFlaw(character) { return !Perks.hasPerk(character, "carry-on") && character.active && character.wounds >= 3 ? 1 : 0; }
  function getWoundThreshold(character, act) { if (Perks.hasPerk(character, "the-truth")) return 1; return ({ "Act 1": 1, "Act 2": 2, "Act 3": 3 })[act] || 0; }
  function markPerished(state, character) {
    if (state.storyCharacterCount) state.perishedCharacterIds = [...new Set([...(state.perishedCharacterIds || []), character.id])];
    character.active = false;
  }

  function automaticFlawSources(state, aspect, check) {
    const character = getCharacter(state, check);
    return {
      wounds: getAutomaticWoundFlaw(character),
      strain: state.settings && state.settings.autoApplyStrainFlaw && (findAspect(character, aspect)?.strained || character.strain[aspect] > 0 || character.strain[findAspect(character, aspect)?.name] > 0) ? 1 : 0,
    };
  }

  function removeStrain(character, aspectId) {
    const aspect = getAspect(character, aspectId);
    if (!aspect?.strained) throw new Error("Choose a currently Strained Aspect.");
    setAspectStrain(character, aspectId, false);
  }
  function refreshCheckModifiers(state, check) {
    const c = getCharacter(state, check), config = check.configuration;
    const sources = [
      {name:'Host awarded',kind:'edge',amount:config.edges},
      {name:'Host declared',kind:'flaw',amount:config.flaws},
      {name:'Wound state',kind:'flaw',amount:check.automaticFlaws.wounds},
      {name:'Strain — '+config.aspect,kind:'flaw',amount:check.automaticFlaws.strain},
      {name:'Forced Omen',kind:'flaw',amount:Number(config.forcedOmen)}
    ];
    if (Perks.hasPerk(c,'chill-out') && config.aspectId==='courage') sources.push({name:'Chill Out',kind:'cancel',amount:1});
    if (Perks.hasPerk(c,'very-tired') && check.act==='Act 1') sources.push({name:'Very Tired',kind:'cancel',amount:1});
    for (const a of check.perkActivations || []) if (a.edge || a.cancel) sources.push({name:a.name,kind:a.edge?'edge':'cancel',amount:a.edge||a.cancel});
    // Track exactly which physical Flaw source was canceled, without removing its die identity.
    const flaws = sources.filter(s=>s.kind==='flaw').map(s=>({...s,remaining:s.amount}));
    let canceled=0;
    for (const s of sources.filter(s=>s.kind==='cancel')) {
      s.cancels=[]; let remaining=s.amount;
      for (const f of flaws) {const n=Math.min(remaining,f.remaining);if(n){s.cancels.push({name:f.name,amount:n});f.remaining-=n;remaining-=n;canceled+=n;}}
      s.amount-=remaining;
    }
    check.modifierSources=sources.filter(s=>s.amount);
    check.composition=calculateCheckComposition({...config,automaticFlaws:check.automaticFlaws.wounds+check.automaticFlaws.strain,
      perkEdges:sources.filter(s=>s.kind==='edge'&&s.name!=='Host awarded').reduce((n,s)=>n+s.amount,0),canceledFlaws:canceled});
    check.keepStrategy=(check.perkActivations||[]).some(a=>a.keep)?'highest-plus-lowest':check.composition.resolutionMode==='FLAW'?'lowest-two':check.composition.resolutionMode==='EDGE'?'highest-two':'normal';
    return check;
  }

  function randomInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error("Invalid random integer range.");
    const span = max - min + 1;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const maxUint = 0xffffffff;
      const limit = maxUint - (maxUint % span);
      const buffer = new Uint32Array(1);
      let value;
      do {
        crypto.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);
      return min + (value % span);
    }
    return min + Math.floor(Math.random() * span);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBagDice(bag) {
    const dice = [];
    for (let i = 0; i < bag.safe; i += 1) dice.push({ type: DIE_SAFE, source: "bag", result: null });
    for (let i = 0; i < bag.omen; i += 1) dice.push({ type: DIE_OMEN, source: "bag", result: null });
    return dice;
  }

  function calculateNetEdgesFlaws(edges, flaws) {
    const declaredEdges = nonnegativeInteger(edges);
    const declaredFlaws = nonnegativeInteger(flaws);
    const net = declaredEdges - declaredFlaws;
    return {
      declaredEdges,
      declaredFlaws,
      netEdges: Math.max(0, net),
      netFlaws: Math.max(0, -net),
      mode: net > 0 ? "EDGE" : net < 0 ? "FLAW" : "NORMAL",
      magnitude: Math.abs(net),
    };
  }

  function determineDrawCount(edges, flaws) {
    return 2 + calculateNetEdgesFlaws(edges, flaws).magnitude;
  }

  function calculateCheckComposition(options) {
    const ordinaryEdges = clampInteger(options.edges, 0, 2) + nonnegativeInteger(options.perkEdges);
    const ordinaryFlaws = clampInteger(options.flaws, 0, 2);
    const automaticFlaws = nonnegativeInteger(options.automaticFlaws);
    const forcedOmenIncluded = Boolean(options.forcedOmen);
    const forcedOmenFlaw = forcedOmenIncluded ? 1 : 0;
    const totalFlaws = Math.max(0, ordinaryFlaws + automaticFlaws + forcedOmenFlaw - nonnegativeInteger(options.canceledFlaws));
    const net = calculateNetEdgesFlaws(ordinaryEdges, totalFlaws);
    const totalPhysicalDice = 2 + net.magnitude;
    // Forced Omen is both a real guaranteed die and a Flaw. If an Edge cancels
    // that Flaw, the Omen remains and the random bag draw shrinks.
    const bagDiceToDraw = totalPhysicalDice - (forcedOmenIncluded ? 1 : 0);
    if (bagDiceToDraw < 0) throw new Error("Check composition would draw a negative number of bag dice.");
    return {
      ordinaryEdges,
      ordinaryFlaws,
      automaticFlaws,
      forcedOmenIncluded,
      forcedOmenFlaw,
      totalFlaws,
      net,
      resolutionMode: net.mode,
      totalPhysicalDice,
      bagDiceToDraw,
    };
  }

  function drawDice(bag, count, rng) {
    const dice = createBagDice(bag);
    if (count > dice.length) throw new Error(`Insufficient dice in bag: need ${count}, have ${dice.length}.`);
    const random = rng || randomInt;
    const drawn = [];
    for (let i = 0; i < count; i += 1) {
      const index = random(0, dice.length - 1);
      drawn.push({ ...dice.splice(index, 1)[0], id: `bag-${i}-${Date.now()}` });
    }
    return drawn;
  }

  function drawCheckDice(state, options, rng) {
    const character = getCharacter(state);
    if (!character.active) throw new Error("Inactive characters cannot make Checks. Reactivate through Host Tools first.");
    const automaticFlaws = options.automaticFlawSnapshot || automaticFlawSources(state, options.aspectId || options.aspect || "Average");
    const modifierCheck = {characterId:character.id,act:state.act,configuration:options,automaticFlaws,perkActivations:[]};
    refreshCheckModifiers(state,modifierCheck);
    const composition = options.compositionSnapshot || modifierCheck.composition;
    if (composition.bagDiceToDraw > state.bag.safe + state.bag.omen) {
      throw new Error(`Insufficient dice in bag: need ${composition.bagDiceToDraw}, have ${state.bag.safe + state.bag.omen}.`);
    }
    if (composition.forcedOmenIncluded && state.hostOmens < 1) throw new Error("No Host Omens are available for a Forced Omen.");

    const dice = drawDice(state.bag, composition.bagDiceToDraw, rng);
    if (composition.forcedOmenIncluded) {
      dice.push({ id: `forced-${Date.now()}`, type: DIE_OMEN, source: "forced", result: null });
    }
    const finalTn = determineFinalTN(options.baseTn, options.difficultyModifier);
    return {
      id: `check-${Date.now()}`,
      phase: PHASE_DRAWN,
      characterId: character.id,
      characterName: character.name,
      act: state.act,
      woundThreshold: getWoundThreshold(character, state.act),
      automaticFlaws,
      configuration: {
        aspect: options.aspect || "Average",
        ...(options.aspectId ? { aspectId: options.aspectId, rating: options.rating } : {}),
        baseTn: clampInteger(options.baseTn, 1, 30),
        difficultyModifier: clampInteger(options.difficultyModifier, -10, 10),
        edges: clampInteger(options.edges, 0, 2),
        flaws: clampInteger(options.flaws, 0, 2),
        forcedOmen: Boolean(options.forcedOmen),
        risky: Boolean(options.risky),
        harmless: Boolean(options.harmless),
      },
      composition,
      sceneNumber: state.sceneNumber, modifierSources: modifierCheck.modifierSources, keepStrategy: modifierCheck.keepStrategy, perkActivations: [],
      dice,
      originalRoll: null,
      reroll: null,
      selectedRoll: null,
      finalTn,
      valiantAvailable: character.active && character.wounds >= 3 && dice.some((die) => die.type === DIE_OMEN),
      forcedOmenCommitted: composition.forcedOmenIncluded,
      resolved: false,
    };
  }

  function rollDice(dice, rng) {
    const random = rng || randomInt;
    return dice.map((die, index) => ({
      id: die.id || `${die.type.toLowerCase()}-${die.source || "bag"}-${index}-${Date.now()}`,
      type: die.type,
      source: die.source || "bag",
      result: random(1, 6),
      used: false,
      note: "",
      woundCandidate: false,
    }));
  }

  function selectDiceForTotal(rolledDice, netMode) {
    const decorated = rolledDice.map((die, index) => ({ die, index }));
    let sorted;
    if (netMode === "highest-plus-lowest") { const ranked = decorated.slice().sort((a,b)=>a.die.result-b.die.result||a.index-b.index); sorted = [ranked[ranked.length-1], ranked[0]]; }
    else if (netMode === "EDGE") sorted = decorated.slice().sort((a, b) => b.die.result - a.die.result || a.index - b.index);
    else if (netMode === "FLAW") sorted = decorated.slice().sort((a, b) => a.die.result - b.die.result || a.index - b.index);
    else sorted = decorated.slice(0, 2);
    const usedIndexes = new Set(sorted.slice(0, 2).map((entry) => entry.index));
    return rolledDice.map((die, index) => ({
      ...die,
      used: usedIndexes.has(index),
      note: usedIndexes.has(index)
        ? "USED"
        : netMode === "EDGE"
          ? "DISCARDED BY EDGE"
          : netMode === "FLAW"
            ? "DISCARDED BY FLAW"
            : "DISCARDED",
    }));
  }

  function determineCheckResult(total, tn) {
    if (total > tn) return "FULL SUCCESS";
    if (total === tn) return "SUCCESS WITH COMPLICATION";
    return "FAILURE";
  }

  function woundThresholdForAct(act) {
    if (act === "Act 1") return 1;
    if (act === "Act 2") return 2;
    if (act === "Act 3") return 3;
    return 0;
  }

  function detectWound(rolledDice, act, snapshot) {
    const threshold = snapshot ?? woundThresholdForAct(act);
    if (threshold === 0) return { triggered: false, qualifyingDice: [], selectedWoundDie: null, threshold };
    const qualifyingDice = rolledDice
      .map((die, index) => ({ ...die, index }))
      .filter((die) => die.type === DIE_OMEN && die.result <= threshold);
    // Deterministic source bookkeeping: a bag Omen becomes the Wound before a
    // Forced Omen. The non-selected Omen returns/enters the bag as appropriate.
    const selectedWoundDie = qualifyingDice.find((die) => die.source === "bag") || qualifyingDice[0] || null;
    return { triggered: qualifyingDice.length > 0, qualifyingDice, selectedWoundDie, threshold };
  }

  function totalUsedDice(rolledDice) {
    return rolledDice.filter((die) => die.used).reduce((sum, die) => sum + die.result, 0);
  }

  function determineFinalTN(baseTn, difficultyModifier) {
    return clampInteger(baseTn, 1, 30) + clampInteger(difficultyModifier, -10, 10);
  }

  function buildRoll(check, act, dice, label) {
    const selectedDice = selectDiceForTotal(dice, check.keepStrategy === "highest-plus-lowest" ? check.keepStrategy : check.composition.resolutionMode);
    const total = totalUsedDice(selectedDice);
    const result = determineCheckResult(total, check.finalTn);
    const wound = detectWound(selectedDice, check.act || act, check.woundThreshold);
    const markedDice = selectedDice.map((die, index) => ({
      ...die,
      woundCandidate: wound.qualifyingDice.some((candidate) => candidate.index === index),
      selectedWound: Boolean(wound.selectedWoundDie && wound.selectedWoundDie.index === index),
    }));
    return { label, dice: markedDice, total, result, wound, riskyFailure: Boolean(check.configuration.risky && result === "FAILURE") };
  }

  function rollPendingCheck(check, act, rng) {
    if (check.phase !== PHASE_DRAWN) throw new Error("Only a drawn Check can be rolled.");
    const next = clone(check);
    next.originalRoll = buildRoll(next, act, rollDice(next.dice, rng), "Original");
    next.selectedRoll = "original";
    next.phase = next.originalRoll.wound.triggered && !next.configuration.harmless ? PHASE_AWAITING_WOUND : PHASE_ROLLED;
    next.resolved = !next.originalRoll.wound.triggered || next.configuration.harmless;
    return next;
  }

  function rerollPendingCheck(check, act, rng) {
    if (!check.originalRoll) throw new Error("Roll the Check before rerolling.");
    const next = clone(check);
    // Reroll changes only d6 faces; die types, sources, and the Forced Omen
    // transaction all stay fixed until final resolution.
    const diceTypes = next.dice.map((die) => ({ id: die.id, type: die.type, source: die.source }));
    next.reroll = buildRoll(next, act, rollDice(diceTypes, rng), "Reroll");
    next.selectedRoll = next.reroll.total > next.originalRoll.total ? "reroll" : "original";
    const selected = getSelectedRoll(next);
    next.phase = selected.wound.triggered && !next.configuration.harmless ? PHASE_AWAITING_WOUND : PHASE_ROLLED;
    next.resolved = !selected.wound.triggered || next.configuration.harmless;
    return next;
  }

  function selectRoll(check, rollName) {
    if (rollName !== "original" && rollName !== "reroll") throw new Error("Unknown roll selection.");
    if (rollName === "reroll" && !check.reroll) throw new Error("No reroll is available.");
    const next = clone(check);
    next.selectedRoll = rollName;
    const selected = getSelectedRoll(next);
    next.phase = selected.wound.triggered && !next.configuration.harmless ? PHASE_AWAITING_WOUND : PHASE_ROLLED;
    next.resolved = !selected.wound.triggered || next.configuration.harmless;
    return next;
  }

  function getSelectedRoll(check) {
    if (!check) return null;
    if (check.selectedRoll === "reroll") return check.reroll;
    return check.originalRoll;
  }

  function canCheatDeath(state, check) {
    const legacyDice = Array.isArray(check) ? check : null;
    const roll = legacyDice ? { wound: { triggered: true } } : getSelectedRoll(check);
    const dice = legacyDice || check.dice;
    return Boolean(
      getCharacter(state, check).active &&
        !getCharacter(state, check).cheatDeathUsed &&
        !Perks.hasPerk(getCharacter(state, check), "the-truth") &&
        dice.some((die) => die.type === DIE_SAFE && die.source === "bag") &&
        state.bag.safe > 0 &&
        (!roll || roll.wound.triggered)
    );
  }

  function forcedOmenShouldEnterBag(check, woundSource) {
    return Boolean(check.forcedOmenCommitted && woundSource !== "forced");
  }

  function finishNoWound(state, check) {
    const next = clone(state);
    if (forcedOmenShouldEnterBag(check, null)) next.bag.omen += 1;
    return next;
  }

  function resolveWound(state, check) {
    const next = clone(state);
    const roll = getSelectedRoll(check);
    const woundDie = roll && roll.wound.selectedWoundDie;
    if (!woundDie) return next;
    if (woundDie.source === "bag") next.bag.omen = Math.max(0, next.bag.omen - 1);
    if (forcedOmenShouldEnterBag(check, woundDie.source)) next.bag.omen += 1;
    getCharacter(next, check).wounds += 1;
    if (getCharacter(next, check).wounds >= getDeathThreshold(next, getCharacter(next, check))) {
      const returnedWounds = getCharacter(next, check).wounds;
      next.bag.omen += returnedWounds;
      getCharacter(next, check).wounds = 0;
      markPerished(next, getCharacter(next, check));
      getCharacter(next, check).statusMessage = "Death/despair claimed the character. Wound Omens returned to the bag.";
    }
    return next;
  }

  function resolveCheatDeath(state, check) {
    const next = clone(state);
    if (!canCheatDeath(next, check)) throw new Error("Cheat Death is not available for this Check.");
    next.bag.safe = Math.max(0, next.bag.safe - 1);
    getCharacter(next, check).cheatDeathUsed = true;
    getCharacter(next, check).safeDiceLost += 1;
    if (forcedOmenShouldEnterBag(check, null)) next.bag.omen += 1;
    return next;
  }

  function resolveHarmless(state, check, aspect) {
    const next = clone(state);
    const name = aspect || "Unassigned";
    setAspectStrain(getCharacter(next, check), check.configuration.aspectId || name, 1);
    if (forcedOmenShouldEnterBag(check, null)) next.bag.omen += 1;
    return next;
  }

  function resolveValiantSacrifice(state, check) {
    const next = clone(state);
    if (!check.valiantAvailable || check.phase !== PHASE_DRAWN) throw new Error("Valiant Sacrifice is available only after drawing and before rolling.");
    const woundOmens = getCharacter(next, check).wounds;
    next.bag.omen += woundOmens;
    if (check.forcedOmenCommitted) next.bag.omen += 1;
    getCharacter(next, check).wounds = 0;
    markPerished(next, getCharacter(next, check));
    getCharacter(next, check).statusMessage = "Valiant Sacrifice: automatic success, character removed from play.";
    return next;
  }

  function getTemporaryForcedOmens(state) {
    const check = state.currentCheck;
    return check && check.forcedOmenCommitted && check.phase !== PHASE_RESOLVED ? 1 : 0;
  }

  function getTotalOmenDice(state) {
    return state.bag.omen + state.hostOmens + (state.characters || [state.character]).reduce((sum, character) => sum + character.wounds, 0) + getTemporaryForcedOmens(state);
  }

  function validateOmenEconomy(state) {
    return getTotalOmenDice(state) === 13;
  }

  function buildCheck(state, options, rng) {
    const drawn = drawCheckDice(state, options, rng);
    return rollPendingCheck(drawn, state.act, rng);
  }

  function getTargetNumberForRating(rating) {
    if (!Object.hasOwn(ASPECTS, rating)) throw new Error("Invalid Aspect Rating.");
    return ASPECTS[rating];
  }
  return {
    Perks, refreshCheckModifiers, removeStrain, CORE_NAMES, defaultAspects, getAspect, findAspect, setAspectStrain, getDeathThreshold, getAutomaticWoundFlaw, getWoundThreshold, markPerished,
    getCharacter,
    automaticFlawSources,
    DIE_SAFE,
    DIE_OMEN,
    PHASE_REQUESTED,
    PHASE_DRAWN,
    PHASE_ROLLED,
    PHASE_AWAITING_WOUND,
    PHASE_RESOLVED,
    ACTS,
    ASPECTS, getTargetNumberForRating,
    DIFFICULTIES,
    clampInteger,
    randomInt,
    calculateNetEdgesFlaws,
    determineDrawCount,
    calculateCheckComposition,
    drawDice,
    drawCheckDice,
    rollDice,
    selectDiceForTotal,
    determineCheckResult,
    woundThresholdForAct,
    detectWound,
    canCheatDeath,
    determineFinalTN,
    totalUsedDice,
    rollPendingCheck,
    rerollPendingCheck,
    selectRoll,
    getSelectedRoll,
    finishNoWound,
    resolveWound,
    resolveCheatDeath,
    resolveHarmless,
    resolveValiantSacrifice,
    getTemporaryForcedOmens,
    getTotalOmenDice,
    validateOmenEconomy,
    buildCheck,
  };
});
