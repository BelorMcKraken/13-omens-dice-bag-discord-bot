(function () {
  "use strict";

  const Rules = window.ThirteenOmensRules;
  const Store = window.ThirteenOmensState;
  const $ = (selector) => document.querySelector(selector);
  const els = {};

  document.addEventListener("DOMContentLoaded", init);
  window.ThirteenOmensApp = { render, checkMarkup, updateCheckMath };

  function init() {
    [
      "characterList", "addCharacter", "characterLimit", "characterName", "characterLock", "strainSummary", "checkingFor", "checkSnapshot", "manualCharacter", "manualCheatDeath", "manualStrain", "autoApplyStrainFlaw", "lockActDuringPendingCheck", "automaticSources", "totalFlaws", "aspectName", "allowPlayerRating",
      "actSelect",
      "actDisplay",
      "safeCount",
      "omenCount",
      "hostCount",
      "woundCount",
      "totalBag",
      "safePips",
      "omenPips",
      "woundPips",
      "autoFlaw",
      "cheatStatus",
      "characterStatus",
      "aspect",
      "baseTn",
      "manualTn",
      "difficulty",
      "finalTn",
      "edgeCount",
      "flawCount",
      "declaredEdges",
      "declaredFlaws",
      "netResult",
      "drawCount",
      "forcedOmen",
      "risky",
      "harmless",
      "resultPanel",
      "historyList",
      "integrity",
      "manualSafe",
      "manualOmen",
      "manualHost",
      "manualWounds",
      "manualAct",
      "manualStatus",
      "importText",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    populateSelects();
    els.aspect.value = "Average";
    els.difficulty.value = "0";
    bindEvents();
    render();
  }

  function populateSelects() {
    Object.entries(Rules.ASPECTS).forEach(([name, tn]) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = `${name} (TN ${tn})`;
      els.aspect.append(option);
    });
    Object.entries(Rules.DIFFICULTIES).forEach(([name, mod]) => {
      const option = document.createElement("option");
      option.value = String(mod);
      option.textContent = `${name} ${mod >= 0 ? "+" : ""}${mod}`;
      els.difficulty.append(option);
    });
    Rules.ACTS.forEach((act) => {
      [els.actSelect, els.manualAct].forEach((select) => {
        const option = document.createElement("option");
        option.value = act;
        option.textContent = act;
        select.append(option);
      });
    });
  }

  function bindEvents() {
    els.addCharacter.addEventListener("click", () => safeAction(Store.addCharacter));
    $("#renameCharacter").addEventListener("click", () => safeAction(() => Store.renameCharacter(Store.getState().selectedCharacterId, els.characterName.value)));
    $("#removeCharacter").addEventListener("click", () => safeAction(() => Store.removeCharacter(Store.getState().selectedCharacterId)));
    els.manualCharacter.addEventListener("change", () => renderManualCharacter(Store.getState()));
    ["autoApplyStrainFlaw", "lockActDuringPendingCheck"].forEach((key) => els[key].addEventListener("change", () => safeAction(() => Store.setSetting(key, els[key].checked))));
    els.actSelect.addEventListener("change", () => safeAction(() => Store.setAct(els.actSelect.value)));
    $("#addOmen").addEventListener("click", () => safeAction(Store.addOmenToBag));
    $("#removeOmen").addEventListener("click", () => safeAction(Store.removeOmenFromBag));
    $("#newGame").addEventListener("click", () => {
      if (confirm("Start a new game and erase the saved state?")) {
        safeAction(Store.resetGame);
      }
    });
    $("#clearLog").addEventListener("click", () => {
      if (confirm("Clear the session history log?")) safeAction(Store.clearLog);
    });
    $("#exportState").addEventListener("click", exportState);
    $("#importState").addEventListener("click", importState);
    $("#applyManual").addEventListener("click", applyManual);
    $("#revive").addEventListener("click", () => safeAction(Store.reviveCharacter));
    $("#reachBag").addEventListener("click", drawCheck);
    $("#rollDice").addEventListener("click", () => safeAction(Store.rollCheck));
    $("#reroll").addEventListener("click", () => safeAction(Store.rerollCheck));
    $("#useOriginal").addEventListener("click", () => safeAction(() => Store.chooseRoll("original")));
    $("#useReroll").addEventListener("click", () => safeAction(() => Store.chooseRoll("reroll")));
    $("#finishCheck").addEventListener("click", () => safeAction(Store.finishCheck));
    $("#cancelCheck").addEventListener("click", () => {
      if (confirm("Cancel this pending Check and restore temporary dice?")) safeAction(Store.cancelCheck);
    });
    $("#takeWound").addEventListener("click", () => safeAction(Store.takeWound));
    $("#cheatDeath").addEventListener("click", () => safeAction(Store.cheatDeath));
    $("#valiant").addEventListener("click", () => safeAction(Store.valiantSacrifice));
    $("#recordStrain").addEventListener("click", () => safeAction(() => Store.recordStrain(getCheckOptions().aspect)));
    $("#edgeMinus").addEventListener("click", () => stepCounter(els.edgeCount, -1, 0, 2));
    $("#edgePlus").addEventListener("click", () => stepCounter(els.edgeCount, 1, 0, 2));
    $("#flawMinus").addEventListener("click", () => stepCounter(els.flawCount, -1, 0, 2));
    $("#flawPlus").addEventListener("click", () => stepCounter(els.flawCount, 1, 0, 2));
    [els.aspectName, els.aspect, els.manualTn, els.baseTn, els.difficulty, els.edgeCount, els.flawCount, els.forcedOmen].forEach((input) => {
      input.addEventListener("input", updateCheckMath);
      input.addEventListener("change", updateCheckMath);
    });
  }

  function safeAction(action) {
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        result.catch((error) => alert(error.message)).finally(render);
        return;
      }
    } catch (error) {
      alert(error.message);
    }
    render();
  }

  function stepCounter(input, delta, min, max) {
    input.value = Rules.clampInteger(input.value, min, max) + delta;
    input.value = Rules.clampInteger(input.value, min, max);
    updateCheckMath();
  }

  function getCheckOptions() {
    const baseTn = els.manualTn.checked ? els.baseTn.value : Rules.getTargetNumberForRating(els.aspect.value);
    return {
      aspect: els.aspectName.value.trim() || els.aspect.value,
      rating: els.aspect.value,
      manualTn: els.manualTn.checked,
      baseTn,
      difficultyModifier: Number(els.difficulty.value),
      edges: Number(els.edgeCount.value),
      flaws: Number(els.flawCount.value),
      forcedOmen: els.forcedOmen.checked,
      risky: els.risky.checked,
      harmless: els.harmless.checked,
      ...(window.ThirteenOmensSheet?.options(Store.getState(), els.manualTn.checked, els.baseTn.value) || {}),
    };
  }

  function updateCheckMath() {
    const state = Store.getState();
    const options = getCheckOptions();
    els.baseTn.value = Rules.clampInteger(options.baseTn, 1, 30);
    els.baseTn.disabled = !els.manualTn.checked;
    const sources = Rules.automaticFlawSources(state, options.aspectId || options.aspect);
    const automaticFlaws = sources.wounds + sources.strain;
    const preview=Rules.refreshCheckModifiers(state,{characterId:state.selectedCharacterId,act:state.act,configuration:options,automaticFlaws:sources,perkActivations:[]});
    const composition = preview.composition;
    els.finalTn.textContent = Rules.determineFinalTN(options.baseTn, options.difficultyModifier);
    els.declaredEdges.textContent = options.edges;
    els.declaredFlaws.textContent = options.flaws;
    els.automaticSources.textContent = [sources.wounds ? "+1 from 3 Wounds" : "", sources.strain ? `+1 from ${options.aspect} Strain` : "", options.forcedOmen ? "+1 Forced Omen" : "", ...preview.modifierSources.filter(s=>s.kind==="cancel").map(s=>`−${s.amount} ${s.name}`)].filter(Boolean).join("; ") || "None";
    els.totalFlaws.textContent = composition.totalFlaws;
    els.netResult.textContent =
      composition.resolutionMode === "NORMAL"
        ? "Normal Check"
        : `${composition.net.magnitude} net ${composition.resolutionMode === "EDGE" ? "Edge" : "Flaw"}`;
    els.drawCount.textContent = `${composition.bagDiceToDraw} bag${options.forcedOmen ? " + 1 Forced Omen" : ""}`;
  }

  function drawCheck() {
    safeAction(() => {
      const state = Store.getState();
      if (Store.getMode() === "multiplayer") return window.ThirteenOmensMultiplayer.callCheck(getCheckOptions());
      return Store.drawCheck(getCheckOptions());
    });
  }

  function applyManual() {
    const state = Store.getState();
    if (state.currentCheck && state.currentCheck.phase !== Rules.PHASE_RESOLVED) {
      alert("Cancel or resolve the pending Check before using Host Tools.");
      return;
    }
    const values = {
      characterId: els.manualCharacter.value,
      cheatDeathUsed: els.manualCheatDeath.checked,
      strain: null,
      safe: els.manualSafe.value,
      omen: els.manualOmen.value,
      host: els.manualHost.value,
      wounds: els.manualWounds.value,
      act: els.manualAct.value,
      active: els.manualStatus.value,
    };
    safeAction(() => { values.strain = JSON.parse(els.manualStrain.value); return Store.applyManual(values); });
  }

  function exportState() {
    els.importText.value = JSON.stringify(Store.getState(), null, 2);
    els.importText.focus();
    els.importText.select();
  }

  function importState() {
    safeAction(() => Store.importState(JSON.parse(els.importText.value)));
  }

  function render() {
    const state = Store.getState();
    renderCharacters(state);
    window.ThirteenOmensPerkUI?.render(document.getElementById("soloPerks"),state);
    window.ThirteenOmensSheet?.configure(state);
    window.ThirteenOmensSheet?.render(document.getElementById("hostSheet"), state, Rules.getCharacter(state), true, window.ThirteenOmensMultiplayer?.assignment(state.selectedCharacterId) || "Unassigned");
    const pending = Store.hasUnresolvedCheck(state);
    els.actSelect.disabled = pending && state.settings.lockActDuringPendingCheck;
    els.manualAct.disabled = pending && state.settings.lockActDuringPendingCheck;
    ["applyManual", "manualWounds", "manualStatus", "manualStrain", "manualCheatDeath", "manualSafe", "manualOmen", "manualHost", "revive", "recordStrain", "addOmen", "removeOmen"].forEach((id) => $(`#${id}`).disabled = pending);
    $("#reachBag").disabled = pending || !Rules.getCharacter(state).active;
    els.autoApplyStrainFlaw.checked = state.settings.autoApplyStrainFlaw;
    els.lockActDuringPendingCheck.checked = state.settings.lockActDuringPendingCheck;
    els.actSelect.value = state.act;
    els.actDisplay.textContent = state.act.toUpperCase();
    els.safeCount.textContent = state.bag.safe;
    els.omenCount.textContent = state.bag.omen;
    els.hostCount.textContent = state.hostOmens;
    els.woundCount.textContent = Rules.getCharacter(state).wounds;
    els.totalBag.textContent = state.bag.safe + state.bag.omen;
    els.safePips.innerHTML = pips(state.bag.safe, "safe-dot");
    els.omenPips.innerHTML = pips(state.bag.omen, "omen-dot");
    els.woundPips.innerHTML = woundPips(Rules.getCharacter(state).wounds, Rules.getDeathThreshold(state, Rules.getCharacter(state)));
    els.autoFlaw.textContent = Rules.getAutomaticWoundFlaw(Rules.getCharacter(state)) ? "Yes, +1 Flaw" : "No";
    els.cheatStatus.textContent = Rules.Perks.hasPerk(Rules.getCharacter(state),"the-truth") ? "Forbidden — The Truth" : Rules.getCharacter(state).cheatDeathUsed ? "Used" : "Available";
    els.characterStatus.textContent = Rules.getCharacter(state).active ? "Active" : "Dead / Despair";
    els.characterStatus.className = Rules.getCharacter(state).active ? "status-active" : "status-dead";
    els.manualSafe.value = state.bag.safe;
    els.manualOmen.value = state.bag.omen;
    els.manualHost.value = state.hostOmens;
    renderManualCharacter(state);
    els.manualAct.value = state.act;

    els.integrity.textContent = Rules.validateOmenEconomy(state)
      ? `Omen economy intact: ${Rules.getTotalOmenDice(state)}`
      : `Warning: Omen economy is ${Rules.getTotalOmenDice(state)}, not 13`;
    renderResult(state);
    renderHistory(state);
    updateCheckMath();
    window.ThirteenOmensMultiplayer?.guard();
  }

  function renderCharacters(state) {
    const selected = Rules.getCharacter(state);
    const pending = Store.hasUnresolvedCheck(state);
    els.characterList.replaceChildren();
    state.characters.forEach((character) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${character.name} · ${character.archetype || "No archetype"} · ${character.wounds}/${Rules.getDeathThreshold(state, character)} Wounds · ${character.aspects.filter(a => a.strained).length} Strained · ${character.active ? "Active" : "FALLEN"} · ${window.ThirteenOmensMultiplayer?.assignment(character.id) || "Unassigned"}`;
      button.setAttribute("aria-pressed", String(character.id === selected.id));
      button.disabled = pending;
      button.addEventListener("click", () => safeAction(() => Store.selectCharacter(character.id)));
      els.characterList.append(button);
    });
    els.characterName.value = selected.name;
    els.addCharacter.disabled = state.characters.length >= 6;
    els.characterLimit.textContent = state.characters.length === 6 ? "Maximum 6 characters reached." : `${state.characters.length} of 6 characters`;
    $("#removeCharacter").disabled = state.characters.length === 1 || (pending && state.currentCheck.characterId === selected.id);
    els.characterLock.textContent = pending ? "Character selection and Check owner's removal are locked. Resolve or cancel the Check first." : "Removing a character returns their Wound Omens to the bag.";
    els.strainSummary.textContent = Object.entries(selected.strain).filter(([, value]) => value > 0).map(([name, value]) => `${name}: ${Number(value)}`).join(", ") || "None";
    els.checkingFor.textContent = `CHECKING FOR: ${selected.name}${selected.active ? "" : " — Inactive; reactivate through Host Tools"}`;
    const hostId = els.manualCharacter.value || selected.id;
    els.manualCharacter.replaceChildren();
    state.characters.forEach((character) => {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name;
      els.manualCharacter.append(option);
    });
    els.manualCharacter.value = state.characters.some((character) => character.id === hostId) ? hostId : selected.id;
    els.checkSnapshot.hidden = !state.currentCheck;
    if (state.currentCheck) {
      const check = state.currentCheck;
      const sources = check.automaticFlaws;
      els.checkSnapshot.textContent = `${Rules.getCharacter(state, check).name} — CHECK ACT: ${check.act.toUpperCase()} · Current Story Act: ${state.act.toUpperCase()} · Declared Flaws: ${check.configuration.flaws} · ${sources ? `Wounds: +${sources.wounds}; ${check.configuration.aspect} Strain: +${sources.strain}; ` : ""}Forced Omen: +${check.composition.forcedOmenFlaw} · Total Flaws: ${check.composition.totalFlaws}`;
    }
  }

  function renderManualCharacter(state) {
    const character = state.characters.find((entry) => entry.id === els.manualCharacter.value) || Rules.getCharacter(state);
    els.manualWounds.value = character.wounds;
    els.manualStatus.value = String(character.active);
    els.manualCheatDeath.checked = character.cheatDeathUsed;
    els.manualStrain.value = JSON.stringify(character.strain);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function pips(count, className) {
    if (count === 0) return '<span class="muted">none</span>';
    return Array.from({ length: count }, () => `<span class="pip ${className}" aria-hidden="true"></span>`).join("");
  }

  function woundPips(count, threshold) {
    return Array.from({ length: threshold }, (_, index) =>
      `<span class="wound-dot ${index < count ? "filled" : ""}" aria-label="${index < count ? "Wound" : "Empty wound slot"}"></span>`
    ).join("");
  }

  function checkMarkup(check) {
    if (!check) return '<p class="muted">No Check pending.</p>';
    if (check.phase === Rules.PHASE_REQUESTED) return '<div class="notice calm"><strong>THE HOST CALLS FOR A CHECK.</strong> The Rating and TN come from the character sheet. Reach into the bag when ready. No dice have been drawn.</div>';
    if (check.phase === Rules.PHASE_DRAWN) return `
      <div class="notice calm"><strong>DRAWN FROM THE BAG:</strong> dice types are known. No d6 results have been rolled.</div>
      <div class="dice-row">${check.dice.map(dieCard).join("")}</div>
      ${check.valiantAvailable ? '<div class="notice danger">VALIANT SACRIFICE AVAILABLE — choose before rolling.</div>' : ""}`;
    if (check.valiantResolved) return `<div class="result-banner success"><span>VALIANT SACRIFICE</span><strong>Automatic Success</strong><small>No dice rolled</small></div><div class="dice-row">${check.dice.map(dieCard).join("")}</div>`;
    const selected = Rules.getSelectedRoll(check);
    if (!selected) return '<p class="muted">Waiting for the Check result.</p>';
    const woundMessage = selected.wound.triggered
      ? check.configuration.harmless
        ? '<div class="notice warning"><strong>HARMLESS OMEN RESULT:</strong> no Wound. Strain occurs.</div>'
        : `<div class="notice danger"><strong>WOUND TRIGGERED:</strong> ${selected.wound.qualifyingDice.length} qualifying Omen; ${selected.wound.selectedWoundDie.source === "forced" ? "Forced Omen" : "Bag Omen"} selected for bookkeeping. Check Act: ${escapeHtml(check.act)}.</div>`
      : '<div class="notice calm">No Omen Wound triggered.</div>';
    return `<div class="result-banner ${resultClass(selected.result)}"><span>${escapeHtml(selected.result)}</span><strong>Total ${selected.total}</strong><small>TN ${check.finalTn}</small></div>
      ${rollBlock("Original Result", check.originalRoll, check.selectedRoll === "original")}
      ${check.reroll ? rollBlock("Reroll Result", check.reroll, check.selectedRoll === "reroll") : ""}
      <p class="muted">${phaseSummary(check)}</p>${woundMessage}
      ${selected.riskyFailure ? '<div class="notice warning"><strong>RISKY FAILURE:</strong> Host chooses a consequence such as Strain, lost Gear, or used/broken Perk.</div>' : ""}`;
  }

  function renderResult(state) {
    const check = state.currentCheck;
    resetResultButtons();
    els.resultPanel.innerHTML = checkMarkup(check);
    if (!check) return;
    if (check.phase === Rules.PHASE_REQUESTED) { $("#cancelCheck").disabled = false; return; }
    if (check.phase === Rules.PHASE_DRAWN) {
      $("#rollDice").disabled = false;
      $("#valiant").disabled = !check.valiantAvailable;
      $("#cancelCheck").disabled = false;
      return;
    }
    if (check.valiantResolved) return;
    const selected = Rules.getSelectedRoll(check);
    $("#reroll").disabled = !check.originalRoll || Boolean(check.reroll) || check.phase === Rules.PHASE_RESOLVED;
    $("#useOriginal").disabled = !check.reroll || check.perkReroll || check.selectedRoll === "original" || check.phase === Rules.PHASE_RESOLVED;
    $("#useReroll").disabled = !check.reroll || check.perkReroll || check.selectedRoll === "reroll" || check.phase === Rules.PHASE_RESOLVED;
    $("#finishCheck").disabled = check.phase === Rules.PHASE_RESOLVED || (selected.wound.triggered && !check.configuration.harmless);
    $("#takeWound").disabled = !selected.wound.triggered || check.configuration.harmless || check.phase === Rules.PHASE_RESOLVED;
    $("#cheatDeath").disabled = !selected.wound.triggered || check.configuration.harmless || !Rules.canCheatDeath(state, check) || check.phase === Rules.PHASE_RESOLVED;
    $("#cancelCheck").disabled = check.phase === Rules.PHASE_RESOLVED;
  }

  function resetResultButtons() {
    ["rollDice", "reroll", "useOriginal", "useReroll", "finishCheck", "takeWound", "cheatDeath", "valiant", "cancelCheck"].forEach((id) => {
      $(`#${id}`).disabled = true;
    });
  }

  function rollBlock(title, roll, selected) {
    if (!roll) return "";
    return `
      <section class="reroll-block ${selected ? "selected-roll" : ""}">
        <h3>${title}${selected ? " - Selected" : ""}</h3>
        <div class="dice-row">${roll.dice.map(dieCard).join("")}</div>
        <p><strong>Total:</strong> ${roll.total} · <strong>${escapeHtml(roll.result)}</strong></p>
      </section>
    `;
  }

  function phaseSummary(check) {
    return `Phase ${check.phase}; bag draw ${check.composition.bagDiceToDraw}; Forced Omen ${check.forcedOmenCommitted ? "committed" : "no"}; resolution ${check.composition.resolutionMode}.`;
  }

  function dieCard(die) {
    const hasResult = die.result !== null && die.result !== undefined;
    const wound = die.type === "OMEN" && die.woundCandidate ? '<span class="tag danger-tag">WOUND THRESHOLD MET</span>' : "";
    const selectedWound = die.selectedWound ? '<span class="tag danger-tag">SELECTED WOUND DIE</span>' : "";
    return `
      <article class="die-card ${die.type === "OMEN" ? "omen-die" : "safe-die"}">
        <span class="die-type">${escapeHtml(die.type)}</span>
        <strong class="die-result">${hasResult ? die.result : "?"}</strong>
        <span class="tag">${escapeHtml(hasResult ? die.note || (die.used ? "USED" : "DISCARDED") : "NOT ROLLED")}</span>
        <small>${die.source === "forced" ? "FORCED / FACING EVIL" : "DRAWN FROM BAG"}</small>
        ${wound}
        ${selectedWound}
      </article>
    `;
  }

  function resultClass(result) {
    if (result === "FULL SUCCESS" || result === "VALIANT SACRIFICE") return "success";
    if (result === "SUCCESS WITH COMPLICATION") return "mixed";
    return "failure";
  }

  function renderHistory(state) {
    els.historyList.innerHTML = state.history
      .slice()
      .reverse()
      .map((entry) => `<li><time>${new Date(entry.time).toLocaleTimeString()}</time> ${escapeHtml(entry.text)}</li>`)
      .join("");
  }
})();
