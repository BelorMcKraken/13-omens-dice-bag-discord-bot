/**
 * 13 Omens Discord Database
 *
 * SQLite persistent storage for the Discord bot.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");


// ====================================================
// Database location
// ====================================================

const defaultDataDirectory =
  path.join(
    __dirname,
    "..",
    "data"
  );


const defaultDatabasePath =
  path.join(
    defaultDataDirectory,
    "13-omens-discord.db"
  );


const configuredDatabasePath =
  process.env.DISCORD_DB_PATH
    ? process.env.DISCORD_DB_PATH.trim()
    : "";


const databasePath =
  configuredDatabasePath
    ? path.resolve(
        configuredDatabasePath
      )
    : defaultDatabasePath;


// ====================================================
// Ensure database directory exists
// ====================================================

const databaseDirectory =
  path.dirname(
    databasePath
  );


if (
  !fs.existsSync(
    databaseDirectory
  )
) {

  fs.mkdirSync(
    databaseDirectory,
    {
      recursive:
        true
    }
  );

}


// ====================================================
// Open database
// ====================================================

let db;


try {

  db =
    new Database(
      databasePath
    );

}

catch (error) {

  console.error(
    "Failed to open the 13 Omens SQLite database."
  );

  console.error(
    `Database path: ${databasePath}`
  );

  console.error(
    error
  );

  process.exit(1);

}


// ====================================================
// SQLite configuration
// ====================================================

try {

  db.pragma(
    "journal_mode = WAL"
  );

  db.pragma(
    "foreign_keys = ON"
  );

  db.pragma(
    "busy_timeout = 5000"
  );

}

catch (error) {

  console.error(
    "Failed to configure the 13 Omens SQLite database."
  );

  console.error(
    error
  );

  db.close();

  process.exit(1);

}


// ====================================================
// Schema
// ====================================================

try {

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,

      name TEXT NOT NULL,

      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,

      gm_discord_id TEXT NOT NULL,
      gm_display_name TEXT NOT NULL,

      status TEXT NOT NULL DEFAULT 'active',

      game_state TEXT NOT NULL DEFAULT '{}',

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      UNIQUE(guild_id, channel_id)
    );
  `);

}

catch (error) {

  console.error(
    "Failed to initialize the 13 Omens database schema."
  );

  console.error(
    error
  );

  db.close();

  process.exit(1);

}


// ====================================================
// Startup confirmation
// ====================================================

console.log(
  `13 Omens database ready: ${databasePath}`
);


// ====================================================
// Export
// ====================================================

module.exports = db;