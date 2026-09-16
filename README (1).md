# 13 Omens Discord Bot

## Commands

| Command | Brief description |
|---|---|
| `/ping` | Check whether the bot is online and responding. |
| `/game create` | Create a new 13 Omens campaign in the current channel. |
| `/character create` | Create a new blank character. |
| `/character edit` | Open the editor for a character you are allowed to control. |
| `/character import` | Import a compatible 13 Omens character JSON file. |
| `/character export` | Export a character as a portable JSON file. |
| `/character list` | List the characters in the current campaign. |
| `/character assign` | Assign a Discord player to a character. |
| `/character unassign` | Remove a player's assignment from a character. |
| `/character mine` | Show the character assigned to you. |
| `/check` | Call for a 13 Omens Check. |
| `/perk status` | Show the current Perk status for a character. |
| `/perk use` | Use an eligible automated Perk outside a Check. |
| `/gm status` | Show campaign, dice bag, Omen, Act, Scene, and Check status. |
| `/gm act` | Change the current Act. |
| `/gm scene-next` | Advance to the next Scene. |
| `/gm omen-add` | Move one Host Omen into the dice bag. |
| `/gm omen-remove` | Return one Omen from the bag to the Host pool. |
| `/gm story-size` | Set the number of characters in the story. |
| `/gm cancel-check` | Cancel a pending Check and restore temporary resources when appropriate. |
| `/gm strain-add` | Add Strain to a specific Aspect. |
| `/gm strain-remove` | Remove Strain from a specific Aspect. |
| `/gm wound-add` | Manually give a character one Wound while preserving the Omen economy. |
| `/gm wound-remove` | Remove one Wound and return its Omen to the Host pool. |
| `/gm revive` | Reactivate a character who died or succumbed to despair. |
| `/gm perk-reset` | Clear recorded Perk usage for one character. |

---

## Command Details

### `/ping`

Checks whether the bot is online and responding.

```text
/ping
```

### `/game create`

Creates a new 13 Omens campaign in the current Discord channel. The Discord user who creates the campaign becomes that campaign's Game Master.

**Option**

- `name` — Optional campaign name.

```text
/game create name:Friday Night Horror
```

Only one campaign can exist in a channel at a time.

### `/character create`

Creates a new blank 13 Omens character and opens the character editor.

**Option**

- `name` — Required character name.

```text
/character create name:Jasper
```

Only the Game Master can create characters. Character names must be unique within the campaign.

### `/character edit`

Opens the interactive editor for a character the user is allowed to control.

**Option**

- `character` — Character name.

```text
/character edit character:Jasper
```

The editor supports Archetype, Core Aspects, Story Aspects, Description, Notes, Perks, and Gear. The Game Master may edit any character; players may edit only their assigned character. Long Description, Notes, Perk Notes, and Gear Notes remain fully stored even when Discord truncates their preview in an embed.

Perks and Gear support up to 50 entries each. Discord displays them in pages of up to 25 entries.

### `/character import`

Imports a compatible 13 Omens JSON character file.

**Option**

- `file` — Character JSON file exported from the 13 Omens app or bot.

```text
/character import file:<character.json>
```

Only the Game Master can import characters. Imports use the shared 13 Omens character validation logic. A character cannot be imported if another character in the same campaign already has the same name, ignoring capitalization and surrounding spaces.

### `/character export`

Exports a character as a portable JSON file.

**Option**

- `name` — Character name.

```text
/character export name:Jasper
```

The Game Master may export any character. A player may export their assigned character. Discord-only campaign and assignment data are not included in the portable character file.

### `/character list`

Lists all characters in the current campaign, including character name, Archetype, active/dead status, and assigned Discord player.

```text
/character list
```

### `/character assign`

Assigns a Discord player to a character.

**Options**

- `character` — Character name.
- `player` — Discord user.

```text
/character assign character:Jasper player:@Player
```

Only the Game Master can assign characters. A player can normally control only their assigned character.

### `/character unassign`

Removes the Discord player currently assigned to a character.

**Option**

- `character` — Character name.

```text
/character unassign character:Jasper
```

Only the Game Master can unassign characters.

### `/character mine`

Displays the character assigned to the user running the command.

```text
/character mine
```

### `/check`

Calls for a 13 Omens Check.

**Required options**

- `character` — Character making the Check.
- `aspect` — Core or Story Aspect being checked.

**Optional options**

- `difficulty` — Very Easy, Easy, Average, Hard, or Very Hard.
- `edges` — Host-awarded Edges from 0–2.
- `flaws` — Host-declared Flaws from 0–2.
- `risky` — Marks the Check as Risky.
- `harmless` — Makes an Omen wound cause Strain instead of a Wound when applicable.
- `forced_omen` — Spend a Host Omen to force an Omen die into the Check.

A normal Check flow is:

```text
GM calls /check
↓
CHECK CALLED card appears
↓
Player clicks Reach Into the Bag
↓
Dice are drawn from the campaign bag
↓
Player clicks Roll Dice
↓
The result is calculated
↓
Eligible Perks / Wounds / Cheat Death are resolved
↓
The Check finishes
```

The Discord bot uses the same shared 13 Omens state and rules logic as the web application wherever possible.

### `/perk status`

Displays the current Perk status for a character.

```text
/perk status
```

The Game Master can specify another character when the command offers the `character` option.

```text
/perk status character:Jasper
```

The display can include automated Perks, usage state, timing, manual/custom Perks, and current Strain.

### `/perk use`

Uses an eligible automated Perk that functions outside a Check.

```text
/perk use
```

The Game Master can specify another character when the command offers the `character` option.

```text
/perk use character:Jasper
```

Outside-Check Perks include effects such as **Five Minute Break** and **Late for Work**. If a Perk removes Strain, Discord prompts for the Strained Aspect to clear. Outside-Check Perks cannot be used while an unresolved Check is active.

### `/gm status`

Displays the current campaign state, including Act, Scene, Story Size, Safe Dice, Bag Omens, Host Omens, Wound Omens, active characters, Omen economy, pending Check, and character Wounds.

```text
/gm status
```

The Omen economy should normally total:

```text
Host Omens + Bag Omens + Character Wound Omens = 13
```

### `/gm act`

Changes the current Act.

**Option**

- `act` — Prologue, Act 1, Act 2, or Act 3.

```text
/gm act act:Act 2
```

Act changes affect rules that depend on the current Act, including Act-limited Perks and other Act-dependent mechanics.

### `/gm scene-next`

Advances the campaign to the next Scene.

```text
/gm scene-next
```

Scene-limited Perks can become available again when the Scene changes.

### `/gm omen-add`

Moves one Omen from the Host pool into the dice bag.

```text
/gm omen-add
```

### `/gm omen-remove`

Moves one Omen from the dice bag back to the Host pool.

```text
/gm omen-remove
```

Both Omen movement commands preserve the campaign's total Omen economy.

### `/gm story-size`

Sets the number of characters used for story calculations.

**Option**

- `count` — 1 through 6.

```text
/gm story-size count:4
```

### `/gm cancel-check`

Cancels the currently unresolved Check and restores temporary resources when appropriate.

```text
/gm cancel-check
```

This is useful when a Check was called incorrectly, a test Check should be abandoned, or play needs to recover from an interrupted Check.

### `/gm strain-add`

Adds Strain to one specific Aspect.

**Options**

- `character` — Character name.
- `aspect` — Aspect name.

```text
/gm strain-add character:Jasper aspect:Courage
```

The command refuses to add Strain if the Aspect is already Strained.

### `/gm strain-remove`

Removes Strain from one specific Aspect.

**Options**

- `character` — Character name.
- `aspect` — Aspect name.

```text
/gm strain-remove character:Jasper aspect:Courage
```

The command refuses to remove Strain if the Aspect is not currently Strained.

### `/gm wound-add`

Manually gives a character one Wound.

**Option**

- `character` — Character name.

```text
/gm wound-add character:Jasper
```

The bot moves one Omen from the Host pool to the character's Wounds so the Omen economy remains correct. If the Wound reaches the relevant death/despair threshold, the character can perish and their accumulated Wound Omens return to the bag. This command cannot be used while a Check is unresolved.

### `/gm wound-remove`

Manually removes one Wound.

**Option**

- `character` — Character name.

```text
/gm wound-remove character:Jasper
```

The removed Wound Omen returns to the Host pool. The command cannot be used while a Check is unresolved.

### `/gm revive`

Reactivates a character who died or succumbed to despair.

**Option**

- `character` — Character name.

```text
/gm revive character:Jasper
```

Revive sets the character Active, removes them from the perished-character list, clears the death/despair status message, and sets Wounds to 0. It does not move Omen dice, reset Strain, reset Cheat Death, reset Perk usage, or restore spent resources automatically. It cannot be used during an unresolved Check.

### `/gm perk-reset`

Clears recorded Perk usage for one character.

**Option**

- `character` — Character name.

```text
/gm perk-reset character:Jasper
```

This restores usage availability for once-per-Story, once-per-Act, and once-per-Scene Perks. It does not delete Perks, rename them, change automation, or re-enable a Perk deliberately disabled by the Game Master. It cannot be used while a Check is unresolved.

---

## Permissions

The campaign Game Master can create/import characters, edit any character, assign/unassign characters, export characters, call Checks, use GM controls, activate Perks on behalf of characters, correct Strain/Wounds, revive characters, and reset Perk usage.

Players can normally view, edit, and export their assigned character; reach into the bag and roll their own Check; use eligible Perks; and make character-specific resolution choices presented by the bot.

---

## Starting a Campaign

A typical setup is:

```text
/game create name:My Horror Game
/character create name:Jasper
/character assign character:Jasper player:@Player
/gm story-size count:4
/gm act act:Prologue
/gm status
```

Characters may be imported instead of created manually.

---

## Character Import and Export

Character files are portable JSON documents compatible with the 13 Omens character structure used by the web application and Discord bot.

Typical workflow:

```text
/character export name:Jasper
```

Later:

```text
/character import file:Jasper.json
```

Duplicate character names are rejected within a campaign to prevent ambiguous Discord commands.

---

## Project Structure

```text
.
├── discord/                 Discord bot and production command handlers
├── js/                      Shared 13 Omens web/rules/state code
├── server/                  Web multiplayer server
├── tests/                   Automated tests
├── index.html               Web application
├── tests.html               Browser test runner
├── package.json
├── package-lock.json
└── .gitignore
```

The Discord bot is another front end for the shared 13 Omens rules/state implementation rather than a separate rules engine.

---

## Environment Variables

Create a local `.env` file. Do not commit it to source control.

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_DB_PATH=
```

- `DISCORD_TOKEN` — Discord bot token.
- `DISCORD_CLIENT_ID` — Discord application/client ID.
- `DISCORD_GUILD_ID` — Test server ID used by guild-only command deployment.
- `DISCORD_DB_PATH` — Optional SQLite database path. If omitted, the bot uses `data/13-omens-discord.db`.

A safe `.env.example` may contain these variable names with blank values.

---

## Install

Requires Node.js 22 or newer.

```bash
npm install
```

---

## Run the Discord Bot

```bash
npm run discord
```

The bot handles clean shutdown on normal process termination and closes/checkpoints SQLite before exiting.

---

## Deploy Slash Commands

Deploy commands only to the configured test guild while developing:

```bash
npm run discord:deploy
```

Deploy commands globally for public installation:

```bash
npm run discord:deploy-global
```

Use global deployment only when the command definitions are ready for production.

---

## Tests

Run the automated test suite:

```bash
npm test
```

---

## Data and Persistence

The Discord bot stores campaign state in SQLite. By default:

```text
data/13-omens-discord.db
```

Production deployments can set `DISCORD_DB_PATH` to a persistent location.

The database, WAL/SHM files, `.env`, logs, and `node_modules` should remain excluded from GitHub.

---

## Production Notes

The project includes:

- Configurable SQLite storage with a local default.
- SQLite WAL mode, foreign keys, and a busy timeout.
- Graceful Discord/SQLite shutdown handling.
- Guild-only and global slash-command deployment scripts.
- Character import/export.
- Duplicate-name import protection.
- Perk/Gear pagination for entries 1–50.
- Discord embed-length protection while preserving full stored character text.

For a production host, keep the Discord token only in the host environment or `.env` file and keep persistent SQLite data outside the Git repository.
