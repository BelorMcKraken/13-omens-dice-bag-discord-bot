"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once, EventEmitter } = require("node:events");
const { io } = require("socket.io-client");
const { createServer } = require("../server/server.js");
const State = require("../js/state.js");
const { createClient, IDENTITY_KEY } = require("../js/socket.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
async function fixture(t) {
  const service = createServer({ log: () => {}, rng: (min) => min });
  service.server.listen(0, "127.0.0.1"); await once(service.server, "listening");
  const url = `http://127.0.0.1:${service.server.address().port}`;
  const clients = [];
  const make = (storage = memoryStorage()) => {
    const store = State.createStore({ storage });
    const views = [];
    const changes = new EventEmitter();
    const network = createClient({ ioFactory: io, url, store, storage, onChange: view => { views.push(view); changes.emit("view", view); } });
    clients.push(network);
    return { network, store, storage, views, changes };
  };
  t.after(async () => { clients.forEach(client => client.leave()); await new Promise(resolve => service.io.close(resolve)); });
  const host = make(); await host.network.create("Host");
  const bob = make(); await bob.network.join(host.network.view().room.code, "Bob");
  return { service, url, make, host, bob };
}

test("Multiplayer starts from server New Game, preserving independent solo save", async t => {
  const f = await fixture(t);
  const solo = State.defaultState(); solo.act = "Act 3"; solo.bag.omen = 4; solo.hostOmens = 9;
  const storage = memoryStorage({ [State.STORAGE_KEY]: JSON.stringify(solo) });
  const host = f.make(storage); await host.network.create("Other Host");
  assert.equal(host.store.getState().act, "Prologue"); assert.equal(host.store.getMode(), "multiplayer");
  await host.store.setAct("Act 1"); assert.equal(JSON.parse(storage.getItem(State.STORAGE_KEY)).act, "Act 3");
  host.network.leave(); assert.equal(host.store.getMode(), "solo"); assert.deepEqual(host.store.getState(), solo);
});
test("Client Host management dispatch synchronizes canonical server state", async t => {
  const f = await fixture(t); await f.host.store.addOmenToBag();
  const code=f.host.network.view().room.code;
  assert.equal(f.service.manager.rooms.get(code).gameState.bag.omen, 1);
  assert.equal(f.host.store.getState().bag.omen, 1);
});
test("Player store rejects Host mutations even before server validation", async t => {
  const f=await fixture(t); await assert.rejects(f.bob.store.setAct("Act 2"), /Host permission/);
  assert.equal(f.bob.store.getState().act, "Prologue");
});
test("Client Check APIs send actions to authoritative server", async t => {
  const f=await fixture(t); await f.host.store.setAct("Act 1");
  await f.host.network.assign(f.bob.network.view().player.id, f.host.store.getState().selectedCharacterId);
  await f.host.network.callCheck({characterId:f.host.store.getState().selectedCharacterId,aspectId:"courage",manualTn:false,edges:0,flaws:0,difficultyModifier:0,risky:false,harmless:false,forcedOmen:true});
  // Synchronize the receiving client through the actual room broadcast.
  if (!f.bob.store.getState().currentCheck) await once(f.bob.changes,"view");
  await f.bob.store.drawCheck();
  const id=f.bob.store.getState().currentCheck.id;
  await f.bob.store.rollCheck(); await f.bob.store.takeWound();
  const room=f.service.manager.rooms.get(f.host.network.view().room.code);
  assert.equal(room.gameState.currentCheck.id,id); assert.equal(room.gameState.characters[0].wounds,1);
  assert.equal(room.gameState.currentCheck.phase,"RESOLVED");
});

test("Player refresh restores same identity from localStorage", async t => {
  const f=await fixture(t); const before=f.bob.network.view().player;
  await f.host.network.assign(before.id,f.host.store.getState().selectedCharacterId);
  f.bob.network.leave(); const restored=f.make(f.bob.storage); await restored.network.resume();
  assert.equal(restored.network.view().player.id,before.id); assert.equal(restored.network.view().player.displayName,"Bob");
  assert.equal(restored.network.view().player.assignedCharacterId,f.host.store.getState().selectedCharacterId);
});
test("Host refresh restores Host and never pushes old local game", async t => {
  const f=await fixture(t); await f.host.store.setAct("Act 2"); const id=f.host.network.view().player.id;
  f.host.network.leave(); const restored=f.make(f.host.storage); await restored.network.resume();
  assert.equal(restored.network.view().player.id,id); assert.equal(restored.network.view().player.role,"HOST");
  assert.equal(restored.store.getState().act,"Act 2");
});
test("Invalid saved identity fails gracefully and is cleared", async t => {
  const f=await fixture(t); const storage=memoryStorage({[IDENTITY_KEY]:JSON.stringify({roomCode:f.host.network.view().room.code,playerId:"missing",reconnectToken:"a".repeat(64)})});
  const bad=f.make(storage); await assert.rejects(bad.network.resume(),/Unable to reconnect/);
  assert.equal(storage.getItem(IDENTITY_KEY),null); assert.equal(bad.network.view().status,"disconnected");
});
test("Server restart's missing room clears stale identity", async t => {
  const f=await fixture(t); const saved=JSON.parse(f.bob.storage.getItem(IDENTITY_KEY)); saved.roomCode="MISSING-1111";
  const broken=f.make(memoryStorage({[IDENTITY_KEY]:JSON.stringify(saved)})); await assert.rejects(broken.network.resume(),/Room not found/);
  assert.equal(broken.network.view().canResume,false);
});
test("Duplicate live identity replaces old session and prevents writes", async t => {
  const f=await fixture(t); const second=f.make(f.host.storage); await second.network.resume();
  assert.equal(f.host.network.view().status,"replaced");
  await assert.rejects(f.host.store.addOmenToBag(),/Connected Host/);
  await second.store.addOmenToBag(); assert.equal(second.store.getState().bag.omen,1);
});
test("Loss of server connection is visible and blocks stale mutations", async t => {
  const f=await fixture(t);
  await new Promise(resolve=>f.service.io.close(resolve));
  // Socket disconnect events arrive asynchronously; observe status through client notifications.
  if (f.host.network.view().status === "connected") await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.host.store.addOmenToBag(), /Connected Host|connection lost|Server did not confirm/);
  assert.notEqual(f.host.network.view().status,"connected");
  assert.match(f.host.network.view().error,/Connection lost|Unable to reach/);
});

test("Transport interruption reconnects automatically and clears stale error", async t => {
  const f=await fixture(t); const before=f.bob.network.view().player;
  await f.host.network.assign(before.id,f.host.store.getState().selectedCharacterId);
  const recovered=new Promise((resolve,reject)=>{
    let disconnected=false;
    const timer=setTimeout(()=>reject(new Error("Automatic reconnect timed out")),5000);
    f.bob.changes.on("view",view=>{
      if(view.status==="reconnecting") disconnected=true;
      if(disconnected && view.status==="connected") { clearTimeout(timer); resolve(view); }
    });
  });
  const room=f.service.manager.rooms.get(f.host.network.view().room.code);
  f.service.io.sockets.sockets.get(room.players.get(before.id).socketId).conn.close();
  const restored=await recovered;
  assert.equal(restored.player.id,before.id); assert.equal(restored.player.assignedCharacterId,f.host.store.getState().selectedCharacterId);
  assert.equal(restored.error,""); assert.equal(room.players.size,2);
});
