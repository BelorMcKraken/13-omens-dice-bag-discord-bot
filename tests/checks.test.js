"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { io } = require("socket.io-client");
const { RoomManager } = require("../server/room-manager.js");
const { createServer } = require("../server/server.js");
const Rules = require("../js/rules.js");

function fixture({ wounds = [0,0], bagOmen = 0, strain = {}, autoStrain = false, act = "Act 2", drawLast = false, faces = [1,1,1,1,1,1,1,1] } = {}) {
  let rolls=0, draws=0;
  const manager=new RoomManager({rng:(min,max)=>{if(min===0){draws++;return drawLast?max:0;} rolls++;return faces.shift() ?? 6;}});
  const {room,session:host}=manager.create("h",{displayName:"Host"});
  const {session:bob}=manager.join("b",{roomCode:room.code,displayName:"Bob"});
  const {session:sarah}=manager.join("s",{roomCode:room.code,displayName:"Sarah"});
  for(let i=1;i<wounds.length;i++) manager.action("h",{action:"addCharacter",args:[],baseVersion:room.gameVersion});
  const game=structuredClone(room.gameState); game.act=act; game.storyCharacterCount=wounds.length; game.bag.omen=bagOmen;
  game.characters.forEach((c,i)=>{c.wounds=wounds[i];c.name=i===0?"Jasper":`Character ${i+1}`;});
  game.characters[0].strain=strain; game.settings.autoApplyStrainFlaw=autoStrain;
  game.hostOmens=13-bagOmen-wounds.reduce((a,b)=>a+b,0); manager.acceptState(room,game);
  manager.assign("h",{playerId:bob.playerId,characterId:game.characters[0].id});
  if(game.characters[1]) manager.assign("h",{playerId:sarah.playerId,characterId:game.characters[1].id});
  const base={characterId:game.characters[0].id,aspectId:"courage",manualTn:false,difficultyModifier:0,edges:0,flaws:0,risky:false,harmless:false,forcedOmen:false};
  const call=(extra={})=>manager.checks.handle("h","check:create",{baseVersion:room.gameVersion,configuration:extra.manualTn?{...base,aspectId:undefined,...extra}:{...base,...extra}});
  const send=(event,extra={},socket="b")=>manager.checks.handle(socket,event,{baseVersion:room.gameVersion,checkId:room.gameState.currentCheck?.id,...extra});
  const invariant=()=>assert.equal(Rules.getTotalOmenDice(room.gameState),13);
  return {manager,room,host,bob,sarah,call,send,invariant,counts:()=>({rolls,draws})};
}
const check=f=>f.room.gameState.currentCheck;
const rejection=(fn,code)=>assert.throws(fn,error=>error.code===code);

test("Check request snapshots character, Player, Act and conditions without drawing",()=>{const f=fixture();f.call({difficultyModifier:1,risky:true});assert.equal(check(f).phase,"AWAITING_PLAYER");assert.equal(check(f).playerId,f.bob.playerId);assert.equal(check(f).act,"Act 2");assert.equal(check(f).configuration.risky,true);assert.deepEqual(check(f).dice,[]);assert.deepEqual(f.counts(),{draws:0,rolls:0});f.invariant();});
test("Only Host can call a Check",()=>{const f=fixture();rejection(()=>f.manager.checks.create("b",{configuration:{},baseVersion:f.room.gameVersion}),"HOST_REQUIRED");});
test("Stored Rating determines TN and Player cannot change Host conditions",()=>{const f=fixture();f.call({difficultyModifier:1,edges:1,risky:true});rejection(()=>f.send("check:set-rating",{rating:"Good"}),"RATING_LOCKED");assert.equal(check(f).finalTn,8);assert.equal(check(f).configuration.edges,1);assert.equal(check(f).configuration.risky,true);rejection(()=>f.send("check:set-rating",{rating:"Great",difficultyModifier:-2}),"INVALID_PAYLOAD");});
test("Fake Rating and arbitrary base TN rejected",()=>{const f=fixture();f.call();rejection(()=>f.send("check:set-rating",{rating:"Perfect"}),"RATING_LOCKED");rejection(()=>f.send("check:set-rating",{rating:"Good",baseTn:1}),"INVALID_PAYLOAD");});
test("Host manual TN locks Player Rating",()=>{const f=fixture();f.call({manualTn:true,baseTn:9});assert.equal(check(f).finalTn,9);rejection(()=>f.send("check:set-rating",{rating:"Great"}),"RATING_LOCKED");});
test("Host can lock a nonmanual Rating",()=>{const f=fixture();f.call();rejection(()=>f.send("check:set-rating",{rating:"Good"}),"RATING_LOCKED");});
test("Player cannot submit fake draw or random results",()=>{const f=fixture();f.call();rejection(()=>f.send("check:draw",{dice:[{type:"SAFE"}],rng:1}),"INVALID_PAYLOAD");f.send("check:draw");rejection(()=>f.send("check:roll",{results:[6,6]}),"INVALID_PAYLOAD");assert.equal(f.counts().rolls,0);});
test("Another Player cannot draw, roll, reroll or resolve Jasper's Check",()=>{const f=fixture();f.call({forcedOmen:true});for(const event of ["check:draw","check:roll","check:reroll","check:take-wound","check:cheat-death","check:valiant-sacrifice","check:set-rating"])rejection(()=>f.send(event,event==="check:set-rating"?{rating:"Good"}:{},"s"),"CHECK_OWNER_REQUIRED");f.send("check:draw");f.send("check:roll");f.send("check:take-wound");f.invariant();});
test("Server draws without replacement and keeps numeric results absent",()=>{const f=fixture({bagOmen:1,drawLast:true});f.call({edges:2});f.send("check:draw");assert.equal(check(f).dice.filter(d=>d.type==="OMEN").length,1);assert.ok(check(f).dice.every(d=>d.result===null));assert.equal(f.counts().rolls,0);});
test("Server rolls each die and computes kept dice, total and Wound eligibility",()=>{const f=fixture({bagOmen:1,drawLast:true,faces:[1,5,6]});f.call({edges:1});f.send("check:draw");f.send("check:roll");const roll=check(f).originalRoll;assert.equal(roll.total,11);assert.equal(roll.result,"FULL SUCCESS");assert.equal(roll.wound.triggered,true);assert.equal(roll.dice[0].used,false);assert.equal(f.counts().rolls,3);});

const compositions=[
  ["Normal",{}, {},2,0], ["One Edge",{edges:1},{},3,0], ["Two Edges",{edges:2},{},4,0],
  ["One Flaw",{flaws:1},{},3,1], ["Two Flaws",{flaws:2},{},4,2], ["Edge cancels Flaw",{edges:1,flaws:1},{},2,1],
  ["Three-Wound Flaw",{},{wounds:[3,0]},3,1], ["Strain ON",{},{strain:{Courage:1},autoStrain:true},3,1],
  ["Strain OFF",{},{strain:{Courage:1}},2,0], ["Forced Omen",{forcedOmen:true},{},3,1],
  ["Forced Omen plus Edge",{forcedOmen:true,edges:1},{},2,1], ["Forced Omen plus Flaw",{forcedOmen:true,flaws:1},{},4,2],
  ["Five effective Flaws",{forcedOmen:true,flaws:2},{wounds:[3,0],strain:{Courage:1},autoStrain:true},7,5],
];
for(const [name,options,setup,total,flaws] of compositions)test(`Authoritative composition: ${name}`,()=>{const f=fixture(setup);f.call(options);f.send("check:draw");assert.equal(check(f).dice.length,total);assert.equal(check(f).composition.totalFlaws,flaws);assert.equal(check(f).dice.filter(d=>d.source==="forced").length,options.forcedOmen?1:0);f.invariant();});
test("Other Aspect Strain adds no Flaw",()=>{const f=fixture({strain:{Fight:1},autoStrain:true});f.call();f.send("check:draw");assert.equal(check(f).automaticFlaws.strain,0);});
test("Insufficient dice reject draw without committing Forced Omen",()=>{const f=fixture();f.call({flaws:2,forcedOmen:true});f.room.gameState.bag.safe=1;const before=structuredClone(f.room.gameState);rejection(()=>f.send("check:draw"),"ILLEGAL_ACTION");assert.deepEqual(f.room.gameState,before);});
test("Bag Omen Wound moves exactly one Omen",()=>{const f=fixture({bagOmen:1,drawLast:true});f.call();f.send("check:draw");f.send("check:roll");f.send("check:take-wound");assert.equal(f.room.gameState.bag.omen,0);assert.equal(f.room.gameState.characters[0].wounds,1);f.invariant();});
test("Forced Omen Wound never also enters Bag",()=>{const f=fixture();f.call({forcedOmen:true});f.send("check:draw");f.send("check:roll");f.send("check:take-wound");assert.equal(f.room.gameState.bag.omen,0);assert.equal(f.room.gameState.hostOmens,12);f.invariant();});
test("Bag Omen selected as Wound while Forced Omen enters Bag",()=>{const f=fixture({bagOmen:1,drawLast:true});f.call({forcedOmen:true});f.send("check:draw");f.send("check:roll");f.send("check:take-wound");assert.equal(f.room.gameState.bag.omen,1);assert.equal(f.room.gameState.characters[0].wounds,1);f.invariant();});
test("Several qualifying Omens cause only one Wound",()=>{const f=fixture({bagOmen:3,drawLast:true});f.call({flaws:1});f.send("check:draw");f.send("check:roll");assert.equal(check(f).originalRoll.wound.qualifyingDice.length,3);f.send("check:take-wound");assert.equal(f.room.gameState.characters[0].wounds,1);f.invariant();});
test("Harmless Forced Omen becomes Strain without Wounds",()=>{const f=fixture();f.call({forcedOmen:true,harmless:true});f.send("check:draw");f.send("check:roll");rejection(()=>f.send("check:take-wound"),"ILLEGAL_PHASE");f.send("check:finish");assert.equal(f.room.gameState.characters[0].strain.courage,1);assert.equal(f.room.gameState.characters[0].wounds,0);assert.equal(f.room.gameState.bag.omen,1);f.invariant();});
test("Cheat Death removes Safe die and tracks only Check owner's usage",()=>{const f=fixture();f.call({forcedOmen:true});f.send("check:draw");f.send("check:roll");f.send("check:cheat-death");assert.equal(f.room.gameState.bag.safe,7);assert.equal(f.room.gameState.bag.omen,1);assert.equal(f.room.gameState.characters[0].cheatDeathUsed,true);assert.equal(f.room.gameState.characters[1].cheatDeathUsed,false);f.invariant();});
test("Cheat Death fails without a Safe die",()=>{const f=fixture({bagOmen:3,drawLast:true});f.call();f.send("check:draw");f.send("check:roll");rejection(()=>f.send("check:cheat-death"),"ILLEGAL_ACTION");});
test("Fourth Wound returns only dead character's Omens",()=>{const f=fixture({wounds:[3,2,1,1]});f.call({forcedOmen:true});f.send("check:draw");f.send("check:roll");f.send("check:take-wound");assert.equal(f.room.gameState.characters[0].active,false);assert.deepEqual(f.room.gameState.characters.slice(1).map(c=>c.wounds),[2,1,1]);assert.equal(f.room.gameState.bag.omen,4);f.invariant();});
test("Valiant Sacrifice produces no rolls and returns Wounds plus Forced Omen",()=>{const f=fixture({wounds:[3,2]});f.call({forcedOmen:true});f.send("check:draw");assert.equal(check(f).valiantAvailable,true);f.send("check:valiant-sacrifice");assert.equal(f.counts().rolls,0);assert.ok(check(f).dice.every(d=>d.result===null));assert.equal(check(f).valiantResolved,true);assert.equal(f.room.gameState.bag.omen,4);assert.equal(f.room.gameState.characters[0].active,false);f.invariant();});
test("Valiant Sacrifice unavailable without three Wounds",()=>{const f=fixture();f.call({forcedOmen:true});f.send("check:draw");rejection(()=>f.send("check:valiant-sacrifice"),"ILLEGAL_ACTION");});
test("Reroll preserves exact dice IDs/types/sources and original results",()=>{const f=fixture({faces:[1,1,1,6,6,6]});f.call({forcedOmen:true});f.send("check:draw");const dice=structuredClone(check(f).dice);f.send("check:roll");const original=structuredClone(check(f).originalRoll);f.send("check:takeover",{},"h");f.send("check:reroll",{},"h");assert.deepEqual(check(f).dice,dice);assert.deepEqual(check(f).originalRoll,original);assert.equal(check(f).reroll.total,12);assert.equal(check(f).selectedRoll,"reroll");assert.equal(check(f).reroll.wound.triggered,false);f.send("check:select-roll",{rollName:"original"},"h");assert.equal(check(f).phase,Rules.PHASE_AWAITING_WOUND);});
test("Risky failure is a reminder without invented consequences",()=>{const f=fixture({faces:[1,1]});f.call({risky:true});f.send("check:draw");f.send("check:roll");assert.equal(check(f).originalRoll.riskyFailure,true);f.send("check:finish");assert.deepEqual(f.room.gameState.characters[0].strain,{});});
test("Act snapshot at request controls draw and roll even after story advances",()=>{const f=fixture({act:"Act 1",faces:[2,2,2]});f.room.gameState.settings.lockActDuringPendingCheck=false;f.call({forcedOmen:true});f.manager.action("h",{action:"setAct",args:["Act 3"],baseVersion:f.room.gameVersion});f.send("check:draw");f.send("check:roll");assert.equal(check(f).act,"Act 1");assert.equal(f.room.gameState.act,"Act 3");assert.equal(check(f).originalRoll.wound.triggered,false);});
test("Act lock blocks from request through resolution",()=>{const f=fixture({faces:[6,6]});f.call();assert.throws(()=>f.manager.action("h",{action:"setAct",args:["Act 3"],baseVersion:f.room.gameVersion}));f.send("check:draw");f.send("check:roll");f.send("check:finish");f.manager.action("h",{action:"setAct",args:["Act 3"],baseVersion:f.room.gameVersion});});
test("Only one unresolved Check per room",()=>{const f=fixture();f.call();rejection(()=>f.call(),"CHECK_PENDING");});
test("Roll-before-draw and rating-after-draw are rejected",()=>{const f=fixture();f.call();rejection(()=>f.send("check:roll"),"ILLEGAL_PHASE");rejection(()=>f.send("check:cheat-death"),"ILLEGAL_PHASE");f.send("check:draw");rejection(()=>f.send("check:set-rating",{rating:"Good"}),"ILLEGAL_PHASE");});
test("Duplicate Draw and Roll cannot consume dice twice",()=>{const f=fixture();f.call({forcedOmen:true});const drawPayload={checkId:check(f).id,baseVersion:f.room.gameVersion};f.manager.checks.handle("b","check:draw",drawPayload);rejection(()=>f.manager.checks.handle("b","check:draw",drawPayload),"STALE_STATE");rejection(()=>f.send("check:draw"),"ILLEGAL_PHASE");f.send("check:roll");rejection(()=>f.send("check:roll"),"ILLEGAL_PHASE");assert.equal(f.counts().rolls,3);f.invariant();});
test("Duplicate reroll and Wound resolution rejected",()=>{const f=fixture();f.call({forcedOmen:true});f.send("check:draw");f.send("check:roll");f.send("check:takeover",{},"h");f.send("check:reroll",{},"h");rejection(()=>f.send("check:reroll",{},"h"),"ILLEGAL_ACTION");f.send("check:take-wound",{},"h");rejection(()=>f.send("check:take-wound"),"NO_PENDING_CHECK");f.invariant();});
test("Duplicate Cheat Death and sacrifice rejected",()=>{for(const sacrifice of [false,true]){const f=fixture({wounds:sacrifice?[3,0]:[0,0]});f.call({forcedOmen:true});f.send("check:draw");const action=sacrifice?"check:valiant-sacrifice":"check:cheat-death";if(!sacrifice)f.send("check:roll");f.send(action);rejection(()=>f.send(action),"NO_PENDING_CHECK");f.invariant();}});
test("Host cancellation before draw and after Forced commitment preserves economy",()=>{const f=fixture();f.call({forcedOmen:true});f.send("check:cancel",{},"h");assert.equal(check(f),null);f.call({forcedOmen:true});f.send("check:draw");assert.equal(f.room.gameState.hostOmens,12);f.send("check:cancel",{},"h");assert.equal(f.room.gameState.hostOmens,13);f.invariant();});
test("Player cannot cancel or take over; Host takeover revokes Player actions",()=>{const f=fixture();f.call();for(const event of ["check:cancel","check:takeover"])rejection(()=>f.send(event),"HOST_REQUIRED");rejection(()=>f.send("check:draw",{},"h"),"TAKEOVER_REQUIRED");f.send("check:takeover",{},"h");rejection(()=>f.send("check:draw"),"CHECK_OWNER_REQUIRED");f.send("check:draw",{},"h");assert.match(f.room.gameState.history.at(-1).text,/Host acted for Jasper/);});
test("Unassigned character gives Host control without a Player slot",()=>{const f=fixture();f.manager.assign("h",{playerId:f.bob.playerId,characterId:null});f.call();assert.equal(check(f).hostTakeover,true);assert.equal(check(f).playerId,null);f.send("check:draw",{},"h");});
test("Pending assignment, owner removal, reset and import are locked",()=>{const f=fixture();f.call();rejection(()=>f.manager.assign("h",{playerId:f.bob.playerId,characterId:null}),"CHECK_PENDING");for(const [action,args] of [["removeCharacter",[check(f).characterId]],["resetGame",[]],["importState",[f.room.gameState]],["addOmenToBag",[]]])assert.throws(()=>f.manager.action("h",{action,args,baseVersion:f.room.gameVersion}));});
test("Host cannot import fabricated Check results",()=>{const f=fixture();const fake=structuredClone(f.room.gameState);fake.currentCheck={phase:"RESOLVED",dice:[6,6]};rejection(()=>f.manager.action("h",{action:"importState",args:[fake],baseVersion:f.room.gameVersion}),"SERVER_AUTHORITATIVE");});
for(const phase of ["requested","drawn","rolled"])test(`Player and Host reconnect preserve exact ${phase} Check`,()=>{const f=fixture();f.call({forcedOmen:true});if(phase!=="requested")f.send("check:draw");if(phase==="rolled")f.send("check:roll");const snapshot=structuredClone(check(f));const counts=f.counts();f.manager.disconnect("b");f.manager.disconnect("h");f.manager.reconnect("b2",f.bob);f.manager.reconnect("h2",f.host);assert.deepEqual(check(f),snapshot);assert.deepEqual(f.counts(),counts);if(phase==="drawn")f.send("check:roll",{},"b2");if(phase==="rolled")f.send("check:take-wound",{},"b2");f.invariant();});
test("Check actions in separate rooms cannot affect each other's Bag or results",()=>{const a=fixture();const other=a.manager.create("h2",{});const before=structuredClone(other.room.gameState);a.call({forcedOmen:true});a.send("check:draw");a.send("check:roll");a.send("check:take-wound");assert.deepEqual(other.room.gameState,before);});

test("Real Host and two Players receive identical server Check phases and results",async t=>{
  const service=createServer({log:()=>{},rng:min=>min});service.server.listen(0,"127.0.0.1");await once(service.server,"listening");
  const url=`http://127.0.0.1:${service.server.address().port}`;const sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await new Promise(r=>service.io.close(r));});
  const connect=async()=>{const s=io(url,{forceNew:true,reconnection:false});sockets.push(s);s.on("room:state",v=>s.latest=v);await once(s,"connect");return s;};
  const send=(s,event,payload)=>new Promise((resolve,reject)=>s.timeout(2000).emit(event,payload,(error,value)=>error?reject(error):resolve(value)));
  const h=await connect();const created=await send(h,"room:create",{});const b=await connect();const bob=await send(b,"room:join",{roomCode:created.room.code,displayName:"Bob"});const s=await connect();await send(s,"room:join",{roomCode:created.room.code,displayName:"Sarah"});
  const id=created.room.gameState.selectedCharacterId;
  await send(h,"player:assign-character",{playerId:bob.session.playerId,characterId:id});await send(h,"game:action",{action:"setAct",args:["Act 2"],baseVersion:0});
  const result=await send(h,"check:create",{baseVersion:1,configuration:{characterId:id,aspectId:"courage",manualTn:false,edges:0,flaws:0,difficultyModifier:1,risky:true,harmless:false,forcedOmen:true}});
  assert.equal(result.ok,true);
  let version=result.room.gameVersion;const checkId=result.room.gameState.currentCheck.id;
  for(const [event,extra] of [["check:draw",{}],["check:roll",{}],["check:take-wound",{}]]){
    const rejected=await send(s,event,{checkId,baseVersion:version,...extra});assert.equal(rejected.error.code,"CHECK_OWNER_REQUIRED");
    const incoming=[h,s].map(socket=>new Promise(resolve=>socket.once("room:state",resolve)));
    const response=await send(b,event,{checkId,baseVersion:version,...extra});assert.equal(response.ok,true);version=response.room.gameVersion;
    for(const snapshot of await Promise.all(incoming))assert.deepEqual(snapshot.gameState.currentCheck,response.room.gameState.currentCheck);
  }
  assert.equal(b.latest.gameState.currentCheck.phase,"RESOLVED");assert.equal(b.latest.gameState.characters[0].wounds,1);
  const fake=await send(b,"check:set-result",{total:12});assert.equal(fake.error.code,"SERVER_AUTHORITATIVE");
});
