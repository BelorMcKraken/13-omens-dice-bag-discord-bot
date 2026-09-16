(function () {
  "use strict";
  const Store = window.ThirteenOmensState;
  const $ = (id) => document.getElementById(id);
  const MODE_KEY = "thirteen-omens-app-mode-v1";
  let client, solo = false, loading, lastView, renderedGame, savedIdentityAvailable = false;
  function saveMode(mode) { try { localStorage.setItem(MODE_KEY, mode); } catch (_) { /* The game remains usable in memory. */ } }

  function message(error) { $("multiplayerError").textContent = error?.message || error || ""; }
  async function action(fn) {
    message("");
    try { await fn(); } catch (error) { message(error); }
  }
  function loadSocketIO() {
    if (window.io) return Promise.resolve();
    if (loading) return loading;
    if (!/^https?:$/.test(location.protocol)) return Promise.reject(new Error("Multiplayer needs the local Node server. Run npm start, then open http://localhost:3000. Solo Game works here."));
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/socket.io/socket.io.js";
      script.onload = resolve;
      script.onerror = () => { loading = null; script.remove(); reject(new Error("Unable to reach server. Start it with npm start.")); };
      document.head.append(script);
    });
    return loading;
  }
  async function network() {
    await loadSocketIO();
    if (!client) client = window.ThirteenOmensNetwork.createClient({ ioFactory: window.io, store: Store, storage: localStorage, onChange: render });
    solo = false;
    saveMode("multiplayer");
    return client;
  }

  function render(view = client?.view()) {
    lastView = view;
    const active = Boolean(view?.active);
    const room = view?.room;
    const player = view?.player;
    const host = player?.role === "HOST";
    $("mainMenu").hidden = active || solo;
    $("soloPerks").hidden = active;
    $("multiplayerLobby").hidden = !active;
    $("soloMenu").hidden = !solo;
    $("gameInterface").hidden = !(solo || (room && host));
    $("playerView").hidden = !(active && room && !host);
    $("multiplayerCheckPanel").hidden = !(active && room);
    $("reachBag").textContent = active ? "Call for Check" : "Reach Into The Bag";
    document.querySelector(".result-panel").hidden = active;
    guard();
    $("resumeMultiplayer").hidden = !(view?.canResume ?? savedIdentityAvailable);
    if (!active) { renderedGame = null; return; }
    $("connectionStatus").textContent = view.status === "connected" ? "● Connected" : view.status === "reconnecting" ? "○ Connection lost — reconnecting" : view.status === "connecting" ? "○ Connecting…" : "× Disconnected";
    $("multiplayerError").textContent = view.error || "";
    $("roomCodeDisplay").textContent = room?.code || "Connecting…";
    $("copyRoomCode").disabled = !room;
    $("myIdentity").textContent = player ? `${player.displayName} · ${player.role}` : "";
    if (!room) {
      $("playersList").replaceChildren();
      $("hostConnection").textContent = "Waiting for room state…";
      return;
    }
    $("hostConnection").textContent = room.players.find((entry) => entry.id === room.hostPlayerId)?.connected ? "Host connected" : "HOST DISCONNECTED — Waiting for Host to reconnect.";
    $("playersList").replaceChildren();
    for (const entry of room.players) {
      const row = document.createElement("div"); row.className = "lobby-player";
      const label = document.createElement("span");
      const character = room.gameState.characters.find((character) => character.id === entry.assignedCharacterId);
      label.textContent = `${entry.displayName} · ${entry.role} · ${entry.connected ? "Connected" : "Disconnected"} · ${character?.name || "Unassigned"}`;
      row.append(label);
      if (host) {
        const select = document.createElement("select"); select.setAttribute("aria-label", `Assign character to ${entry.displayName}`);
        const empty = document.createElement("option"); empty.value = ""; empty.textContent = "Unassigned"; select.append(empty);
        for (const character of room.gameState.characters) {
          const owner = room.players.find((other) => other.assignedCharacterId === character.id);
          const option = document.createElement("option"); option.value = character.id;
          option.textContent = `${character.name}${owner ? ` — assigned to ${owner.displayName}` : ""}`;
          option.disabled = Boolean(owner && owner.id !== entry.id); select.append(option);
        }
        select.value = entry.assignedCharacterId || "";
        const pending = room.gameState.currentCheck;
        select.disabled = view.status !== "connected" || view.busy || (pending && pending.phase !== "RESOLVED" && (pending.playerId === entry.id || entry.assignedCharacterId === pending.characterId));
        select.addEventListener("change", () => action(() => client.assign(entry.id, select.value || null)));
        row.append(select);
      }
      $("playersList").append(row);
    }
    const game = room.gameState;
    const assigned = game.characters.find((character) => character.id === player?.assignedCharacterId);
    window.ThirteenOmensSheet.render($("playerSheet"), game, assigned, !!game.settings.allowPlayerCharacterEdits && view.status === "connected", player?.displayName, false);
    $("playerGameSummary").textContent = `${game.act} · Bag: ${game.bag.safe} Safe / ${game.bag.omen} Omen · Host Omens: ${game.hostOmens}`;
    $("playerCharacterName").textContent = assigned?.name || "Unassigned — waiting for the Host";
    $("playerCharacterStatus").textContent = assigned ? `Wounds: ${assigned.wounds} · ${assigned.active ? "Active" : "Inactive"} · Cheat Death: ${window.ThirteenOmensRules.Perks.hasPerk(assigned,"the-truth") ? "Forbidden — The Truth" : assigned.cheatDeathUsed ? "Used" : "Available"}` : "You can observe the room while unassigned.";
    $("playerStrain").textContent = assigned ? `Strain: ${Object.entries(assigned.strain).filter(([, value]) => value > 0).map(([name, value]) => `${name}: ${Number(value)}`).join(", ") || "None"}` : "";
    const check = game.currentCheck;
    $("playerCheck").textContent = check ? `${game.characters.find((character) => character.id === check.characterId)?.name} — ${check.act} — ${check.phase}${check.valiantResolved ? " — Valiant Sacrifice: automatic success" : window.ThirteenOmensRules.getSelectedRoll(check) ? ` — Total ${window.ThirteenOmensRules.getSelectedRoll(check).total}: ${window.ThirteenOmensRules.getSelectedRoll(check).result}` : ""}` : "No Check pending.";
    $("roomActivity").replaceChildren();
    [...game.history, ...room.activity].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 100).forEach((entry) => {
      const item = document.createElement("li"); item.textContent = `${new Date(entry.time).toLocaleTimeString()} ${entry.text}`; $("roomActivity").append(item);
    });
    const version = `${room.code}:${room.gameVersion}`;
    if (renderedGame !== version) {
      window.ThirteenOmensApp.render();
      renderedGame = version;
    }
    renderCheck(view);
    guard();
  }

  function renderCheck(view) {
    const Rules = window.ThirteenOmensRules;
    const check = view.room.gameState.currentCheck;
    const player = view.player;
    if (!player) return;
    const host = player.role === "HOST";
    const pending = check && check.phase !== Rules.PHASE_RESOLVED;
    const controller = check && (host ? check.hostTakeover : !check.hostTakeover && check.playerId === player.id && player.assignedCharacterId === check.characterId);
    const ready = view.status === "connected" && !view.busy;
    window.ThirteenOmensPerkUI.render($("mpPerks"),view.room.gameState,{host,characterId:player.assignedCharacterId,ready:ready && (host || !pending || controller)});
    const requested = check?.phase === Rules.PHASE_REQUESTED;
    const drawn = check?.phase === Rules.PHASE_DRAWN;
    const rolled = Boolean(check && Rules.getSelectedRoll(check));
    const selected = check && Rules.getSelectedRoll(check);
    $("mpCheckResult").innerHTML = window.ThirteenOmensApp.checkMarkup(check);
    const buttons = {
      mpDraw: controller && requested,
      mpRoll: controller && drawn,
      mpReroll: host && controller && pending && rolled && !check.reroll,
      mpOriginal: host && controller && !check?.perkReroll && pending && check?.reroll && check.selectedRoll !== "original",
      mpUseReroll: host && controller && !check?.perkReroll && pending && check?.reroll && check.selectedRoll !== "reroll",
      mpWound: controller && check?.phase === Rules.PHASE_AWAITING_WOUND,
      mpCheat: controller && check?.phase === Rules.PHASE_AWAITING_WOUND && Rules.canCheatDeath(view.room.gameState, check),
      mpFinish: controller && pending && rolled && (!selected.wound.triggered || check.configuration.harmless),
      mpValiant: controller && drawn && check.valiantAvailable,
      mpCancel: host && pending,
      mpTakeover: host && pending && !check.hostTakeover,
    };
    for (const [id, allowed] of Object.entries(buttons)) { $(id).hidden = !allowed; $(id).disabled = !ready; }
    if (!check) {
      for (const id of ["mpCheckOwner", "mpCheckConditions", "mpCheckTN", "mpCheckWaiting"]) $(id).textContent = "";
      return;
    }
    const character = view.room.gameState.characters.find((entry) => entry.id === check.characterId);
    const owner = view.room.players.find((entry) => entry.id === check.playerId);
    const config = check.configuration;
    $("mpCheckOwner").textContent = `${character.name} — ${config.aspect} Check · Check Act: ${check.act} · Story Act: ${view.room.gameState.act}`;
    $("mpCheckConditions").textContent = `Difficulty: ${config.difficultyModifier >= 0 ? "+" : ""}${config.difficultyModifier} · Edges: ${config.edges} · Declared Flaws: ${config.flaws} · Risky: ${config.risky ? "Yes" : "No"} · Harmless: ${config.harmless ? "Yes" : "No"} · Facing Evil: ${config.forcedOmen ? "Yes" : "No"} · Wounds Flaw: +${check.automaticFlaws?.wounds || 0} · ${config.aspect} Strain Flaw: +${check.automaticFlaws?.strain || 0} · Total Flaws: ${check.composition.totalFlaws}`;
    $("mpCheckTN").textContent = `${config.rating || "Manual"} · Base TN: ${config.baseTn} · Final TN: ${check.finalTn}${config.manualTn ? " · Host manual TN (locked)" : " · From character sheet"}`;
    $("mpCheckWaiting").textContent = !pending ? "Check resolved." : check.hostTakeover ? "Host controls this Check on behalf of the character." : !owner?.connected ? "PLAYER DISCONNECTED — Waiting for reconnect. The Host can take over or cancel." : controller ? "Your Check — choose the next available action." : `Observing ${owner.displayName}'s Check. Waiting for ${requested ? "the Player to reach into the bag" : "their next action"}.`;
  }

  function guard() {
    $("gameControls").disabled = Boolean(lastView?.active && (lastView.status !== "connected" || lastView.busy || lastView.player?.role !== "HOST"));
  }

  document.addEventListener("DOMContentLoaded", () => {

    const checkButtons = { mpDraw: "draw", mpRoll: "roll", mpReroll: "reroll", mpFinish: "finish", mpWound: "take-wound", mpCheat: "cheat-death", mpValiant: "valiant-sacrifice", mpCancel: "cancel", mpTakeover: "takeover" };
    for (const [id, verb] of Object.entries(checkButtons)) $(id).addEventListener("click", () => action(() => client.check(`check:${verb}`)));
    $("mpOriginal").addEventListener("click", () => action(() => client.check("check:select-roll", { rollName: "original" })));
    $("mpUseReroll").addEventListener("click", () => action(() => client.check("check:select-roll", { rollName: "reroll" })));
    $("soloGame").addEventListener("click", () => { client?.leave(); solo = true; saveMode("solo"); Store.leaveMultiplayer(); window.ThirteenOmensApp.render(); render(); });
    $("backFromSolo").addEventListener("click", () => { solo = false; saveMode("menu"); render(); });
    $("createMultiplayer").addEventListener("click", () => action(async () => (await network()).create($("hostDisplayName").value.trim() || "Host")));
    $("joinMultiplayer").addEventListener("click", () => { $("joinForm").hidden = false; $("joinRoomCode").focus(); });
    $("joinForm").addEventListener("submit", (event) => { event.preventDefault(); action(async () => (await network()).join($("joinRoomCode").value.trim(), $("joinDisplayName").value.trim())); });
    $("resumeMultiplayer").addEventListener("click", () => action(async () => (await network()).resume()));
    $("leaveMultiplayer").addEventListener("click", () => { client?.leave(); solo = false; saveMode("menu"); render(); });
    $("copyRoomCode").addEventListener("click", () => action(async () => {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(lastView.room.code);
      else { const field = $("copyCodeFallback"); field.hidden = false; field.value = lastView.room.code; field.focus(); field.select(); message("Select and copy the room code above."); }
    }));
    let identity, savedMode;
    try { identity = localStorage.getItem(window.ThirteenOmensNetwork.IDENTITY_KEY); savedMode = localStorage.getItem(MODE_KEY); } catch (_) { /* Solo remains available. */ }
    solo = savedMode === "solo";
    savedIdentityAvailable = Boolean(identity);
    $("resumeMultiplayer").hidden = !identity;
    render();
    if (identity && savedMode !== "solo" && savedMode !== "menu" && /^https?:$/.test(location.protocol)) action(async () => (await network()).resume());
  });
  window.ThirteenOmensMultiplayer = { guard,
    assignment: id => { const p = lastView?.room?.players.find(p => p.assignedCharacterId === id); return p ? `${p.displayName} (${p.connected ? "Connected" : "Disconnected"})` : "Unassigned"; },
    callCheck: options => {
      const { rating, allowPlayerRating, aspect, baseTn, ...conditions } = options;
      return client.callCheck({ ...conditions, ...(options.manualTn ? { aspect, baseTn } : {}), characterId: Store.getState().selectedCharacterId });
    } };
})();
