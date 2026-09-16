require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");


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

    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription(
          "List the characters in this campaign."
        )
    )

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
        .setMaxLength(120)
    )

    .addStringOption(option =>
      option
        .setName("aspect")
        .setDescription(
          "Core or Story Aspect used for the Check."
        )
        .setRequired(true)
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
      "Use and view 13 Omens Perks."
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("use")
        .setDescription(
          "Use an available Perk outside of a Check."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "GM only: character whose Perk will be used."
            )
            .setRequired(false)
            .setMaxLength(120)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription(
          "View Perks and their current usage status."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "GM only: character whose Perks will be viewed."
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

    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription(
          "View current campaign, bag, Omen, Act, and Check status."
        )
    )

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

    .addSubcommand(subcommand =>
      subcommand
        .setName("scene-next")
        .setDescription(
          "Advance to the next Scene."
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("omen-add")
        .setDescription(
          "Move one Host Omen into the dice bag."
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("omen-remove")
        .setDescription(
          "Return one Omen from the bag to the Host pool."
        )
    )

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

    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel-check")
        .setDescription(
          "Cancel the pending Check and restore temporary resources."
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("strain-add")
        .setDescription(
          "Add Strain to one of a character's Aspects."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character receiving the Strain."
            )
            .setRequired(true)
            .setMaxLength(120)
        )

        .addStringOption(option =>
          option
            .setName("aspect")
            .setDescription(
              "Core or Story Aspect receiving the Strain."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("strain-remove")
        .setDescription(
          "Remove Strain from one of a character's Aspects."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Strain will be removed."
            )
            .setRequired(true)
            .setMaxLength(120)
        )

        .addStringOption(option =>
          option
            .setName("aspect")
            .setDescription(
              "Core or Story Aspect losing the Strain."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("wound-add")
        .setDescription(
          "Manually give a character one Wound."
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
              "Character whose Wound will be removed."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

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
              "Character to reactivate."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("perk-reset")
        .setDescription(
          "Reset a character's spent Perk usage."
        )

        .addStringOption(option =>
          option
            .setName("character")
            .setDescription(
              "Character whose Perk usage will be reset."
            )
            .setRequired(true)
            .setMaxLength(120)
        )
    )

    .toJSON()

];


// ====================================================
// REST
// ====================================================

const rest =
  new REST({
    version: "10"
  }).setToken(
    process.env.DISCORD_TOKEN
  );


// ====================================================
// Deploy
// ====================================================

async function deployCommands() {

  try {

    console.log(
      "Registering Discord commands..."
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
      "Successfully registered Discord commands."
    );


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

  catch (error) {

    console.error(
      "Failed to register Discord commands:"
    );


    console.error(
      error
    );

  }

}

// ====================================================
// Exports / direct execution
// ====================================================

module.exports = {
  commands
};


if (
  require.main === module
) {

  deployCommands();

}