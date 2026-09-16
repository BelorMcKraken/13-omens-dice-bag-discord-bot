// Runs the real app event handlers against a minimal DOM adapter, without a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let tests = 0;
function app(saved) {
  class Element {
    constructor(tag, attributes = '') {
      this.tagName = tag; this.value = attributes.match(/value="([^"]*)"/)?.[1] || '';
      this.checked = /\bchecked\b/.test(attributes); this.disabled = /\bdisabled\b/.test(attributes);
      this.children = []; this.events = {}; this.textContent = ''; this.innerHTML = '';
    }
    addEventListener(name, callback) { this.events[name] = callback; }
    append(child) { this.children.push(child); if (this.tagName === 'select' && !this.value) this.value = child.value; }
    replaceChildren() { this.children = []; this.value = ''; }
    setAttribute(name, value) { this[name] = value; }
    focus() {} select() {}
    click() { if (!this.disabled) this.events.click?.(); }
  }
  const elements = {};
  for (const match of html.matchAll(/<(\w+)([^>]*\bid="([^"]+)"[^>]*)>/g)) elements[match[3]] = new Element(match[1], match[2]);
  const errors = [];
  const document = { getElementById: id => elements[id], querySelector: selector => elements[selector.slice(1)], createElement: tag => new Element(tag), addEventListener: (_, fn) => document.ready = fn };
  const context = { document, console, alert: message => errors.push(message), confirm: () => true, localStorage: { getItem: () => saved || null, setItem: (_, value) => saved = value } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['perks', 'rules', 'state', 'app']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), context);
  document.ready();
  return { e: elements, errors, store: context.ThirteenOmensState, saved: () => saved,
    change(id, value) { elements[id].value = value; elements[id].events.change?.(); },
    toggle(id, checked) { elements[id].checked = checked; elements[id].events.change?.(); },
    click(id) { elements[id].click(); },
    import(state) { elements.importText.value = JSON.stringify(state); elements.importState.click(); }
  };
}
function test(name, fn) { fn(); tests++; console.log(`PASS ${name}`); }
test('Roster UI reaches six, disables seventh, renames and selects', () => {
  const a = app(); for(let i=0;i<5;i++) a.click('addCharacter');
  assert.equal(a.e.characterList.children.length, 6); assert.equal(a.e.addCharacter.disabled, true);
  a.click('addCharacter'); assert.equal(a.store.getState().characters.length, 6);
  a.e.characterList.children[1].click(); a.e.characterName.value = ' Amanda '; a.click('renameCharacter');
  assert.equal(a.e.checkingFor.textContent, 'CHECKING FOR: Amanda'); assert.equal(a.errors.length, 0);
});
test('Final character removal disabled and new game restores one', () => { const a=app(); assert.equal(a.e.removeCharacter.disabled, true); a.click('addCharacter'); a.click('newGame'); assert.equal(a.e.characterList.children.length, 1); });
test('UI explains character-specific Wounds and optional Courage Strain', () => {
  const a=app(); a.click('addCharacter'); const s=a.store.getState(); s.characters[0].wounds=3; s.characters[0].strain={Courage:1}; s.hostOmens=10; a.import(s);
  a.change('aspectName','Courage'); assert.match(a.e.automaticSources.textContent,/3 Wounds/); assert.doesNotMatch(a.e.automaticSources.textContent,/Strain/);
  a.toggle('autoApplyStrainFlaw',true); assert.match(a.e.automaticSources.textContent,/Courage Strain/);
  a.change('aspectName','Fight'); assert.doesNotMatch(a.e.automaticSources.textContent,/Strain/);
  a.e.characterList.children[1].click(); assert.equal(a.e.automaticSources.textContent,'None');
});
test('Pending Check disables Act and character controls then cancel unlocks', () => {
  const a=app(); a.click('addCharacter'); a.change('actSelect','Act 1'); a.click('reachBag');
  for(const id of ['actSelect','manualAct','removeCharacter','reachBag','applyManual','recordStrain']) assert.equal(a.e[id].disabled,true,id);
  assert.ok(a.e.characterList.children.every(button=>button.disabled)); a.click('cancelCheck'); assert.deepEqual(a.errors, []);
  assert.equal(a.e.actSelect.disabled,false); assert.equal(a.e.manualAct.disabled,false); assert.equal(a.e.reachBag.disabled,false);
});
test('Unlocked story Act stays distinct from Check Act across refresh', () => {
  const a=app(); a.change('actSelect','Act 1'); a.toggle('lockActDuringPendingCheck',false); a.click('reachBag'); a.change('actSelect','Act 3');
  assert.match(a.e.checkSnapshot.textContent,/CHECK ACT: ACT 1.*Current Story Act: ACT 3/);
  const b=app(a.saved()); assert.equal(b.store.getState().currentCheck.characterId,a.store.getState().currentCheck.characterId); assert.match(b.e.checkSnapshot.textContent,/CHECK ACT: ACT 1/); assert.equal(b.e.actSelect.disabled,false);
});
test('Resolution unlocks Act and inactive characters cannot draw', () => {
  const a=app(); a.click('reachBag'); a.click('rollDice'); a.click('finishCheck'); assert.equal(a.e.actSelect.disabled,false);
  const s=a.store.getState(); s.characters[0].active=false; a.import(s); assert.equal(a.e.reachBag.disabled,true); a.click('revive'); assert.equal(a.e.reachBag.disabled,false); assert.deepEqual(a.errors,[]);
});
test('Host UI edits only targeted character and exports all fields', () => {
  const a=app(); a.click('addCharacter'); const id=a.store.getState().characters[1].id; a.change('manualCharacter',id);
  a.e.manualWounds.value='2'; a.e.manualHost.value='11'; a.e.manualStatus.value='true'; a.e.manualStrain.value='{"Courage":1}'; a.e.manualCheatDeath.checked=true; a.click('applyManual');
  a.click('exportState'); const s=JSON.parse(a.e.importText.value); assert.equal(s.characters[0].wounds,0); assert.equal(s.characters[1].wounds,2); assert.equal(s.characters[1].cheatDeathUsed,true); assert.equal(s.characters[1].strain.Courage,1); assert.ok(s.settings); assert.deepEqual(a.errors,[]);
});
test('Character names in history are escaped as text', () => { const a=app(); a.e.characterName.value='<img src=x onerror=alert(1)>'; a.click('renameCharacter'); a.click('reachBag'); assert.match(a.e.historyList.innerHTML,/&lt;img/); assert.doesNotMatch(a.e.historyList.innerHTML,/<img/); });
console.log(`${tests} DOM interaction tests passed (no browser layout verification)`);

