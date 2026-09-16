"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { io: connect } = require("socket.io-client");
const { once } = require("node:events");
const { RoomManager } = require("../server/room-manager.js");
const { createServer } = require("../server/server.js");
const State = require("../js/state.js");

function fixture() {
  const manager = new RoomManager();
  const { room, session: host } = manager.create("host-socket", { displayName: "Host" });
  const { session: bob } = manager.join("bob-socket", { roomCode: room.code, displayName: "Bob" });
  return { manager, room, host, bob, characterId: room.gameState.characters[0].id };
}
function action(f, name, args = []) { return f.manager.action("host-socket", { action: name, args, baseVersion: f.room.gameVersion }); }
function assign(f, playerId, characterId) { return f.manager.assign("host-socket", { playerId, characterId }); }
const rejects = (fn, code) => assert.throws(fn, (error) => error.code === code);

test("Host creates room with valid New Game state", () => { const f=fixture(); assert.equal(f.room.gameState.bag.safe,8); assert.equal(f.room.gameState.hostOmens,13); assert.equal(f.room.gameState.act,"Prologue"); assert.equal(f.room.gameState.characters.length,1); });
test("Room codes are readable and unique", () => { const m=new RoomManager(); const codes=new Set(); for(let i=0;i<100;i++) { const code=m.create(`s${i}`,{}).room.code; assert.match(code,/^[A-Z]+-\d{4}$/); codes.add(code); } assert.equal(codes.size,100); });
test("Join trims name and normalizes room code", () => { const f=fixture(); const {session}=f.manager.join("s",{roomCode:` ${f.room.code.toLowerCase()} `,displayName:" Sarah "}); assert.equal(f.room.players.get(session.playerId).displayName,"Sarah"); });
test("Nonexistent room gives readable error", () => rejects(()=>fixture().manager.join("s",{roomCode:"MISSING-1234",displayName:"Bob"}),"ROOM_NOT_FOUND"));
test("Player IDs are stable and independent of sockets", () => { const f=fixture(); assert.notEqual(f.bob.playerId,"bob-socket"); assert.match(f.bob.playerId,/^[a-f0-9-]{36}$/); });
test("Creator has Host role", () => { const f=fixture(); assert.equal(f.room.players.get(f.host.playerId).role,"HOST"); });
test("Joiner has Player role despite role spoofing attempts", () => { const f=fixture(); assert.equal(f.room.players.get(f.bob.playerId).role,"PLAYER"); rejects(()=>f.manager.join("evil",{roomCode:f.room.code,displayName:"Evil",role:"HOST"}),"INVALID_PAYLOAD"); });
test("Rooms have independent state and character IDs", () => { const f=fixture(); const b=f.manager.create("host2",{}).room; action(f,"addOmenToBag"); assert.equal(b.gameState.bag.omen,0); assert.notEqual(b.gameState.characters[0].id,f.characterId); });
test("Host can change Act", () => { const f=fixture(); action(f,"setAct",["Act 2"]); assert.equal(f.room.gameState.act,"Act 2"); });
test("Player cannot change Act", () => { const f=fixture(); rejects(()=>f.manager.action("bob-socket",{action:"setAct",args:["Act 2"],baseVersion:0}),"HOST_REQUIRED"); });
test("Player cannot add or remove Omens", () => { const f=fixture(); for(const name of ["addOmenToBag","removeOmenFromBag"]) rejects(()=>f.manager.action("bob-socket",{action:name,args:[],baseVersion:0}),"HOST_REQUIRED"); });
test("Player cannot unassign another player", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); rejects(()=>f.manager.assign("bob-socket",{playerId:f.bob.playerId,characterId:null}),"HOST_REQUIRED"); });
test("Malformed management payloads rejected without changes", () => { const f=fixture(); const before=f.manager.snapshot(f.room); for(const payload of [null,[],{}, {action:"setAct",args:["Act 4"],baseVersion:0}, {action:"__proto__",args:[],baseVersion:0}, {action:"drawCheck",args:[],baseVersion:0}, {action:"addCharacter",args:[],baseVersion:0,role:"HOST"}]) assert.throws(()=>f.manager.action("host-socket",payload)); assert.deepEqual(f.manager.snapshot(f.room),before); });
test("Host assigns character to Player", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,f.characterId); });
test("Assignment included in shared public snapshot", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); assert.equal(f.manager.snapshot(f.room).players.find(p=>p.id===f.bob.playerId).assignedCharacterId,f.characterId); });
test("Two Players cannot own one character", () => { const f=fixture(); const other=f.manager.join("s",{roomCode:f.room.code,displayName:"Sarah"}).session; assign(f,f.bob.playerId,f.characterId); rejects(()=>assign(f,other.playerId,f.characterId),"CHARACTER_ASSIGNED"); });
test("Host can unassign", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); assign(f,f.bob.playerId,null); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,null); });
test("Host can reassign to another character", () => { const f=fixture(); action(f,"addCharacter"); assign(f,f.bob.playerId,f.characterId); assign(f,f.bob.playerId,f.room.gameState.characters[1].id); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,f.room.gameState.characters[1].id); });
test("Disconnected player retains assignment and reserves it", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); f.manager.disconnect("bob-socket"); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,f.characterId); rejects(()=>assign(f,f.host.playerId,f.characterId),"CHARACTER_ASSIGNED"); });
test("Reconnect restores character assignment", () => { const f=fixture(); assign(f,f.bob.playerId,f.characterId); f.manager.disconnect("bob-socket"); f.manager.reconnect("new-bob",f.bob); assert.equal(f.manager.authorize("new-bob",false).player.assignedCharacterId,f.characterId); });
test("Disconnected player remains in room", () => { const f=fixture(); f.manager.disconnect("bob-socket"); assert.equal(f.room.players.size,2); assert.equal(f.room.players.get(f.bob.playerId).connected,false); });
test("Valid token reconnects a player", () => { const f=fixture(); f.manager.disconnect("bob-socket"); f.manager.reconnect("new-bob",f.bob); assert.equal(f.room.players.get(f.bob.playerId).connected,true); });
test("Reconnect preserves player ID", () => { const f=fixture(); const result=f.manager.reconnect("new-bob",f.bob); assert.equal(result.session.playerId,f.bob.playerId); assert.equal(f.room.players.size,2); });
test("Reconnect preserves display name", () => { const f=fixture(); f.manager.reconnect("new-bob",f.bob); assert.equal(f.manager.authorize("new-bob",false).player.displayName,"Bob"); });
test("Invalid reconnect token cannot steal identity", () => { const f=fixture(); rejects(()=>f.manager.reconnect("attacker",{...f.bob,reconnectToken:"a".repeat(64)}),"INVALID_SESSION"); assert.equal(f.manager.authorize("bob-socket",false).player.connected,true); });
test("Host reconnect retains Host role", () => { const f=fixture(); f.manager.disconnect("host-socket"); f.manager.reconnect("new-host",f.host); assert.equal(f.manager.authorize("new-host").player.role,"HOST"); });
test("Host reconnect never duplicates Host", () => { const f=fixture(); f.manager.reconnect("new-host",f.host); assert.equal([...f.room.players.values()].filter(p=>p.role==="HOST").length,1); });
test("Replaced socket loses permissions immediately; its disconnect is harmless", () => { const f=fixture(); f.manager.reconnect("new-host",f.host); rejects(()=>f.manager.authorize("host-socket"),"INVALID_SESSION"); assert.equal(f.manager.disconnect("host-socket"),null); assert.equal(f.room.players.get(f.host.playerId).connected,true); });
test("Tokens are private, cryptographic, and never in logs", () => { const logs=[]; const m=new RoomManager({log:line=>logs.push(line)}); const r=m.create("s",{}); assert.match(r.session.reconnectToken,/^[a-f0-9]{64}$/); const publicText=JSON.stringify(m.snapshot(r.room)); assert.ok(!publicText.includes(r.session.reconnectToken)); assert.ok(!publicText.includes("tokenHash")); assert.ok(!publicText.includes("socketId")); assert.ok(!logs.join().includes(r.session.reconnectToken)); });
test("Six players plus unassigned Host allowed, seventh rejected", () => { const f=fixture(); for(let i=0;i<5;i++) f.manager.join(`s${i}`,{roomCode:f.room.code,displayName:`P${i}`}); assert.equal(f.room.players.size,7); rejects(()=>f.manager.join("extra",{roomCode:f.room.code,displayName:"Extra"}),"ROOM_FULL"); rejects(()=>assign(f,f.host.playerId,f.characterId),"ROOM_FULL"); });
test("Assigned Host occupies one of six player places", () => { const f=fixture(); assign(f,f.host.playerId,f.characterId); for(let i=0;i<4;i++) f.manager.join(`s${i}`,{roomCode:f.room.code,displayName:`P${i}`}); rejects(()=>f.manager.join("extra",{roomCode:f.room.code,displayName:"Extra"}),"ROOM_FULL"); });
test("Server respects six-character and final-character limits", () => { const f=fixture(); assert.throws(()=>action(f,"removeCharacter",[f.characterId])); for(let i=0;i<5;i++) action(f,"addCharacter"); assert.throws(()=>action(f,"addCharacter")); assert.equal(f.room.gameState.characters.length,6); });
test("Removal clears assignment; reset clears obsolete assignments", () => { const f=fixture(); action(f,"addCharacter"); assign(f,f.bob.playerId,f.characterId); action(f,"removeCharacter",[f.characterId]); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,null); assign(f,f.bob.playerId,f.room.gameState.characters[0].id); action(f,"resetGame"); assert.equal(f.room.players.get(f.bob.playerId).assignedCharacterId,null); });
test("Stale Host snapshots are rejected atomically", () => { const f=fixture(); const original=structuredClone(f.room.gameState); action(f,"addOmenToBag"); rejects(()=>f.manager.checkState("host-socket",{gameState:original,baseVersion:0}),"SERVER_AUTHORITATIVE"); assert.equal(f.room.gameState.bag.omen,1); });
test("Player cannot replace shared state or import state", () => { const f=fixture(); rejects(()=>f.manager.checkState("bob-socket",{gameState:f.room.gameState,baseVersion:0}),"HOST_REQUIRED"); rejects(()=>f.manager.action("bob-socket",{action:"importState",args:[f.room.gameState],baseVersion:0}),"HOST_REQUIRED"); });
test("Invalid economy and malformed Check snapshots rejected", () => { const f=fixture(); for(const alter of [s=>s.hostOmens=12,s=>s.currentCheck={phase:"ROLLED"},s=>s.characters=[null]]) { const candidate=structuredClone(f.room.gameState); alter(candidate); assert.throws(()=>f.manager.checkState("host-socket",{gameState:candidate,baseVersion:0})); } assert.equal(f.room.gameVersion,0); });
test("Pass 1 Host snapshot submission is retired for authoritative Checks", () => { const f=fixture(); rejects(()=>f.manager.checkState("host-socket",{gameState:f.room.gameState,baseVersion:0}),"SERVER_AUTHORITATIVE"); assert.equal(f.room.gameState.currentCheck,null); });

test("Unknown sockets and cross-room assignment targets rejected", () => { const f=fixture(); rejects(()=>f.manager.authorize("fake"),"INVALID_SESSION"); const other=f.manager.create("other",{}); rejects(()=>assign(f,other.session.playerId,f.characterId),"PLAYER_NOT_FOUND"); });

async function live(t) {
  const service=createServer({log:()=>{}});
  service.server.listen(0,"127.0.0.1"); await once(service.server,"listening");
  const url=`http://127.0.0.1:${service.server.address().port}`;
  const clients=[];
  t.after(async()=>{ clients.forEach(client=>client.disconnect()); await new Promise(resolve=>service.io.close(resolve)); });
  async function client() {
    const socket=connect(url,{forceNew:true,reconnection:false}); clients.push(socket);
    socket.on("room:state",state=>socket.latest=state);
    await once(socket,"connect"); return socket;
  }
  async function send(socket,event,payload) {
    return new Promise((resolve,reject)=>socket.timeout(2000).emit(event,payload,(error,result)=>error?reject(error):resolve(result)));
  }
  async function waitState(socket,predicate) {
    if(predicate(socket.latest)) return socket.latest;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{socket.off("room:state",handler);reject(new Error("Missing synchronized state"));},2000);
      const handler=state=>{if(predicate(state)){clearTimeout(timer);socket.off("room:state",handler);resolve(state);}};
      socket.on("room:state",handler);
    });
  }
  const host=await client(); const created=await send(host,"room:create",{displayName:"Host"});
  const players=[];
  for(const displayName of ["Bob","Sarah","Mike"]) { const socket=await client(); const joined=await send(socket,"room:join",{roomCode:created.room.code,displayName}); players.push({socket,...joined}); }
  await waitState(host,s=>s?.players.length===4);
  const act=(action,args=[])=>send(host,"game:action",{action,args,baseVersion:host.latest.gameVersion});
  return {service,url,client,send,waitState,host,created,players,act};
}

test("Express serves app and Socket.IO while keeping server source private", async t=>{ const f=await live(t); assert.match(await (await fetch(f.url)).text(),/Create Multiplayer Game/); assert.equal((await fetch(`${f.url}/socket.io/socket.io.js`)).status,200); assert.equal((await fetch(`${f.url}/server/room-manager.js`)).status,404); });
test("Four real clients receive Act changes immediately", async t=>{ const f=await live(t); assert.equal((await f.act("setAct",["Act 2"])).ok,true); for(const p of f.players) await f.waitState(p.socket,s=>s?.gameState.act==="Act 2"); });
test("Four real clients receive Bag changes immediately", async t=>{ const f=await live(t); await f.act("addOmenToBag"); for(const p of f.players) await f.waitState(p.socket,s=>s?.gameState.bag.omen===1); });
test("Character Wound corrections synchronize to Players", async t=>{ const f=await live(t); const id=f.host.latest.gameState.selectedCharacterId; const result=await f.act("applyManual",[{characterId:id,safe:8,omen:0,host:11,wounds:2,active:true,act:"Prologue",strain:{Courage:1},cheatDeathUsed:false}]); assert.equal(result.ok,true); for(const p of f.players) await f.waitState(p.socket,s=>s?.gameState.characters[0].wounds===2); });
test("Added characters appear on all Player clients", async t=>{ const f=await live(t); await f.act("addCharacter"); for(const p of f.players) await f.waitState(p.socket,s=>s?.gameState.characters.length===2); });
test("Removed characters disappear on all Player clients", async t=>{ const f=await live(t); await f.act("addCharacter"); const id=f.host.latest.gameState.characters[1].id; await f.act("removeCharacter",[id]); for(const p of f.players) await f.waitState(p.socket,s=>s?.gameVersion===2 && s.gameState.characters.length===1); });
test("Another room never receives foreign updates", async t=>{ const f=await live(t); const other=await f.client(); const room=await f.send(other,"room:create",{}); await f.act("setAct",["Act 3"]); assert.equal(other.latest.code,room.room.code); assert.equal(other.latest.gameState.act,"Prologue"); });
test("Real Player receives assignment and recovers it after reconnect", async t=>{ const f=await live(t); const bob=f.players[0]; const id=f.host.latest.gameState.selectedCharacterId; await f.send(f.host,"player:assign-character",{playerId:bob.session.playerId,characterId:id}); await f.waitState(bob.socket,s=>s?.players.find(p=>p.id===bob.session.playerId)?.assignedCharacterId===id); bob.socket.disconnect(); await f.waitState(f.host,s=>s?.players.find(p=>p.id===bob.session.playerId)?.connected===false); const socket=await f.client(); const restored=await f.send(socket,"room:reconnect",bob.session); assert.equal(restored.ok,true); assert.equal(restored.session.playerId,bob.session.playerId); assert.equal(restored.room.players.find(p=>p.id===bob.session.playerId).assignedCharacterId,id); });
test("Real Host disconnect/reconnect leaves Players connected", async t=>{ const f=await live(t); f.host.disconnect(); await f.waitState(f.players[0].socket,s=>s?.players.find(p=>p.role==="HOST")?.connected===false); const socket=await f.client(); const restored=await f.send(socket,"room:reconnect",f.created.session); assert.equal(restored.ok,true); assert.equal(restored.room.players.filter(p=>p.role==="HOST").length,1); assert.ok(f.players.every(p=>p.socket.connected)); });
test("Forged real Player events are denied by the Socket.IO handlers", async t=>{ const f=await live(t); for(const event of ["game:action","game:check-state","player:assign-character"]) { const result=await f.send(f.players[0].socket,event,{}); assert.equal(result.error.code,"HOST_REQUIRED"); } const malformed=await f.send(f.host,"game:action",null); assert.equal(malformed.ok,false); assert.ok(!JSON.stringify(malformed).includes("stack")); });
