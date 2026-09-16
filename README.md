# 13 Omens - Virtual Dice Bag

A virtual dice bag for the tabletop horror RPG **13 Omens**, with independent **Solo** saves and **server-authoritative multiplayer**. The existing horror interface and shared rules engine serve both modes.

Open `index.html` directly for Solo, or run the Node server below for Solo and multiplayer. No frontend build step or database is required.

## Run locally

Use Node.js 22 or later (verified with Node 24.14). From the project directory:

```sh
npm ci
npm start
```

Open **http://localhost:3000**. Use `npm install` when deliberately updating dependencies, `npm run dev` for server watch mode, and `npm test` for the complete suite. The committed lockfile supports `npm ci`.

The server listens on `0.0.0.0`, using `process.env.PORT` or port 3000. To choose a port in PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

For a LAN game, connect devices to the same network, find the server computer's IPv4 address with `ipconfig`, and open `http://<that-address>:3000` on each device. Use the same address consistently: browser storage is origin-specific. The server computer must remain running and its firewall must permit the connection. No router, firewall, tunnel, or hosting settings are changed by this project.

## Project files

| Files | Purpose |
| --- | --- |
| `index.html`, `css/styles.css` | Existing application shell and responsive horror UI, extended with room and Check screens |
| `js/rules.js` | Shared pure rules, usable in the browser and Node |
| `js/state.js` | Shared validated state transitions; Solo persistence and isolated server stores |
| `js/app.js` | Existing game controls and reusable Check result rendering |
| `js/socket.js`, `js/multiplayer.js` | Network intent transport, reconnect identity, lobby and multiplayer controls |
| `server/server.js` | Express/Socket.IO entry point, static assets and health route |
| `server/room-manager.js`, `server/validation.js` | Canonical rooms, identities, permissions and input/state validation |
| `server/check-manager.js`, `server/socket-handlers.js` | Authoritative Check transitions and Socket.IO routing |
| `tests/*.test.js`, `tests.html` | Automated regressions and browser smoke tests |
| `package.json`, `package-lock.json`, `.gitignore` | Runtime dependencies, scripts and generated-file exclusions |

## Multiplayer Pass 3 (complete)

Host and Players share character sheets with five fixed Core Aspects and five stable Story slots. Host and authorized assigned Players edit names, Ratings, Archetype, Description, Notes, Gear and Perks using SAVE CHARACTER. The Host can turn Player editing off. Story renames preserve IDs and Strain. Normal Checks send characterId and aspectId; the server snapshots name, Rating, base TN, difficulty and final TN. Players no longer confirm Ratings. Manual TN remains a Host option.

Strain buttons act directly on Aspect IDs. Auto-apply Strain Flaw is optional. Fixed story size determines death at 6/5/4/4/3/2 Wounds for 1–6 characters. Six-character stories change to threshold 3 after two distinct characters perish. Three-character stories grant each character one Strain removal per story. Set story size before play; adding/removing roster entries does not silently change it.

The assigned Player draws, rolls and resolves; other Players observe. Host can take over or cancel. Check data, character sheets and assignments survive reconnect. The inline SVG skull favicon requires no image asset.

### State authority and permissions

Multiplayer clients send intents, never authoritative dice or outcomes. Production draws and d6 faces use Node `crypto.randomInt` on the server. A constructor-injected RNG supports deterministic tests; it is not exposed over the socket. Shared `js/rules.js` and `js/state.js` perform composition, retained dice, totals, Wound eligibility, resolution and Omen bookkeeping, avoiding a second implementation of the rules.

The server validates authenticated room identity, role, current assignment, Check ownership, active character, phase, allowed payload fields, version, eligibility and the 13-Omen invariant. Only the Host calls Checks or changes management settings. Players can control only their assigned pending Check. The pending owner/character assignment is locked. Manual corrections, imports and reset are blocked while a Check is unresolved; multiplayer imports cannot inject Check records/results. The Host remains a trusted game administrator with validated correction tools outside a pending Check.

The current schema is version `5`; multiplayer adds the `AWAITING_PLAYER` phase and Check ownership/configuration metadata to `currentCheck`. The Check snapshots the Act **when the Host calls it**. Solo continues to snapshot on drawing. Changing the story Act with locking disabled never changes the pending Check's Act.

### Reconnect and duplicate actions

Rooms hold stable player IDs and private cryptographic reconnect tokens. Only token hashes are kept in server identity records; tokens are never broadcast or logged. Browser refresh or temporary network loss restores the same identity, assignment, phase, dice and result from the server without drawing or rolling again. A disconnected owner leaves the Check pending and the Host sees a waiting/takeover message.

A browser profile stores one resumable identity for this app origin. Reusing it in another tab replaces the old live connection; use separate browser profiles/devices for different Players. Leaving for Solo retains the resumable identity, while the saved mode prevents Solo refresh from unexpectedly rejoining. Multiplayer snapshots never overwrite the Solo save.

Each mutation carries a `baseVersion`; existing-Check intents also carry `checkId`. The server handles each validated transition synchronously, advances the version, and rejects stale or wrong-phase requests. Repeated Draw, Roll, Reroll or resolution requests cannot apply twice. Clients disable controls while busy/offline, refresh stale snapshots, and never blindly retry an uncertain mutation after an acknowledgement timeout.

### Socket contract

Successful acknowledgements use `{ ok: true, room?, session? }`; errors use `{ ok: false, error: { code, message } }`. `room:state` broadcasts canonical snapshots only within the affected room. Presence revisions are separate from game versions so presence updates do not silently change a pending game transaction.

| Events | Access and payload |
| --- | --- |
| `room:create`, `room:join`, `room:reconnect` | Create/join a session or authenticate a saved reconnect identity |
| `room:sync`, `room:leave` | Current session sync/leave |
| `player:assign-character` | Host assignment management |
| `game:action` | Host management, plus own-character Player saves when enabled; validated fields and state version |
| `check:create` | Host; `{ configuration, baseVersion }` |
| `check:set-rating` | Retired compatibility endpoint; normal Ratings are locked |
| `check:draw`, `check:roll`, `check:reroll` | Check controller; `{ checkId, baseVersion }` |
| `check:select-roll` | Check controller; `{ checkId, baseVersion, rollName }` |
| `check:take-wound`, `check:cheat-death`, `check:valiant-sacrifice`, `check:finish` | Eligible Check controller; `{ checkId, baseVersion }` |
| `check:cancel`, `check:takeover` | Host; `{ checkId, baseVersion }` |

`configuration` contains `characterId`, `aspectId`, `manualTn`, `difficultyModifier`, `edges`, `flaws`, `risky`, `harmless`, `forcedOmen`. Only manual Checks accept `aspect` and `baseTn`. Normal Checks reject client Rating/TN fields.

The Pass-1 `game:check-state` endpoint is retired and rejects snapshots, including Host snapshots. `check:set-dice`, `check:set-result`, `check:set-total`, `check:set-wounds` and `check:replace-pending-check` explicitly reject outcomes. Extra payload fields such as supplied dice, totals or eligibility are rejected.

### Hosting and limitations

The existing Node/Express/Socket.IO setup remains compatible with `npm ci`, `npm start`, `process.env.PORT` and `0.0.0.0`. To update an existing Render deployment, push the changed project files to the same linked GitHub branch if auto-deploy is enabled; see [Render's deployment documentation](https://render.com/docs/deploys). No Render configuration or deployment was performed in this pass.

Rooms exist only in one server process's memory. Server restart/redeploy loses rooms and reconnect targets; this is not permanent persistence or a multi-worker deployment. No accounts, database, chat, matchmaking, external integrations or infrastructure were added. Disconnected seats remain reserved; Host eviction and lost-token recovery are not implemented. Character sheets store all ten Aspects. Static-only hosting supports Solo, not multiplayer.

A sensible next phase is durable room recovery across server restarts, followed by explicit seat/token recovery and usability improvements. Those are recommendations, outside this pass.

## Persistent Game State

In Solo mode, the app stores game state in `localStorage`, including the current Act, bag composition, Host Omens, character Wounds, character status, Cheat Death use, Strain, current pending Check, and the history log. Refreshing the browser should not erase the game, even if dice have been drawn but not rolled or a Wound is awaiting resolution.

The current state schema is version `5`. The existing localStorage key is retained. Valid older single-character saves and JSON imports migrate to `characters: [...]` and `selectedCharacterId`; the original character keeps their Wounds, Strain, status, and Cheat Death use and receives a persistent unique ID. Older phased Checks receive the migrated character ID and saved story Act when those snapshots are missing. Version 1 one-step Check data without phase information is discarded while persistent game state is retained. Migration is saved immediately on successful load so IDs survive refresh.

Malformed imports are rejected before replacing the game, including invalid counts, IDs, selection, Wounds, status, Strain, pending Checks, and Omen totals. Invalid stored saves fall back to a fresh game and emit a console warning; the original stored value is not overwritten during that failed load.

Use **New Game** to intentionally reset the saved state. The button asks for confirmation. It restores 8 Safe Dice, 13 Host Omens, 0 Bag Omens, Prologue, one active default character with no Wounds or Strain and unused Cheat Death, and no Check. Both Host preference toggles are preserved.

## Characters and Host Preferences

The compact Characters section supports **1–6 characters**, each with a stable unique ID and a trimmed, nonblank editable name. Duplicate names are allowed. Select a roster entry to choose who makes the next Check; **CHECKING FOR** names that character. Each entry shows Wounds and active/inactive status; the selected character also shows Strain and Cheat Death availability. Adding a seventh character and removing the final character are blocked.

Wounds, the automatic three-Wound Flaw, Cheat Death (once per story), Strain by Aspect, death/despair, and Valiant Sacrifice are independent for every character. Inactive characters cannot draw; the Host can reactivate them. Removing a character returns only their Wound Omens to the bag. A pending Check's owner cannot be removed, and character selection is locked until resolution or cancellation.

Host Tools has its own character selector for correcting Wounds, status, Cheat Death use, and Strain. Strain corrections accept an object such as `{"Courage": 1, "Fight": 0}`. Persistent corrections are blocked during pending Checks, and corrections must preserve the 13-Omen total.

**Auto-apply Strain Flaw** defaults **OFF**. Strain is always tracked and displayed. When ON, a matching Aspect with any Strain contributes exactly +1 Flaw. The optional Aspect name field supports names such as Courage or Fight; leaving it blank preserves the existing rating-based Aspect names. The existing rating and manual TN controls still determine the target number. Declared Flaws, Wound Flaws, matching Strain Flaws, Forced Omen Flaws, and their total are displayed separately.

**Lock Act during pending Check** defaults **ON**. Every Check snapshots both `characterId` and `act` at **Reach Into The Bag** in Solo or **Call for Check** in multiplayer; the project retains its existing `currentCheck` transaction field. All subsequent rolls, rerolls, and resolution use that Check's Act. The lock disables Act changes until resolution or cancellation. Turning it OFF permits changing the story Act, but never changes the pending Check's snapshot. The result panel displays both Acts explicitly. Both preferences and pending snapshots survive export, import, and refresh.

## Dice Bag Model

The bag tracks counts of individual d6 types:

- Safe Dice
- Omen Dice

A Check randomly draws actual dice from the current bag without replacement. The app does not roll independent percentages, so impossible combinations cannot be produced. Drawn dice are temporary: they normally return after the Check, unless a rule removes one.

## Check Lifecycle

Checks now use an explicit transaction:

1. **Reach Into The Bag** draws die identities and sources only.
2. **Roll Dice** assigns d6 results and calculates the selected roll.
3. Optional **Reroll Same Dice** preserves the exact same die types and sources, rolls new d6 faces, recalculates kept dice, success level, Risky failure, and Omen Wound eligibility.
4. The controller may use **Use Original** or **Use Reroll**. Higher total is automatically selected as better; tied or table-specific cases can be selected manually.
5. **Finish Check**, **Take Wound**, **Cheat Death**, **Harmless** resolution, or **Valiant Sacrifice** settles the transaction.

Persistent bag and Wound state are not permanently changed until the Check is finalized or resolved. **Cancel Check** is a Host correction tool that aborts an unresolved Check; bag dice return conceptually, and a pending Forced Omen returns to the Host pool.

## Target Numbers

The Host may select an Aspect or enable manual TN entry.

- Great: TN 4
- Good: TN 5
- Average: TN 7
- Bad: TN 9
- Terrible: TN 10

Difficulty modifies the base TN from Very Easy `-2` through Very Hard `+2`. The result is:

- Roll total greater than TN: Full Success
- Roll total equal to TN: Success With Complication
- Roll total below TN: Failure

## Edges And Flaws

Edges and Flaws cancel one-for-one before drawing.

- Net Edge: draw extra dice and use the two highest results
- Net Flaw: draw extra dice and use the two lowest results
- No net modifier: draw two dice and use both

At three Omen Wounds, the app automatically adds one Flaw to that character's Checks. A Forced Omen also acts as one Flaw, even if an Edge cancels that Flaw for total calculation.

Effective Flaws have **no rules cap**. Declared Flaws retain the existing 0–2 controls, but all automatic sources are added without clamping. For example, 2 declared + 1 Wound + 1 Strain + 1 Forced Omen = 5 Flaws: with no Edges, draw 6 bag dice plus the Forced Omen and keep the lowest two. Insufficient physical bag dice still block a Check.

## Wounds

Every Omen Die rolled is checked for Wounds, even if it was discarded by an Edge or Flaw and did not contribute to the Check total.

- Act 1: Omen result `1`
- Act 2: Omen result `1-2`
- Act 3: Omen result `1-3`
- Prologue: no automatic Omen Wound threshold

Only one Wound can be received from a single Check. When **Take Wound** is selected, one qualifying Omen is removed from the bag/game draw cycle and placed in front of the character. At the story-size death threshold described above, only that character succumbs to death/despair, the Wound Omens return to the bag, Wounds reset to `0`, and the character is marked inactive.

## Cheat Death

If a Check would cause an Omen Wound and at least one Safe Die from the bag participated in the Check, **Cheat Death** may be selected if it has not already been used. The app enforces both stated limits by treating Cheat Death as once per story, which is stricter than once per Act.

Cheat Death removes one Safe Die from the bag, does not add an Omen Wound, and marks Cheat Death as used.

## Harmless And Risky

For a **Harmless** Check, a qualifying Omen causes Strain rather than a Wound. The app records Strain by the selected Aspect and returns the Omen to the appropriate pool.

For a **Risky** Check, the dice and success result are unchanged. If the Check fails, the app shows a Host reminder to adjudicate a consequence such as Strain, lost Gear, or an appropriate Perk being spent or broken.

## Forced Omen / Facing Evil

A Forced Omen comes directly from the Host Omen pool and is added to the Check as a required Omen Die. It also contributes one Flaw before Edge/Flaw cancellation.

Important draw math: a Forced Omen is already one of the physical dice in the Check. For example, Forced Omen with no Edges or ordinary Flaws draws `2` bag dice plus `1` Forced Omen, then keeps the lowest two. If one Edge cancels the Forced Omen's Flaw, the Check draws `1` bag die plus the Forced Omen and resolves normally. The Forced Omen is still rolled.

Implementation choice: the Forced Omen is moved out of the Host pool when the Check is drawn. If it does not become the selected Wound, it enters the bag after the Check resolves. If it becomes the Wound, it is placed with the character and does not also enter the bag. If several Omens qualify, a bag Omen is selected as the Wound before a Forced Omen for deterministic bookkeeping; all other Omens return to or enter the bag as appropriate.

The invariant is:

```text
Host Omens + Bag Omens + sum of ALL character Wounds + pending Forced Omen = 13
```

Automated tests assert this across normal resolution, Wounds, Cheat Death, Harmless Checks, Valiant Sacrifice, cancellation, and stress simulations.

## Valiant Sacrifice

When the character has three Omen Wounds and the drawn/included dice contain at least one Omen Die, **Valiant Sacrifice** becomes available before rolling. Selecting it generates no die results, marks the Check as an automatic success, returns current Wound Omens to the bag, returns any Forced Omen to the bag, resets Wounds to `0`, and marks the character inactive/dead.

## Reroll Same Dice

Rerolling preserves the exact die types and sources from the current Check. It generates new d6 results, recalculates the kept dice, Check total, success level, Risky failure, and Omen Wound eligibility. The selected roll controls final Wound resolution, so a reroll can introduce a qualifying Omen or remove one from the active result.

## Export And Import

Use **Export Session JSON** on **HISTORY & SAVE** to place formatted JSON in the text area. Use **Import Session JSON** to restore a saved JSON state. Imported state is normalized and validated before replacing the current game. Solo supports pending Check restoration. Multiplayer import is Host-only, requires no unresolved Check, and rejects any imported `currentCheck`; it cannot submit client-generated Check outcomes.

## Verification

Historical Pass-2 verification had **193 passing tests**. Current verification is listed below:

| Suite | Passing tests |
| --- | ---: |
| Existing rules | 44 |
| Existing state/migration | 28 |
| Existing DOM interaction | 8 |
| Pass-1 room/server regressions | 48 |
| Pass-1 network client regressions | 11 |
| New Pass-2 authoritative Checks | 54 |
| Total | 193 |

All 139 carried-forward tests pass. Transitional Pass-1 tests were updated to assert retirement of client Check snapshots and use the authoritative flow; no prior tests were removed. The 54 Pass-2 tests cover deterministic draw composition, fake outcomes, ownership, all Omen resolution paths, rerolls, Act snapshots/locks, assignment locks, reconnect before/after drawing and rolling, isolated rooms and duplicate/racing actions. Real Socket.IO integration tests exercise Host and Player clients. The original DOM suite uses a minimal adapter, while the following checks used actual browsers.

Manual local verification used a Host and two independent Player browser sessions, with separate loopback origins for separate storage:

- Room creation/join, character assignment and observer-only controls worked.
- The assigned Player confirmed Rating, drew and rolled; Host and observer displayed identical dice types, numbers and results.
- Player refresh preserved DRAWN dice, then preserved a rolled Check awaiting Wound resolution. Host refresh also reconnected during the pending Check.
- Cheat Death and pre-roll Valiant Sacrifice resolved on the server and preserved the Omen total of 13.
- Player disconnect showed the waiting state; Host takeover and cancellation worked.
- Returning to Solo and refreshing retained independent Solo mode/state.
- Host and both Player browser consoles had no warnings or errors. Server console inspection showed no obvious exceptions or secret logging.

Earlier Pass-1 manual testing also covered a Host plus three Players, shared Act/Bag updates, assignment persistence and synchronized resolution. These were local HTTP tests, not physical LAN-device or production Render tests. Desktop UI was visually inspected; narrow mobile layout was not reverified in this pass. `tests.html` remains available for a small browser rules smoke test.

## Change inventory

Across the requested multiplayer work, added files are `package.json`, `package-lock.json`, `.gitignore`, `js/socket.js`, `js/multiplayer.js`, all five files under `server/`, and `tests/multiplayer.test.js`, `tests/network-client.test.js`, `tests/checks.test.js`.

Changed existing files are `index.html`, `css/styles.css`, `js/rules.js`, `js/state.js`, `js/app.js` and this README. Pass 2 adds `server/check-manager.js` and `tests/checks.test.js` to the Pass-1 foundation and updates its server, transport, UI and transition tests. The original rules/state/DOM test files remain intact.

### Pass 3 verification (2026-09-13)

All 200 tests pass, including seven dedicated sheet/migration/group-size/TN/favicon tests. Updated obsolete Check and state tests; fixed legacy named-Strain lookup when using Aspect IDs. Browser verification covered Host edits, matching read-only Player sheets, Good Courage + Hard = TN 6, Player draw/roll and reconnect with unchanged drawn dice. This describes the historical Pass-3 behavior; current Player editing is described below.


## Character editing and UI production fixes (2026-09-13)

The existing vanilla JavaScript/Express/Socket.IO app remains in place. Run `npm ci`, `npm test`, and `npm start`; Render still uses `process.env.PORT`, binds `0.0.0.0`, and needs no new dependencies or services. The inline **💀 skull favicon** is unchanged.

### Save a character

Open **CHARACTERS** (Host/Solo) or **MY CHARACTER** (Player). Edit the identity fields, ten Aspect slots, Perks, Gear, and Notes, then press the prominent **SAVE CHARACTER** button. This commits one complete validated sheet transaction. A successful acknowledgement displays **Character saved.** Failures remain inline and preserve the draft. The duplicate standalone Rename control is hidden.

**Add Perk** and **Add Gear** insert editable draft entries immediately, each with a generated stable ID. Edit or remove entries in the list, then Save Character to persist them. Automation is explicitly selected: Bossy stores `ruleKey: "bossy"`; **Custom / Manual** stores `null`. Typed names never select automation. Existing usage and disabled status are retained.

Unsaved fields display **Unsaved changes** and survive tab switches, character selection, and unrelated room broadcasts for the lifetime of the page. Save before refreshing or closing the page. Drafts are not a second authoritative character state. Accepted full-sheet saves apply the submitted editable fields; there is no collaborative text merge.

The Rating is authoritative; normal TN is never an editable character field. `Rules.getTargetNumberForRating` is used by the sheet, Check caller, server Check creation, and applicable Perk calculations:

| Rating | Derived TN |
| --- | ---: |
| Terrible | 10 |
| Bad | 9 |
| Average | 7 |
| Good | 5 |
| Great | 4 |

A dropdown change previews TN immediately; Save broadcasts the committed Rating to every connected view. A pending Check keeps its existing Rating/TN snapshot. A subsequent Check uses the saved Rating. The existing explicit **Host manual TN Check** override remains available.

The stale display came from an uncommitted form: TN text only updated on rendering, drafts could be discarded by room rerenders, and full-sheet saves always included Perks, which previously blocked even unchanged Perks during a pending Check. Draft retention, immediate derived-TN rendering, save acknowledgement, and semantic comparison of unchanged Perks fix these paths.

### Player permissions

**ALLOW PLAYERS TO EDIT THEIR OWN CHARACTER SHEET** defaults **ON**, including when loading older schema-5 saves that lack the setting. The Host controls it from CHARACTERS. When enabled, an authenticated Player may save only their assigned character's Name, Archetype, Description, Ratings, Story Aspect names, Perks, Gear, and Notes. When disabled, the shared Player sheet is read-only; character export remains available.

The server checks identity, assignment, setting, revision, field allowlists, valid Ratings, five fixed Core IDs/names, five stable Story IDs, and valid unique Perk/Gear IDs. Wounds, Strain, Cheat Death state, active/dead state, Safe Dice, Omen bookkeeping, usage, disabled-Perk state, group rules, and assignment remain Host/mechanics controlled. Player attempts to submit protected fields or edit someone else's character are rejected atomically. Story renames retain their IDs and Strain.

### Main views

- **GAME:** room connection, Story/Act state, Scene and Perk actions, Bag/Host Omens, Check caller, and pending Check/results/actions.
- **CHARACTERS:** roster, assignments, fixed story count, player-edit setting, full shared sheet, Host correction tools, add/remove, Save Character, and Character File controls.
- **HISTORY & SAVE:** session history and room log, Export/Import Session JSON, and New Game/reset utilities.

Players have **GAME / CURRENT CHECK**, **MY CHARACTER**, and **HISTORY**. The history view contains the existing room/session history. Accessible native buttons indicate selection with `aria-pressed`; CSS changes panel visibility without navigation, cloning sheets, or changing game/Check state. Mobile tabs wrap their labels and sheet rows fit narrow widths.

### Character files versus session files

**EXPORT CHARACTER** creates `13-omens-character-<safe-name>.json` from the saved character and exposes a read-only JSON preview/download link. The envelope is `{ "type": "13-omens-character", "version": 1, "exportedAt": "...", "character": { ... } }`.

Exports contain identity text, ten Aspects/Ratings/Strain, Wounds, Cheat Death, active state, strain-relief and Safe-die-loss continuity, Perks/ruleKeys/disabled status/usage, Gear, and Notes. Explicit allowlists exclude room codes, assignments, player/socket/Host IDs, reconnect tokens, pending Checks, Bag state, and other characters. Players may export only the assigned character shown in their UI.

Host/Solo **IMPORT CHARACTER** accepts this versioned JSON and creates a new unassigned character with a new character ID. Aspect and entry IDs remain stable within the new character. It preserves character continuity; it does not silently heal Wounds or clear Strain/usage. Duplicate display names are allowed. Exactly six characters is the maximum, and fixed `storyCharacterCount` does not change. Malformed type/version, structure, Ratings, IDs, strings, arrays, or protected fields reject before any room mutation. Files above 512 KB reject in the picker, and the server retains its existing message limit.

Because Wounds are Omens, import transfers the imported Wound count from the Host pool, preserving the room's 13-Omen invariant. Insufficient Host Omens reject with a clear message. Import requires no unresolved Check. Fresh-copy/reset-on-import is not included.

**Export/Import Session JSON** instead saves/restores the complete game state, including all characters, Bag, settings, scene and history. Game schema remains **5**, and standalone character-file schema is **1**. Existing migrations are retained. Multiplayer session import still rejects Check snapshots and requires a resolved/cancelled Check.

### Pass 4 and current limitations

Pass 4 remains implemented: The Truth, Carry On, Awkward Pause, Bossy, Gripe and Complain, Local Edge, Lucky, Five Minute Break, Late for Work, Chill Out, Very Tired, Eager to Help, Tech Pro, Code Wizard, Encyclopedic Memory, and the supported conditional Scene Edge rule. Explicit automation keys, scene/Act/story usage, reconnect persistence, server validation, refunds, and conditional activation remain unchanged. Custom/manual Perks remain supported. Perk additions/removals/changes still require resolving or cancelling a pending Check; saving unchanged Perks with changed Ratings is allowed, protecting current automation snapshots.

Rooms remain in server memory and disappear on server restart. Unsaved drafts do not survive browser reload. Normal character import preserves continuity and has no optional fresh-copy mode. No production deploy or physical LAN/mobile-device test was performed in this pass.

### Current verification

`npm test`: **278 passing tests**, no failures (44 rules, 28 state, 8 existing DOM interactions, 48 rooms, 11 network clients, 54 authoritative Checks, 7 Pass-3, 54 Pass-4 Perks, 24 new character tests). Existing tests were retained; old default-setting and Player read-only expectations were updated to the requested behavior.

The new suite covers every Rating through save and server Check creation, shared sheet TN markup, assigned Player saves, wrong-character/setting/protected-field rejection, stable entries, session/reconnect persistence, unchanged pending snapshots, character export secret exclusion, full-state import/round-trip, malformed files, duplicate names, capacity, Omen conservation, defaults, and real Socket.IO broadcasts/reconnect/stale revisions.

Interactive browser verification used separate loopback origins for Host and Bob. Jasper Courage Average → Good saved as TN 5 on both views; the Host called Courage Hard (+1), the shared Check used Base 5 / Final 6, and Bob drew, rolled, and finished. Bob saved Fight Bad, Occultism Great, Bossy automation, and Flashlight; Host received all changes and Player refresh retained the exact entry IDs. Host OFF/ON switched Player editing live. The exported JSON was inspected and its matching payload imported through the file picker into a fresh room, preserving data with a new unassigned character ID. Tab switches and an unrelated Omen update preserved a draft. Host and Player narrow layouts were checked at 390 pixels; no horizontal page overflow was observed. The embedded browser did not report a download event, so the JSON preview and file-picker round-trip were verified; browser-managed disk download completion was not independently observed.
