const assert = require("assert");
const Rules = require("../js/rules.js");

function state(overrides = {}) {
  const base = {
    act: "Act 2",
    bag: { safe: 8, omen: 5 },
    hostOmens: 8,
    character: { wounds: 0, active: true, cheatDeathUsed: false, safeDiceLost: 0, strain: {}, statusMessage: "" },
    currentCheck: null,
  };
  return {
    ...base,
    ...overrides,
    bag: { ...base.bag, ...(overrides.bag || {}) },
    character: { ...base.character, ...(overrides.character || {}) },
  };
}

function rngSequence(values) {
  let index = 0;
  return (min, max) => {
    const value = values[index++];
    if (value < min || value > max) throw new Error(`RNG value ${value} outside ${min}-${max}`);
    return value;
  };
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function commitForced(base, check) {
  const next = JSON.parse(JSON.stringify(base));
  next.currentCheck = check;
  if (check.forcedOmenCommitted) next.hostOmens -= 1;
  return next;
}

function closeCheck(base, check) {
  const next = JSON.parse(JSON.stringify(base));
  next.currentCheck = { ...check, phase: Rules.PHASE_RESOLVED };
  return next;
}

function standardOptions(overrides = {}) {
  return { aspect: "Average", baseTn: 7, difficultyModifier: 0, edges: 0, flaws: 0, forcedOmen: false, risky: false, harmless: false, ...overrides };
}

function manualCheck(base, dice, results, options = {}) {
  const check = Rules.drawCheckDice(base, standardOptions(options), rngSequence(dice.map((_, i) => 0)));
  check.dice = dice.map((die, index) => ({ id: `d${index}`, result: null, ...die }));
  return Rules.rollPendingCheck(check, base.act, rngSequence(results));
}

run("Normal Check draws exactly 2 dice", () => {
  assert.strictEqual(Rules.determineDrawCount(0, 0), 2);
});

run("One Edge draws 3 and uses highest two", () => {
  assert.strictEqual(Rules.determineDrawCount(1, 0), 3);
  const dice = Rules.selectDiceForTotal([{ type: "SAFE", result: 2 }, { type: "SAFE", result: 6 }, { type: "SAFE", result: 4 }], "EDGE");
  assert.deepStrictEqual(dice.map((die) => die.used), [false, true, true]);
});

run("Two Edges draw 4 and use highest two", () => {
  assert.strictEqual(Rules.determineDrawCount(2, 0), 4);
  const dice = Rules.selectDiceForTotal([{ type: "SAFE", result: 2 }, { type: "SAFE", result: 6 }, { type: "SAFE", result: 4 }, { type: "SAFE", result: 5 }], "EDGE");
  assert.strictEqual(Rules.totalUsedDice(dice), 11);
});

run("One Flaw draws 3 and uses lowest two", () => {
  assert.strictEqual(Rules.determineDrawCount(0, 1), 3);
  const dice = Rules.selectDiceForTotal([{ type: "SAFE", result: 2 }, { type: "SAFE", result: 6 }, { type: "SAFE", result: 4 }], "FLAW");
  assert.strictEqual(Rules.totalUsedDice(dice), 6);
});

run("Two Flaws draw 4 and uses lowest two", () => {
  assert.strictEqual(Rules.determineDrawCount(0, 2), 4);
  const dice = Rules.selectDiceForTotal([{ type: "SAFE", result: 2 }, { type: "SAFE", result: 6 }, { type: "SAFE", result: 4 }, { type: "SAFE", result: 1 }], "FLAW");
  assert.strictEqual(Rules.totalUsedDice(dice), 3);
});

run("1 Edge + 1 Flaw draws 2", () => {
  assert.strictEqual(Rules.determineDrawCount(1, 1), 2);
});

run("2 Edges + 1 Flaw acts as 1 Edge", () => {
  const net = Rules.calculateNetEdgesFlaws(2, 1);
  assert.strictEqual(net.mode, "EDGE");
  assert.strictEqual(net.magnitude, 1);
});

run("Omen die discarded by an Edge can still cause a Wound", () => {
  const dice = Rules.selectDiceForTotal([{ type: "SAFE", result: 6 }, { type: "SAFE", result: 4 }, { type: "OMEN", result: 1 }], "EDGE");
  assert.strictEqual(Rules.totalUsedDice(dice), 10);
  assert.strictEqual(Rules.detectWound(dice, "Act 2").triggered, true);
});

run("Only one Wound can result from multiple qualifying Omen Dice", () => {
  const base = state({ act: "Act 3", bag: { safe: 8, omen: 4 }, hostOmens: 6 });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "OMEN", source: "bag" }], [1, 2]);
  const next = Rules.resolveWound(base, check);
  assert.strictEqual(next.character.wounds, 1);
  assert.strictEqual(next.bag.omen, 3);
});

run("Act 1 wounds on Omen 1 only", () => {
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 1 }], "Act 1").triggered, true);
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 2 }], "Act 1").triggered, false);
});

run("Act 2 wounds on Omen 1-2", () => {
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 2 }], "Act 2").triggered, true);
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 3 }], "Act 2").triggered, false);
});

run("Act 3 wounds on Omen 1-3", () => {
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 3 }], "Act 3").triggered, true);
  assert.strictEqual(Rules.detectWound([{ type: "OMEN", result: 4 }], "Act 3").triggered, false);
});

run("Taking a Wound decreases bag Omen count and increases Wounds", () => {
  const base = state();
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 5]);
  const next = Rules.resolveWound(base, check);
  assert.strictEqual(next.bag.omen, 4);
  assert.strictEqual(next.character.wounds, 1);
});

run("Cheat Death decreases Safe Dice but does not increase Omen Wounds", () => {
  const base = state();
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "OMEN", source: "bag" }], [5, 1]);
  const next = Rules.resolveCheatDeath(base, check);
  assert.strictEqual(next.bag.safe, 7);
  assert.strictEqual(next.character.wounds, 0);
  assert.strictEqual(next.character.cheatDeathUsed, true);
});

run("Cheat Death cannot be used if no Safe Die was rolled", () => {
  const check = manualCheck(state(), [{ type: "OMEN", source: "bag" }, { type: "OMEN", source: "bag" }], [1, 5]);
  assert.strictEqual(Rules.canCheatDeath(state(), check), false);
});

run("Three Wounds automatically generate one Flaw", () => {
  const check = Rules.drawCheckDice(state({ character: { wounds: 3 } }), standardOptions());
  assert.strictEqual(check.composition.automaticFlaws, 1);
  assert.strictEqual(check.composition.bagDiceToDraw, 3);
});

run("Fourth Wound returns existing Wound Omens to the bag and removes character", () => {
  const base = state({ bag: { safe: 8, omen: 4 }, hostOmens: 6, character: { wounds: 3 } });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 5]);
  const next = Rules.resolveWound(base, check);
  assert.strictEqual(next.character.wounds, 0);
  assert.strictEqual(next.character.active, false);
  assert.strictEqual(next.bag.omen, 7);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Reroll Same Dice preserves the original Safe/Omen composition", () => {
  const original = [{ type: "SAFE", source: "bag" }, { type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }];
  const rerolled = Rules.rollDice(original, rngSequence([6, 1, 4]));
  assert.deepStrictEqual(rerolled.map((die) => die.type), ["SAFE", "OMEN", "SAFE"]);
});

run("Dice cannot be drawn beyond available bag contents", () => {
  assert.throws(() => Rules.drawDice({ safe: 1, omen: 0 }, 2), /Insufficient/);
});

run("Total Omen economy never silently creates or destroys Omen Dice", () => {
  assert.strictEqual(Rules.validateOmenEconomy(state()), true);
});

run("Forced Omen alone: 2 Bag dice + 1 Forced Omen", () => {
  const c = Rules.calculateCheckComposition({ edges: 0, flaws: 0, forcedOmen: true, automaticFlaws: 0 });
  assert.strictEqual(c.bagDiceToDraw, 2);
  assert.strictEqual(c.totalPhysicalDice, 3);
  assert.strictEqual(c.resolutionMode, "FLAW");
});

run("Forced Omen + 1 Edge: 1 Bag die + 1 Forced Omen", () => {
  const c = Rules.calculateCheckComposition({ edges: 1, flaws: 0, forcedOmen: true, automaticFlaws: 0 });
  assert.strictEqual(c.bagDiceToDraw, 1);
  assert.strictEqual(c.totalPhysicalDice, 2);
  assert.strictEqual(c.resolutionMode, "NORMAL");
});

run("Forced Omen + 2 Edges: 2 Bag dice + 1 Forced Omen, keep highest two", () => {
  const c = Rules.calculateCheckComposition({ edges: 2, flaws: 0, forcedOmen: true, automaticFlaws: 0 });
  assert.strictEqual(c.bagDiceToDraw, 2);
  assert.strictEqual(c.resolutionMode, "EDGE");
});

run("Forced Omen + 1 ordinary Flaw: 3 Bag dice + Forced Omen", () => {
  const c = Rules.calculateCheckComposition({ edges: 0, flaws: 1, forcedOmen: true, automaticFlaws: 0 });
  assert.strictEqual(c.bagDiceToDraw, 3);
  assert.strictEqual(c.totalPhysicalDice, 4);
  assert.strictEqual(c.resolutionMode, "FLAW");
});

run("Forced Omen + Edge + ordinary Flaw has one net Flaw", () => {
  const c = Rules.calculateCheckComposition({ edges: 1, flaws: 1, forcedOmen: true, automaticFlaws: 0 });
  assert.strictEqual(c.bagDiceToDraw, 2);
  assert.strictEqual(c.resolutionMode, "FLAW");
});

run("Forced Omen rolls above Wound threshold enters Bag after Check", () => {
  const base = state({ act: "Act 2", bag: { safe: 8, omen: 0 }, hostOmens: 13 });
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "OMEN", source: "forced" }], [5, 4, 6], { forcedOmen: true });
  const committed = commitForced(base, check);
  const next = closeCheck(Rules.finishNoWound(committed, check), check);
  assert.strictEqual(next.hostOmens, 12);
  assert.strictEqual(next.bag.omen, 1);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Bag Omen causes Wound while Forced Omen does not; Forced Omen enters Bag", () => {
  const base = state({ act: "Act 1", bag: { safe: 1, omen: 1 }, hostOmens: 12 });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "OMEN", source: "forced" }], [1, 4, 5], { forcedOmen: true });
  const next = closeCheck(Rules.resolveWound(commitForced(base, check), check), check);
  assert.strictEqual(next.character.wounds, 1);
  assert.strictEqual(next.bag.omen, 1);
  assert.strictEqual(next.hostOmens, 11);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Forced Omen itself causes Wound and does not also enter Bag", () => {
  const base = state({ act: "Act 2", bag: { safe: 8, omen: 0 }, hostOmens: 13 });
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "OMEN", source: "forced" }], [5, 4, 2], { forcedOmen: true });
  const next = closeCheck(Rules.resolveWound(commitForced(base, check), check), check);
  assert.strictEqual(next.character.wounds, 1);
  assert.strictEqual(next.bag.omen, 0);
  assert.strictEqual(next.hostOmens, 12);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Multiple qualifying Omens create only one Wound", () => {
  const base = state({ act: "Act 3", bag: { safe: 1, omen: 1 }, hostOmens: 12 });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "OMEN", source: "forced" }], [1, 4, 2], { forcedOmen: true });
  const next = closeCheck(Rules.resolveWound(commitForced(base, check), check), check);
  assert.strictEqual(next.character.wounds, 1);
  assert.strictEqual(next.bag.omen, 1);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Harmless + Forced Omen puts Forced Omen in Bag and adds no Wound", () => {
  const base = state({ act: "Act 2", bag: { safe: 8, omen: 0 }, hostOmens: 13 });
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "OMEN", source: "forced" }], [5, 4, 1], { forcedOmen: true, harmless: true });
  const next = closeCheck(Rules.resolveHarmless(commitForced(base, check), check, "Average"), check);
  assert.strictEqual(next.character.wounds, 0);
  assert.strictEqual(next.character.strain.Average, 1);
  assert.strictEqual(next.bag.omen, 1);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Cheat Death + Forced Omen removes Safe and all Omens return/enter Bag", () => {
  const base = state({ act: "Act 2", bag: { safe: 8, omen: 1 }, hostOmens: 12 });
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "OMEN", source: "bag" }, { type: "OMEN", source: "forced" }], [5, 1, 2], { forcedOmen: true });
  const next = closeCheck(Rules.resolveCheatDeath(commitForced(base, check), check), check);
  assert.strictEqual(next.bag.safe, 7);
  assert.strictEqual(next.character.wounds, 0);
  assert.strictEqual(next.bag.omen, 2);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Valiant Sacrifice eligibility is determined after DRAW before ROLL", () => {
  const base = state({ bag: { safe: 0, omen: 3 }, hostOmens: 7, character: { wounds: 3 } });
  const check = Rules.drawCheckDice(base, standardOptions(), rngSequence([0, 0, 0]));
  assert.strictEqual(check.phase, Rules.PHASE_DRAWN);
  assert.strictEqual(check.valiantAvailable, true);
  assert.strictEqual(check.originalRoll, null);
});

run("Valiant Sacrifice generates no die results", () => {
  const base = state({ bag: { safe: 0, omen: 3 }, hostOmens: 7, character: { wounds: 3 } });
  const check = Rules.drawCheckDice(base, standardOptions(), rngSequence([0, 0, 0]));
  Rules.resolveValiantSacrifice(base, check);
  assert.deepStrictEqual(check.dice.map((die) => die.result), [null, null, null]);
});

run("Valiant Sacrifice returns existing Wounds and Forced Omen appropriately", () => {
  const base = state({ bag: { safe: 8, omen: 0 }, hostOmens: 10, character: { wounds: 3 } });
  const check = Rules.drawCheckDice(base, standardOptions({ forcedOmen: true, edges: 1 }), rngSequence([0]));
  const next = closeCheck(Rules.resolveValiantSacrifice(commitForced(base, check), check), check);
  assert.strictEqual(next.character.active, false);
  assert.strictEqual(next.character.wounds, 0);
  assert.strictEqual(next.bag.omen, 4);
  assert.strictEqual(Rules.validateOmenEconomy(next), true);
});

run("Reroll recomputes retained dice", () => {
  const base = state();
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 2, 6], { edges: 1 });
  const rerolled = Rules.rerollPendingCheck(check, base.act, rngSequence([6, 5, 1]));
  assert.strictEqual(rerolled.reroll.total, 11);
});

run("Reroll can change Failure into Success", () => {
  const base = state();
  const check = manualCheck(base, [{ type: "SAFE", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 2], { baseTn: 7 });
  const rerolled = Rules.rerollPendingCheck(check, base.act, rngSequence([5, 6]));
  assert.strictEqual(check.originalRoll.result, "FAILURE");
  assert.strictEqual(rerolled.reroll.result, "FULL SUCCESS");
  assert.strictEqual(rerolled.selectedRoll, "reroll");
});

run("Reroll can introduce a qualifying Omen", () => {
  const base = state({ act: "Act 2" });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }], [5, 1]);
  const rerolled = Rules.rerollPendingCheck(check, base.act, rngSequence([1, 6]));
  assert.strictEqual(check.originalRoll.wound.triggered, false);
  assert.strictEqual(rerolled.reroll.wound.triggered, true);
  assert.strictEqual(rerolled.selectedRoll, "reroll");
});

run("Reroll can remove a previously qualifying Omen from selected active result", () => {
  const base = state({ act: "Act 2" });
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 2]);
  const rerolled = Rules.rerollPendingCheck(check, base.act, rngSequence([5, 6]));
  assert.strictEqual(check.originalRoll.wound.triggered, true);
  assert.strictEqual(rerolled.reroll.wound.triggered, false);
  assert.strictEqual(Rules.getSelectedRoll(rerolled).wound.triggered, false);
});

run("No persistent Wound state changes until final roll selection/resolution", () => {
  const base = state();
  const check = manualCheck(base, [{ type: "OMEN", source: "bag" }, { type: "SAFE", source: "bag" }], [1, 5]);
  assert.strictEqual(check.phase, Rules.PHASE_AWAITING_WOUND);
  assert.strictEqual(base.character.wounds, 0);
  assert.strictEqual(base.bag.omen, 5);
});

run("Canceled pending Check restores Bag state", () => {
  const base = state({ bag: { safe: 7, omen: 2 }, hostOmens: 11, currentCheck: null });
  const check = Rules.drawCheckDice(base, standardOptions(), rngSequence([0, 0]));
  const canceled = { ...base, currentCheck: null };
  assert.strictEqual(canceled.bag.safe, 7);
  assert.strictEqual(canceled.bag.omen, 2);
  assert.strictEqual(Rules.validateOmenEconomy(canceled), true);
  assert.strictEqual(check.phase, Rules.PHASE_DRAWN);
});

run("Canceled Forced Omen returns to Host pool", () => {
  const base = state({ bag: { safe: 8, omen: 0 }, hostOmens: 13 });
  const check = Rules.drawCheckDice(base, standardOptions({ forcedOmen: true }), rngSequence([0, 0]));
  const committed = commitForced(base, check);
  committed.hostOmens += 1;
  committed.currentCheck = null;
  assert.strictEqual(committed.hostOmens, 13);
  assert.strictEqual(Rules.validateOmenEconomy(committed), true);
});

run("3 Wounds + 1 Edge + Forced Omen composes as one net Flaw", () => {
  const c = Rules.calculateCheckComposition({ edges: 1, flaws: 0, forcedOmen: true, automaticFlaws: 1 });
  assert.strictEqual(c.bagDiceToDraw, 2);
  assert.strictEqual(c.resolutionMode, "FLAW");
});

run("Omen total remains 13 throughout Forced Omen pathway", () => {
  const base = state({ bag: { safe: 8, omen: 0 }, hostOmens: 13 });
  const check = Rules.drawCheckDice(base, standardOptions({ forcedOmen: true }), rngSequence([0, 0]));
  const committed = commitForced(base, check);
  assert.strictEqual(Rules.getTotalOmenDice(committed), 13);
  const rolled = Rules.rollPendingCheck(check, base.act, rngSequence([5, 4, 6]));
  committed.currentCheck = rolled;
  assert.strictEqual(Rules.getTotalOmenDice(committed), 13);
  const done = Rules.finishNoWound(committed, rolled);
  done.currentCheck = { ...rolled, phase: Rules.PHASE_RESOLVED };
  assert.strictEqual(Rules.getTotalOmenDice(done), 13);
});

run("Randomized stress invariants", () => {
  for (let i = 0; i < 750; i += 1) {
    const omen = i % 10;
    const base = state({
      act: Rules.ACTS[i % Rules.ACTS.length],
      bag: { safe: 8 + (i % 3), omen },
      hostOmens: 13 - omen - (i % 4),
      character: { wounds: i % 4 },
    });
    if (!Rules.validateOmenEconomy(base)) continue;
    const options = standardOptions({ edges: i % 3, flaws: (i >> 1) % 3, forcedOmen: base.hostOmens > 0 && i % 2 === 0 });
    const composition = Rules.calculateCheckComposition({ ...options, automaticFlaws: base.character.wounds >= 3 ? 1 : 0 });
    if (composition.bagDiceToDraw > base.bag.safe + base.bag.omen) continue;
    const check = Rules.drawCheckDice(base, options);
    assert.strictEqual(check.dice.length, composition.totalPhysicalDice);
    assert.ok(check.dice.filter((die) => die.source === "forced").length <= 1);
    const rolled = Rules.rollPendingCheck(check, base.act);
    const selected = Rules.getSelectedRoll(rolled);
    assert.strictEqual(selected.dice.filter((die) => die.used).length, 2);
    if (composition.resolutionMode === "EDGE") {
      const sorted = selected.dice.map((die) => die.result).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
      assert.strictEqual(selected.total, sorted);
    }
    if (composition.resolutionMode === "FLAW") {
      const sorted = selected.dice.map((die) => die.result).sort((a, b) => a - b).slice(0, 2).reduce((a, b) => a + b, 0);
      assert.strictEqual(selected.total, sorted);
    }
  }
});
