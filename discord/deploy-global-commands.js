"use strict";

require("dotenv").config();

const {
  REST,
  Routes
} = require("discord.js");

const {
  commands
} = require("./deploy-commands");


// ====================================================
// Environment validation
// ====================================================

if (
  !process.env.DISCORD_TOKEN
) {

  console.error(
    "DISCORD_TOKEN is missing from .env"
  );

  process.exit(1);

}


if (
  !process.env.DISCORD_CLIENT_ID
) {

  console.error(
    "DISCORD_CLIENT_ID is missing from .env"
  );

  process.exit(1);

}


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
// Global command list
// ====================================================

function printCommandList() {

  console.log(
    "Globally available commands:"
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
// Deploy globally
// ====================================================

async function deployGlobalCommands() {

  try {

    console.log(
      "========================================"
    );

    console.log(
      "13 Omens — GLOBAL Discord Deployment"
    );

    console.log(
      "========================================"
    );


    console.log(
      `Application ID: ${process.env.DISCORD_CLIENT_ID}`
    );


    console.log(
      `Preparing to register ${commands.length} global command groups...`
    );


    console.log(
      ""
    );

    console.log(
      "WARNING:"
    );

    console.log(
      "These commands will be registered globally."
    );

    console.log(
      "They will become available to every Discord server"
    );

    console.log(
      "where this application is installed."
    );

    console.log(
      ""
    );


    await rest.put(

      Routes.applicationCommands(
        process.env.DISCORD_CLIENT_ID
      ),

      {
        body:
          commands
      }

    );


    console.log(
      "Successfully registered GLOBAL Discord commands."
    );


    console.log(
      ""
    );


    printCommandList();


    console.log(
      ""
    );

    console.log(
      "Global deployment complete."
    );

  }

  catch (error) {

    console.error(
      "Failed to register GLOBAL Discord commands:"
    );


    console.error(
      error
    );


    process.exitCode =
      1;

  }

}


deployGlobalCommands();