"use strict";

require("dotenv").config();

const {
  REST,
  Routes
} = require("discord.js");

const {
  commands,
  printCommandList
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
// Validate imported command definitions
// ====================================================

if (
  !Array.isArray(
    commands
  )
) {

  console.error(
    "Command definitions could not be loaded from deploy-commands.js."
  );

  process.exit(1);

}


if (
  commands.length ===
  0
) {

  console.error(
    "No Discord command definitions were found."
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


// ====================================================
// Run deployment
// ====================================================

deployGlobalCommands();