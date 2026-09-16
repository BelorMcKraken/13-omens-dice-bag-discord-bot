(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ThirteenOmensPerks=api;})(typeof globalThis!=='undefined'?globalThis:window,function(){
'use strict';
const PRE=['AWAITING_PLAYER'];const BEFORE=['AWAITING_PLAYER','DRAWN'];const POST=['ROLLED','AWAITING_WOUND_RESOLUTION'];
const rule=(name,usage,type,timing=[],aspects=[])=>({name,usage,type,timing:usage==="always"?["AUTOMATIC"]:timing,aspects,automated:true});
const PERK_RULES={
 'the-truth':rule('The Truth','always','truth'),
 'carry-on':rule('Carry On','always','wound-flaw'),
 'awkward-pause':rule('Awkward Pause','story','reroll',POST),
 'gripe-and-complain':rule('Gripe and Complain','act','keep',BEFORE),
 bossy:rule('Bossy','act','bossy',PRE),
 'five-minute-break':rule('Five Minute Break','story','strain',['OUTSIDE_CHECK']),
 'late-for-work':rule('Late for Work','story','strain',['OUTSIDE_CHECK']),
 'local-edge':rule('Local Edge','act','cancel',BEFORE,['Evade','Perception']),
 'eager-to-help':rule('Eager to Help','act','aid',BEFORE),
 lucky:rule('Lucky','story','lucky',PRE),
 'chill-out':rule('Chill Out','always','chill'),
 'very-tired':rule('Very Tired','always','tired'),
 'tech-pro':rule('Tech Pro','act','edge',PRE,['Technology']),
 'code-wizard':rule('Code Wizard','act','edge',PRE,['Computers']),
 'encyclopedic-memory':rule('Encyclopedic Memory','act','edge',PRE,['Ghost Stormers Lore']),
 'scene-edge':rule('Scene Edge (Host-defined condition)','scene','edge',PRE),
};
const own=(c,key)=>c.perks?.find(p=>p.ruleKey===key&&!p.disabled);
function disabledReason(c,p){if(p.disabled)return 'Disabled by Host';if(p.ruleKey==='chill-out'&&c.aspects?.find(a=>a.id==='courage')?.strained)return 'Chill Out inactive — Courage is Strained.';return '';}
function hasPerk(c,key){const p=own(c,key);return Boolean(p&&!disabledReason(c,p));}
const context=(state,check)=>({act:check?.act||state.act,scene:check?.sceneNumber||state.sceneNumber});
function usageStatus(c,p,state,check){const r=PERK_RULES[p.ruleKey];const why=disabledReason(c,p);if(why)return why;if(!r)return 'MANUAL PERK';const u=c.perkUsage?.[p.ruleKey]||{},ctx=context(state,check);if(r.usage==='story'&&u.storyUsed)return 'USED — STORY';if(r.usage==='act'&&u.actsUsed?.includes(ctx.act))return `USED — ${ctx.act}`;if(r.usage==='scene'&&u.scenesUsed?.includes(ctx.scene))return `USED — SCENE ${ctx.scene}`;return r.usage==='always'?'ALWAYS ACTIVE':`AVAILABLE — ${r.usage==='act'?ctx.act:r.usage==='scene'?`SCENE ${ctx.scene}`:'STORY'}`;}
function isPerkAvailable(c,key,state,check){const p=own(c,key);return Boolean(p&&PERK_RULES[key]&&!disabledReason(c,p)&&!usageStatus(c,p,state,check).startsWith('USED'));}
function markPerkUsed(c,p,state,check){const r=PERK_RULES[p.ruleKey],ctx=context(state,check);c.perkUsage??={};const u=c.perkUsage[p.ruleKey]??={storyUsed:false,actsUsed:[],scenesUsed:[]};if(r.usage==='story')u.storyUsed=true;if(r.usage==='act')u.actsUsed=[...new Set([...u.actsUsed,ctx.act])];if(r.usage==='scene')u.scenesUsed=[...new Set([...u.scenesUsed,ctx.scene])];}
function eligible(c,p,state,check){const r=PERK_RULES[p.ruleKey];if(!r||!c.active||!isPerkAvailable(c,p.ruleKey,state,check))return false;const phase=check&&check.phase!=='RESOLVED'?check.phase:'OUTSIDE_CHECK';if(!r.timing.includes(phase))return false;if(r.type==='strain')return c.aspects.some(a=>a.strained);if(!check)return false;if(r.type!=='aid'&&check.characterId!==c.id)return false;if(r.type==='aid'&&check.characterId===c.id)return false;if(r.aspects.length&&!r.aspects.includes(check.configuration.aspect))return false;if(['cancel','aid','keep'].includes(r.type)&&check.composition.net.netFlaws<1)return false;if(r.type==='lucky'&&(check.configuration.manualTn||check.configuration.aspectId==='luck'))return false;if(r.type==='reroll'&&check.reroll)return false;if(['keep','bossy'].includes(r.type)&&check.keepStrategy==='highest-plus-lowest')return false;return true;}
function refunds(state,check){if(check.originalRoll)return;for(const a of [...(check.perkActivations||[])].reverse()){const c=state.characters.find(c=>c.id===a.characterId);if(c){if(a.previousUsage===null)delete c.perkUsage[a.ruleKey];else c.perkUsage[a.ruleKey]=a.previousUsage;}}}
return {PERK_RULES,hasPerk,isPerkAvailable,markPerkUsed,usageStatus,disabledReason,eligible,refunds};
});
