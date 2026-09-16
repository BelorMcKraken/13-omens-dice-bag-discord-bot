'use strict';
const State=require('../js/state');
const {object,fail}=require('./validation');
const EVENTS=['perk:activate','perk:strain-remove','perk:disable','perk:restore','scene:advance'];
function handlePerk(rooms,socketId,event,payload){
 const {room,player}=rooms.authorize(socketId,false),host=player.role==='HOST'&&player.id===room.hostPlayerId;
 object(payload,event==='scene:advance'?['baseVersion']:['baseVersion','checkId','characterId','perkId',...(event==='perk:strain-remove'?['aspectId']:[])]);
 rooms.checkVersion(room,payload.baseVersion);
 if(!EVENTS.includes(event))fail('INVALID_PAYLOAD','Unknown Perk action.');
 if(['scene:advance','perk:disable','perk:restore'].includes(event)&&!host)fail('HOST_REQUIRED','Host permission required.');
 const check=State.hasUnresolvedCheck(room.gameState)?room.gameState.currentCheck:null;
 if(event!=='scene:advance'){
  const c=room.gameState.characters.find(c=>c.id===payload.characterId);
  if(!c||!c.perks.some(p=>p.id===payload.perkId))fail('PERK_REQUIRED','Character must own this Perk.');
  if(!host&&(player.assignedCharacterId!==c.id||check&&(check.characterId!==c.id||check.playerId!==player.id||check.hostTakeover)))fail('CHECK_OWNER_REQUIRED','Only the assigned Player or Host can activate this Perk.');
  if(check&&payload.checkId!==check.id)fail('NO_PENDING_CHECK','This Check is no longer pending.');
  if(!check&&payload.checkId!=null)fail('NO_PENDING_CHECK','This Check is no longer pending.');
 }
 const store=State.createStore({storage:null,initialState:room.gameState});
 try{
  if(event==='scene:advance')store.advanceScene();
  else if(event==='perk:disable'||event==='perk:restore')store.setPerkDisabled(payload.characterId,payload.perkId,event==='perk:disable');
  else store.activatePerk(payload.characterId,payload.perkId,payload.aspectId,rooms.checks.rng);
 }catch(e){fail('ILLEGAL_ACTION',e.message);}
 const next=store.getState();if(host&&event.startsWith('perk:'))next.history.push({time:new Date().toISOString(),text:`${player.displayName} acted on behalf of the character: ${event}.`});
 rooms.acceptState(room,next);return room;
}
module.exports={handlePerk,EVENTS};
