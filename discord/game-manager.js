/**
 * 13 Omens Discord Campaign Manager
 *
 * STEP 3 VERSION
 *
 * Campaign data is stored persistently in SQLite.
 */

const crypto = require("crypto");

const db = require("./database");


// ----------------------------------------------------
// Prepared database statements
// ----------------------------------------------------

const insertCampaignStatement = db.prepare(`
  INSERT INTO campaigns (
    id,
    name,
    guild_id,
    channel_id,
    gm_discord_id,
    gm_display_name,
    status,
    game_state,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @name,
    @guildId,
    @channelId,
    @gmDiscordId,
    @gmDisplayName,
    @status,
    @gameState,
    @createdAt,
    @updatedAt
  )
`);


const getCampaignStatement = db.prepare(`
  SELECT *
  FROM campaigns
  WHERE guild_id = ?
    AND channel_id = ?
  LIMIT 1
`);


const deleteCampaignStatement = db.prepare(`
  DELETE FROM campaigns
  WHERE guild_id = ?
    AND channel_id = ?
`);


const updateGameStateStatement = db.prepare(`
  UPDATE campaigns
  SET
    game_state = ?,
    updated_at = ?
  WHERE id = ?
`);


// ----------------------------------------------------
// Database row → campaign object
// ----------------------------------------------------

function rowToCampaign(row) {

  if (!row) {
    return null;
  }


  let gameState = {};


  try {

    gameState =
      JSON.parse(row.game_state);

  }

  catch (error) {

    console.error(
      `Failed to parse game state for campaign ${row.id}`
    );

    console.error(error);

    gameState = {};

  }


  return {

    id:
      row.id,

    name:
      row.name,

    guildId:
      row.guild_id,

    channelId:
      row.channel_id,

    gm: {

      discordId:
        row.gm_discord_id,

      displayName:
        row.gm_display_name

    },

    status:
      row.status,

    gameState,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at

  };

}


// ----------------------------------------------------
// Create campaign
// ----------------------------------------------------

function createCampaign({
  guildId,
  channelId,
  gmDiscordId,
  gmDisplayName,
  name
}) {

  const existingCampaign =
    getCampaign(
      guildId,
      channelId
    );


  if (existingCampaign) {

    throw new Error(
      "A 13 Omens campaign already exists in this channel."
    );

  }


  const now =
    new Date().toISOString();


  const campaign = {

    id:
      crypto.randomUUID(),

    name:
      name || "13 Omens Campaign",

    guildId,

    channelId,

    gm: {

      discordId:
        gmDiscordId,

      displayName:
        gmDisplayName

    },

    status:
      "active",

    gameState: {

      characters: [],

      assignments: {},

      pendingCheck: null

    },

    createdAt:
      now,

    updatedAt:
      now

  };


  insertCampaignStatement.run({

    id:
      campaign.id,

    name:
      campaign.name,

    guildId:
      campaign.guildId,

    channelId:
      campaign.channelId,

    gmDiscordId:
      campaign.gm.discordId,

    gmDisplayName:
      campaign.gm.displayName,

    status:
      campaign.status,

    gameState:
      JSON.stringify(
        campaign.gameState
      ),

    createdAt:
      campaign.createdAt,

    updatedAt:
      campaign.updatedAt

  });


  return campaign;

}


// ----------------------------------------------------
// Get campaign
// ----------------------------------------------------

function getCampaign(
  guildId,
  channelId
) {

  const row =
    getCampaignStatement.get(
      guildId,
      channelId
    );


  return rowToCampaign(row);

}


// ----------------------------------------------------
// Campaign exists
// ----------------------------------------------------

function campaignExists(
  guildId,
  channelId
) {

  return (
    getCampaign(
      guildId,
      channelId
    ) !== null
  );

}


// ----------------------------------------------------
// Delete campaign
// ----------------------------------------------------

function deleteCampaign(
  guildId,
  channelId
) {

  const result =
    deleteCampaignStatement.run(
      guildId,
      channelId
    );


  return result.changes > 0;

}


// ----------------------------------------------------
// Update campaign game state
// ----------------------------------------------------

function updateGameState(
  campaignId,
  gameState
) {

  const now =
    new Date().toISOString();


  const result =
    updateGameStateStatement.run(

      JSON.stringify(
        gameState
      ),

      now,

      campaignId

    );


  return result.changes > 0;

}


// ----------------------------------------------------
// GM check
// ----------------------------------------------------

function isGameMaster(
  campaign,
  discordUserId
) {

  if (!campaign) {
    return false;
  }


  return (
    campaign.gm.discordId ===
    discordUserId
  );

}


// ----------------------------------------------------
// Export
// ----------------------------------------------------

module.exports = {

  createCampaign,

  getCampaign,

  campaignExists,

  deleteCampaign,

  updateGameState,

  isGameMaster

};