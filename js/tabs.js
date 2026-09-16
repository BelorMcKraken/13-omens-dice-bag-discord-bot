(function(){
  const $=id=>document.getElementById(id);
  let tab='game', renderedRole=null;
  function refresh(){
    const host=!$('gameInterface').hidden, player=!$('playerView').hidden;
    const nav=$('primaryTabs'); nav.hidden=!(host||player);
    $('roomActivity').closest('details').hidden=!(host||player) || window.ThirteenOmensState.getMode()!=='multiplayer';
    const labels=host?['GAME','CHARACTERS','HISTORY & SAVE']:['GAME / CURRENT CHECK','MY CHARACTER','HISTORY'];
    const role=host?'host':'player';
    if(renderedRole!==role){
      nav.replaceChildren();
      ['game','characters','history'].forEach((key,i)=>{
        const b=document.createElement('button');b.type='button';b.textContent=labels[i];b.dataset.view=key;
        b.onclick=()=>{tab=key;refresh();};nav.append(b);
      });
      renderedRole=role;
    }
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(tab===b.dataset.view)));
    document.body.dataset.mainTab=tab;
    $('allowPlayerCharacterEdits').checked=window.ThirteenOmensState.getState().settings.allowPlayerCharacterEdits;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('multiplayerLobby').before($('primaryTabs'));
    const characters=document.querySelector('.character-panel');
    const assignments=$('playersList'); characters.prepend(assignments.previousElementSibling,assignments);
    const log=$('roomActivity').closest('details'); log.dataset.tabPanel='history'; $('multiplayerLobby').after(log);
    for(const selector of ['.story-panel','.bag-panel','.check-panel','.result-panel','#soloPerks','#multiplayerCheckPanel']) document.querySelector(selector).dataset.tabPanel='game';
    characters.dataset.tabPanel='characters'; $('playerView').dataset.tabPanel='characters';
    document.querySelector('.host-tools').dataset.tabPanel='characters';
    for(const selector of ['.persistence-panel','.history-panel']) document.querySelector(selector).dataset.tabPanel='history';
    document.querySelector('.persistence-panel').prepend($('newGame'));
    $('allowPlayerCharacterEdits').onchange=async e=>{try{await window.ThirteenOmensState.setSetting('allowPlayerCharacterEdits',e.target.checked);window.ThirteenOmensApp.render();}catch(error){$('multiplayerError').textContent=error.message;}};
    new MutationObserver(refresh).observe($('gameInterface'),{attributes:true,attributeFilter:['hidden']});
    new MutationObserver(refresh).observe($('playerView'),{attributes:true,attributeFilter:['hidden']});
    refresh();
  });
})();
