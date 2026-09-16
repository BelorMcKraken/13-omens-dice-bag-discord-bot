(function(root){
'use strict';
const P=root.ThirteenOmensPerks,R=root.ThirteenOmensRules,S=root.ThirteenOmensState;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(container,state,{host=true,characterId=state.selectedCharacterId,ready=true}={}){
 if(!container)return;
 const check=S.hasUnresolvedCheck(state)?state.currentCheck:null;
 const characters=state.characters.filter(c=>host||c.id===characterId);
 const available=characters.flatMap(c=>c.perks.filter(p=>P.eligible(c,p,state,check)).map(p=>({c,p,r:P.PERK_RULES[p.ruleKey]})));
 container.innerHTML=`<p>Current Scene: <strong>${state.sceneNumber}</strong> ${host?`<button type="button" data-scene ${check||!ready?'disabled':''}>Next Scene</button>`:''}</p>
 ${check?.modifierSources?`<details open><summary>Check modifier sources · Keep ${esc(check.keepStrategy)}</summary><ul>${check.modifierSources.map(s=>`<li>${esc(s.name)}: ${s.kind==='cancel'?'−':'+'}${s.amount} ${s.kind==='cancel'?'Flaw canceled':s.kind}${s.cancels?.length?' ('+s.cancels.map(c=>esc(c.name)).join(', ')+')':''}</li>`).join('')}</ul><p>Effective: ${check.composition.net.netEdges} Edge / ${check.composition.net.netFlaws} Flaw · ${check.composition.totalPhysicalDice} dice</p>${check.originalAspectId!==check.effectiveAspectId?`<p>Called: ${esc(check.originalAspectName)} → Using ${esc(check.configuration.aspect)}</p>`:''}${check.returnedDice?.length?`<p>Returned to bag: ${check.returnedDice.map(d=>esc(d.type)).join(', ')}</p>`:''}</details>`:''}
 ${available.length?'<h4>Available Perks</h4>':''}${available.map(({c,p,r})=>`<div class="perk-action"><strong>${esc(c.name)} — ${esc(p.name)}</strong><p>${esc({edge:'+1 Edge; activate when narrative condition applies',bossy:'+1 Aid Edge; keep highest + lowest',keep:'Keep highest + lowest',cancel:'Cancel one Flaw',aid:'Giving Aid: cancel one additional Flaw (configure normal Aid Edge separately)',lucky:'Use Luck Rating instead of called Aspect',reroll:'Reroll the same dice; take the better result',strain:'Remove one Strain after the successful break/action'}[r.type])}</p>${r.type==='strain'?`<select aria-label="Strain to remove with ${esc(p.name)}" data-strain-for="${esc(p.id)}">${c.aspects.filter(a=>a.strained).map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`:''}<button type="button" data-use="${esc(p.id)}" data-character="${esc(c.id)}" ${!ready?'disabled':''}>Use ${esc(p.name)}</button></div>`).join('')}<p data-perk-error role="status"></p>`;
 async function act(fn){try{await fn();root.ThirteenOmensApp.render();}catch(e){container.querySelector('[data-perk-error]').textContent=e.message;}}
 container.querySelector('[data-scene]')?.addEventListener('click',()=>act(()=>S.advanceScene()));
 container.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',()=>{const select=[...container.querySelectorAll('[data-strain-for]')].find(e=>e.dataset.strainFor===b.dataset.use);act(()=>S.activatePerk(b.dataset.character,b.dataset.use,select?.value));}));
}
root.ThirteenOmensPerkUI={render};
})(typeof globalThis!=='undefined'?globalThis:window);
