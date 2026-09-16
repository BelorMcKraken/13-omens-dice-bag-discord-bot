# 13 Omens Discord Bot — Command Guide

This README documents the current Discord commands available in the **13 Omens Dice Bag** bot and explains what each command does.

The bot is designed to manage a 13 Omens game inside a Discord channel, including:

- Campaign creation
- Character creation and assignment
- Character import/export
- Checks and dice-bag resolution
- Automated and manual Perks
- Strain
- Wounds
- Omen economy
- GM controls
- Character recovery/testing tools

---

# Command Overview

## General Commands

### `/ping`

Checks whether the bot is online and responding.

**Example**

```text
/ping
```

---

# Campaign Commands

## `/game create`

Creates a new 13 Omens campaign in the current Discord channel.

The Discord user who creates the campaign becomes the **Game Master** for that campaign.

### Options

- `name` — Optional campaign name

**Example**

```text
/game create name:Friday Night Horror
```

Only one campaign should exist in a channel at a time.

---

# Character Commands

## `/character create`

Creates a new blank 13 Omens character.

### Options

- `name` — Required character name

**Example**

```text
/character create name:Jasper
```

Only the Game Master can create characters.

The new character uses the standard 13 Omens character structure and can then be edited through Discord.

---

## `/character edit`

Opens the interactive character editor.

### Options

- `character` — Character name

**Example**

```text
/character edit character:Jasper
```

The character editor allows editing:

- Archetype
- Core Aspects
- Story Aspects
- Description
- Notes
- Perks
- Gear

The GM may edit any character.

A player may edit only the character assigned to them.

---

## `/character import`

Imports a character from a compatible 13 Omens JSON character file.

### Options

- `file` — JSON file exported from the 13 Omens app or bot

**Example**

```text
/character import file:<character.json>
```

Only the Game Master can import characters.

Imported characters use the same character structure as the web app.

---

## `/character export`

Exports a character as a JSON file.

### Options

- `name` — Character name

**Example**

```text
/character export name:Jasper
```

A player may export their assigned character.

The GM may export any character.

The exported file can be imported again later.

---

## `/character list`

Lists all characters in the current campaign.

The list includes:

- Character name
- Archetype
- Active/dead status
- Assigned Discord player

**Example**

```text
/character list
```

---

## `/character assign`

Assigns a Discord user to a character.

### Options

- `character` — Character name
- `player` — Discord user

**Example**

```text
/character assign character:Jasper player:@Belor
```

Only the Game Master can assign characters.

A player normally controls only the character assigned to them.

---

## `/character unassign`

Removes the Discord player currently assigned to a character.

### Options

- `character` — Character name

**Example**

```text
/character unassign character:Jasper
```

Only the Game Master can unassign characters.

---

## `/character mine`

Displays the character assigned to the user running the command.

**Example**

```text
/character mine
```

The display includes character information such as:

- Core Aspects
- Story Aspects
- Perks
- Gear
- Wounds
- Strain
- Other current character state

---

# Checks

## `/check`

Calls for a 13 Omens Check.

The Game Master selects the character and Aspect, plus any optional modifiers.

### Required Options

- `character` — Character making the Check
- `aspect` — Core or Story Aspect being checked

### Optional Options

- `difficulty`
- `edges`
- `flaws`
- `risky`
- `harmless`
- `forced_omen`

---

## Difficulty

Available difficulty settings are:

- Very Easy
- Easy
- Average
- Hard
- Very Hard

Difficulty modifies the final Target Number according to the 13 Omens rules.

---

## Edges

```text
edges:0-2
```

Adds Host-awarded Edges to the Check.

Edges affect the number of dice drawn and which dice are used for the final result.

---

## Flaws

```text
flaws:0-2
```

Adds Host-declared Flaws to the Check.

Flaws can increase the dice drawn and change the resolution method.

---

## Risky

```text
risky:true
```

Marks the Check as Risky.

A failed Risky Check may carry an additional narrative consequence determined by the GM.

---

## Harmless

```text
harmless:true
```

Marks the Check as Harmless.

When appropriate, an Omen result that would normally cause a Wound instead causes Strain according to the game rules.

---

## Forced Omen

```text
forced_omen:true
```

The Host spends an available Host Omen and forces it into the Check.

The Omen becomes part of the Check and is handled by the normal Omen rules.

---

# Check Flow

A normal Discord Check follows this sequence:

```text
GM calls /check
↓
CHECK CALLED card appears
↓
Player clicks Reach Into the Bag
↓
Dice are drawn from the real campaign bag
↓
Player clicks Roll Dice
↓
Result is calculated
↓
Perks / Wounds / Cheat Death are resolved if necessary
↓
Check is finished
```

The bot uses the same 13 Omens state and rules engine as the web app.

---

# Active Perks During Checks

When an automated Perk is legal during the current Check phase, the player may see:

```text
✨ Use Perk
```

The bot checks Perk eligibility using the actual 13 Omens Perk rules.

Examples include:

- Lucky
- Bossy
- Awkward Pause
- Gripe and Complain
- Local Edge
- Eager to Help
- Tech Pro
- Code Wizard
- Encyclopedic Memory
- Scene Edge

Some Perks are automatic and therefore do not require a button.

Some custom/manual Perks do not have automation and must be resolved manually by the GM.

---

# Perk Commands

## `/perk status`

Displays the current Perk status for a character.

Players automatically view their assigned character.

The GM may specify another character.

### Optional Option

- `character` — GM only

**Examples**

```text
/perk status
```

```text
/perk status character:Jasper
```

The display may include:

- Automated Perks
- Usage status
- Timing
- Custom/manual Perks
- Current Strain

---

## `/perk use`

Uses an automated Perk that functions outside a Check.

Players normally use this for their assigned character.

The GM may specify another character.

### Optional Option

- `character` — GM only

**Examples**

```text
/perk use
```

```text
/perk use character:Jasper
```

Outside-Check Perks currently include effects such as:

- Five Minute Break
- Late for Work

If the Perk removes Strain, Discord will ask which Strained Aspect should be cleared.

Outside-Check Perks cannot be used while an unresolved Check is active.

---

# GM Commands

All `/gm` commands are restricted to the campaign Game Master.

---

## `/gm status`

Displays the current campaign state.

**Example**

```text
/gm status
```

The display includes:

- Act
- Scene
- Story Size
- Safe Dice
- Bag Omens
- Host Omens
- Wound Omens
- Active Characters
- Omen Economy
- Pending Check
- Character Wounds

The Omen economy should normally remain:

```text
13/13
```

---

## `/gm act`

Changes the current Act.

### Options

- `act`

Available values:

- Prologue
- Act 1
- Act 2
- Act 3

**Example**

```text
/gm act act:Act 2
```

Act changes affect rules that depend on the current Act, including Wound thresholds and Act-limited Perks.

---

## `/gm scene-next`

Advances the campaign to the next Scene.

**Example**

```text
/gm scene-next
```

Scene-limited Perks can become available again when the Scene changes.

---

## `/gm omen-add`

Moves one Omen from the Host pool into the dice bag.

**Example**

```text
/gm omen-add
```

This preserves the total 13-Omen economy.

---

## `/gm omen-remove`

Moves one Omen from the dice bag back to the Host pool.

**Example**

```text
/gm omen-remove
```

This preserves the total 13-Omen economy.

---

## `/gm story-size`

Sets the number of characters used for the story's death/despair threshold calculations.

### Options

- `count` — 1 through 6

**Example**

```text
/gm story-size count:4
```

---

## `/gm cancel-check`

Cancels the currently unresolved Check.

**Example**

```text
/gm cancel-check
```

Temporary resources are restored when appropriate.

This is useful if:

- The wrong Check was called
- The wrong character was selected
- A test Check needs to be abandoned
- The game needs to recover from an interrupted Check

---

# GM Strain Controls

## `/gm strain-add`

Adds Strain to one specific Aspect.

### Options

- `character`
- `aspect`

**Example**

```text
/gm strain-add character:Jasper aspect:Courage
```

The command refuses to add Strain if the Aspect is already Strained.

---

## `/gm strain-remove`

Removes Strain from one specific Aspect.

### Options

- `character`
- `aspect`

**Example**

```text
/gm strain-remove character:Jasper aspect:Courage
```

The command refuses to remove Strain if the Aspect is not currently Strained.

---

# GM Wound Controls

## `/gm wound-add`

Manually gives a character one Wound.

### Options

- `character`

**Example**

```text
/gm wound-add character:Jasper
```

This is not simply a number change.

The bot moves one Omen from the Host pool to the character's Wounds so that the Omen economy remains correct.

If the added Wound reaches the character's death/despair threshold:

- The character perishes
- Their accumulated Wound Omens return to the bag
- Their status becomes inactive/perished

The command cannot be used while a Check is unresolved.

---

## `/gm wound-remove`

Manually removes one Wound.

### Options

- `character`

**Example**

```text
/gm wound-remove character:Jasper
```

The removed Wound Omen returns to the Host pool.

The bot verifies the Omen economy before saving the change.

The command cannot be used while a Check is unresolved.

---

# GM Recovery Controls

## `/gm revive`

Reactivates a character who died or succumbed to despair.

### Options

- `character`

**Example**

```text
/gm revive character:Jasper
```

Revive does the following:

- Sets the character back to Active
- Removes the character from the perished-character list
- Clears the death/despair status message
- Sets Wounds to 0

Revive does **not**:

- Move any Omen Dice
- Reset Strain
- Reset Cheat Death
- Reset Perk usage
- Restore spent resources automatically

This is intentional because the Wound Omens were already returned to the bag when the character originally perished.

The command cannot be used during an unresolved Check.

---

## `/gm perk-reset`

Clears all recorded Perk usage for one character.

### Options

- `character`

**Example**

```text
/gm perk-reset character:Jasper
```

This restores spent usage for things such as:

- Once per Story Perks
- Once per Act Perks
- Once per Scene Perks

It does **not**:

- Delete Perks
- Change Perk names
- Change Perk automation
- Re-enable Perks that the GM deliberately disabled

The command cannot be used while a Check is unresolved.

This command is particularly useful during testing or if the GM intentionally wants to refresh a character's Perk resources.

---

# Perk Usage Timing

Automated Perks can have different timing rules.

Common timing labels include:

```text
AWAITING_PLAYER
DRAWN
ROLLED
AWAITING_WOUND_RESOLUTION
OUTSIDE_CHECK
```

The bot automatically checks whether a Perk is legal before allowing it to be activated.

---

# Omen Economy

There are always 13 Omen Dice in the campaign economy.

They may exist in different places:

```text
Host Omens
+
Bag Omens
+
Character Wound Omens
=
13
```

Some temporary Check states may also track a forced Omen while it is being resolved.

GM commands that move Omens are designed to preserve this total.

Use:

```text
/gm status
```

to verify the current Omen economy.

---

# Character Permissions

## Game Master

The campaign GM may:

- Create characters
- Import characters
- Edit any character
- Assign characters
- Unassign characters
- Export characters
- Call Checks
- Use GM commands
- Activate Perks on behalf of characters
- Correct Strain and Wounds
- Revive characters
- Reset Perk usage

## Players

A player may normally:

- View their assigned character
- Edit their assigned character
- Export their assigned character
- Reach into the bag for their Check
- Roll their Check
- Use eligible Perks
- Resolve character choices such as Wounds or Cheat Death when available

---

# Character Import / Export

Characters can be moved between sessions using JSON export files.

Typical workflow:

```text
/character export name:Jasper
```

Save the JSON file.

Later:

```text
/character import file:Jasper.json
```

The Discord character format is designed to remain compatible with the 13 Omens web application's character structure.

---

# Starting a New Campaign

A basic setup sequence is:

```text
/game create name:My Horror Game
```

Then create or import characters:

```text
/character create name:Jasper
```

Assign them:

```text
/character assign character:Jasper player:@Player
```

Set the correct story size:

```text
/gm story-size count:4
```

Set the current Act if needed:

```text
/gm act act:Prologue
```

Check the campaign:

```text
/gm status
```

Then begin play.

---

# Useful Testing Commands

During development or troubleshooting:

```text
/gm status
/gm strain-add
/gm strain-remove
/gm wound-add
/gm wound-remove
/gm perk-reset
/gm revive
/gm cancel-check
```

These give the GM enough control to recover from most testing situations without manually editing the database.

---

# Command Reference

```text
/ping

/game create

/character create
/character edit
/character import
/character export
/character list
/character assign
/character unassign
/character mine

/check

/perk use
/perk status

/gm status
/gm act
/gm scene-next
/gm omen-add
/gm omen-remove
/gm story-size
/gm cancel-check
/gm strain-add
/gm strain-remove
/gm wound-add
/gm wound-remove
/gm revive
/gm perk-reset
```

---

# Notes

The Discord bot uses the same shared 13 Omens rules/state code as the web Dice Bag application wherever possible.

This is important because the Discord interface should act as another front end for the same rules rather than maintaining a separate implementation of the game mechanics.

Before production deployment, the project should receive a final audit covering:

- Command registration
- Discord permissions
- Character permissions
- Check lifecycle
- Perk lifecycle
- Strain
- Wounds
- Death/despair
- Omen economy
- Persistence across restarts
- Older campaign-state migration
- Invalid or stale Discord buttons
- Production database persistence
- Environment variables and `.gitignore`

