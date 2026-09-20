"use strict";

require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");


// ====================================================
// Command definitions
// ====================================================

const commands = [

  // ==================================================
  // /ping
  // ==================================================

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Check whether the 13 Omens bot is awake."
    )
    .toJSON(),


  // ==================================================
  // /game
  // ==================================================

  new SlashCommandBuilder()
    .setName("game")
    .setDescription(
      "Manage a 13 Omens campaign."
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription(
          "Create a new 13 Omens campaign in this channel."
        )

        .addStringOption(option =>
          option
            .setName("name")
            .setDescription(
              "Optional name for this campaign."
            )
            .setRequired(false)
            .setMaxLength(100)
        )
    )

    .toJSON(),


  // ==================================================
  // /character
  // ==================================================

  new SlashCommandBuilder()
    .setName("character")
    .setDescription(
      "Manage 13 Omens characters."
    )

    // --------------------------------------------------
    // /character create
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription(
          "Create a new blank 13 Omens character and open the editor."
        )

        .addStringOption(option =>
          option
            .setName("name")
            .setDescription(
              "Name of the new character."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /character edit
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription(
          "Open the editor for a character you can control."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Name of the character to edit."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /character import
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("import")
        .setDescription(
          "Import a 13 Omens character JSON file."
        )

        .addAttachmentOption(option =>
          option
            .setName("file")
            .setDescription(
              "The exported 13 Omens character JSON file."
            )
            .setRequired(true)
        )
    )

    // --------------------------------------------------
    // /character export
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("export")
        .setDescription(
          "Export a character as a JSON file."
        )

        .addStringOption(option =>
          option
            .setName("name")
            .setDescription(
              "Name of the character to export."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /character list
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription(
          "List the characters in this campaign."
        )
    )

    // --------------------------------------------------
    // /character assign
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("assign")
        .setDescription(
          "Assign a Discord player to a character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Name of the character."
            )
            .setRequired(true)
            .setMaxLength(120)
        )

        .addUserOption(option =>
          option
            .setName("player")
            .setDescription(
              "Discord player who will control the character."
            )
            .setRequired(true)
        )
    )

    // --------------------------------------------------
    // /character unassign
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("unassign")
        .setDescription(
          "Remove a player's assignment from a character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Name of the character."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /character mine
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("mine")
        .setDescription(
          "Show the character assigned to you."
        )
    )

    .toJSON(),


  // ==================================================
  // /check
  // ==================================================

  new SlashCommandBuilder()
    .setName("check")
    .setDescription(
      "Call for a 13 Omens Check."
    )

    .addStringOption(option =>
      option
        .setName("character")
        .setDescription(
          "Character making the Check."
        )
        .setRequired(true)
        .setAutocomplete(true)
        .setMaxLength(120)
    )

    .addStringOption(option =>
      option
        .setName("aspect")
        .setDescription(
          "Core or Story Aspect used for the Check."
        )
        .setRequired(true)
        .setAutocomplete(true)
        .setMaxLength(120)
    )

    .addStringOption(option =>
      option
        .setName("difficulty")
        .setDescription(
          "Difficulty of the Check."
        )
        .setRequired(false)

        .addChoices(
          {
            name: "Very Easy",
            value: "Very Easy"
          },
          {
            name: "Easy",
            value: "Easy"
          },
          {
            name: "Average",
            value: "Average"
          },
          {
            name: "Hard",
            value: "Hard"
          },
          {
            name: "Very Hard",
            value: "Very Hard"
          }
        )
    )

    .addIntegerOption(option =>
      option
        .setName("edges")
        .setDescription(
          "Host-awarded Edges (0–2)."
        )
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(2)
    )

    .addIntegerOption(option =>
      option
        .setName("flaws")
        .setDescription(
          "Host-declared Flaws (0–2)."
        )
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(2)
    )

    .addBooleanOption(option =>
      option
        .setName("risky")
        .setDescription(
          "Failure may carry an additional narrative consequence."
        )
        .setRequired(false)
    )

    .addBooleanOption(option =>
      option
        .setName("harmless")
        .setDescription(
          "An Omen wound causes Strain instead of a Wound."
        )
        .setRequired(false)
    )

    .addBooleanOption(option =>
      option
        .setName("forced_omen")
        .setDescription(
          "Spend a Host Omen to force an Omen die into the Check."
        )
        .setRequired(false)
    )

    .toJSON(),


  // ==================================================
  // /perk
  // ==================================================

  new SlashCommandBuilder()
    .setName("perk")
    .setDescription(
      "View or use 13 Omens Perks."
    )

    // --------------------------------------------------
    // /perk use
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("use")
        .setDescription(
          "Use an eligible automated Perk outside a Check."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Perk should be used. GM only when specifying another character."
            )
            .setRequired(false)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /perk status
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription(
          "View current Perk status for a character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Perk status should be shown. GM only when specifying another character."
            )
            .setRequired(false)
            .setMaxLength(120)
        )
    )

    .toJSON(),


  // ==================================================
  // /gm
  // ==================================================

  new SlashCommandBuilder()
    .setName("gm")
    .setDescription(
      "Game Master controls for the current 13 Omens campaign."
    )

    // --------------------------------------------------
    // /gm status
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription(
          "View current campaign, bag, Omen, Act, and Check status."
        )
    )

    // --------------------------------------------------
    // /gm act
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("act")
        .setDescription(
          "Change the current Act."
        )

        .addStringOption(option =>
          option
            .setName("act")
            .setDescription(
              "The new Act."
            )
            .setRequired(true)

            .addChoices(
              {
                name: "Prologue",
                value: "Prologue"
              },
              {
                name: "Act 1",
                value: "Act 1"
              },
              {
                name: "Act 2",
                value: "Act 2"
              },
              {
                name: "Act 3",
                value: "Act 3"
              }
            )
        )
    )

    // --------------------------------------------------
    // /gm scene-next
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("scene-next")
        .setDescription(
          "Advance to the next Scene."
        )
    )

    // --------------------------------------------------
    // /gm omen-add
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("omen-add")
        .setDescription(
          "Move one Host Omen into the dice bag."
        )
    )

    // --------------------------------------------------
    // /gm omen-remove
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("omen-remove")
        .setDescription(
          "Return one Omen from the bag to the Host pool."
        )
    )

    // --------------------------------------------------
    // /gm story-size
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("story-size")
        .setDescription(
          "Set the number of characters in the story."
        )

        .addIntegerOption(option =>
          option
            .setName("count")
            .setDescription(
              "Number of characters in the story."
            )
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(6)
        )
    )

    // --------------------------------------------------
    // /gm cancel-check
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel-check")
        .setDescription(
          "Cancel the pending Check and restore temporary resources."
        )
    )

    // --------------------------------------------------
    // /gm strain-add
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("strain-add")
        .setDescription(
          "Add Strain to one specific Aspect."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character receiving Strain."
            )
            .setRequired(true)
            .setMaxLength(120)
        )

        .addStringOption(option =>
          option
            .setName("aspect")
            .setDescription(
              "Aspect receiving Strain."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /gm strain-remove
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("strain-remove")
        .setDescription(
          "Remove Strain from one specific Aspect."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Strain should be removed."
            )
            .setRequired(true)
            .setMaxLength(120)
        )

        .addStringOption(option =>
          option
            .setName("aspect")
            .setDescription(
              "Aspect whose Strain should be removed."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /gm wound-add
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("wound-add")
        .setDescription(
          "Manually give one Wound to a character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character receiving the Wound."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /gm wound-remove
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("wound-remove")
        .setDescription(
          "Manually remove one Wound from a character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Wound should be removed."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /gm revive
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("revive")
        .setDescription(
          "Reactivate a character who died or succumbed to despair."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character to revive."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    // --------------------------------------------------
    // /gm perk-reset
    // --------------------------------------------------

    .addSubcommand(subcommand =>
      subcommand
        .setName("perk-reset")
        .setDescription(
          "Reset recorded Perk usage for one character."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Perk usage should be reset."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    .toJSON()

];


// ====================================================
// Command list
// ====================================================

function printCommandList() {

  console.log(
    "Available commands:"
  );

  console.log("  /ping");

  console.log("  /game create");

  console.log("  /character create");
  console.log("  /character edit");
  console.log("  /character import");
  console.log("  /character export");
  console.log("  /character list");
  console.log("  /character assign");
  console.log("  /character unassign");
  console.log("  /character mine");

  console.log("  /check");

  console.log("  /perk use");
  console.log("  /perk status");

  console.log("  /gm status");
  console.log("  /gm act");
  console.log("  /gm scene-next");
  console.log("  /gm omen-add");
  console.log("  /gm omen-remove");
  console.log("  /gm story-size");
  console.log("  /gm cancel-check");
  console.log("  /gm strain-add");
  console.log("  /gm strain-remove");
  console.log("  /gm wound-add");
  console.log("  /gm wound-remove");
  console.log("  /gm revive");
  console.log("  /gm perk-reset");

}


// ====================================================
// Guild deployment
// ====================================================

async function deployCommands() {

  // --------------------------------------------------
  // Environment validation
  // --------------------------------------------------

  if (
    !process.env.DISCORD_TOKEN
  ) {

    throw new Error(
      "DISCORD_TOKEN is missing from .env"
    );

  }


  if (
    !process.env.DISCORD_CLIENT_ID
  ) {

    throw new Error(
      "DISCORD_CLIENT_ID is missing from .env"
    );

  }


  if (
    !process.env.DISCORD_GUILD_ID
  ) {

    throw new Error(
      "DISCORD_GUILD_ID is missing from .env. " +
      "This variable is required only for guild/test deployment."
    );

  }


  const rest =
    new REST({
      version: "10"
    }).setToken(
      process.env.DISCORD_TOKEN
    );


  try {

    console.log(
      "========================================"
    );

    console.log(
      "13 Omens — GUILD Discord Deployment"
    );

    console.log(
      "========================================"
    );


    console.log(
      `Application ID: ${process.env.DISCORD_CLIENT_ID}`
    );

    console.log(
      `Guild ID: ${process.env.DISCORD_GUILD_ID}`
    );

    console.log(
      `Preparing to register ${commands.length} command groups...`
    );


    await rest.put(

      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),

      {
        body:
          commands
      }

    );


    console.log(
      "Successfully registered Discord commands for the configured guild."
    );

    console.log(
      ""
    );


    printCommandList();

  }

  catch (error) {

    console.error(
      "Failed to register Discord commands:"
    );

    console.error(
      error
    );


    process.exitCode =
      1;

  }

}


// ====================================================
// Exports
// ====================================================

module.exports = {
  commands,
  deployCommands,
  printCommandList
};


// ====================================================
// Run only when executed directly
// ====================================================

if (
  require.main ===
  module
) {

  deployCommands()
    .catch(
      error => {

        console.error(
          "Guild deployment failed:"
        );

        console.error(
          error
        );


        process.exitCode =
          1;

      }
    );

}