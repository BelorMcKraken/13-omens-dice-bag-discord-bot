require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const {
  createCampaign,
  getCampaign,
  updateGameState,
  isGameMaster
} = require("./game-manager");

const {
  importCharacterIntoCampaign,
  findCharacterByName,
  getCharacterOwnerId,
  setCharacterOwner,
  exportCharacter,
  characterFilename
} = require("./character-manager");

const CharacterItems =
  require("./character-items");

const CheckManager =
  require("./check-manager");

const GmControls =
  require("./gm-controls");

const PerkManager =
  require("./perk-manager");

const ThirteenOmensState =
  require("../js/state.js");

const ThirteenOmensRules =
  require("../js/rules.js");

const db =
  require("./database");


// ====================================================
// Constants
// ====================================================

const RATING_VALUES =
  Object.keys(
    ThirteenOmensRules.ASPECTS
  );


// ====================================================
// Environment
// ====================================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "DISCORD_TOKEN is missing from .env"
  );

  process.exit(1);

}


// ====================================================
// Discord client
// ====================================================

const client =
  new Client({

    intents: [
      GatewayIntentBits.Guilds
    ]

  });


// ====================================================
// Ready
// ====================================================

client.once(
  Events.ClientReady,

  readyClient => {

    console.log(
      `13 Omens is online as ${readyClient.user.tag}`
    );

  }
);


// ====================================================
// Main interaction router
// ====================================================

client.on(
  Events.InteractionCreate,

  async interaction => {

    try {

      if (
        interaction.isChatInputCommand()
      ) {

        await handleChatInput(
          interaction
        );

        return;

      }


      if (
        interaction.isButton()
      ) {

        if (
          interaction.customId.startsWith(
            "check_"
          )
        ) {

          await CheckManager.handleButton(
            interaction
          );

          return;

        }


        if (
          interaction.customId.startsWith(
            "perk_"
          )
        ) {

          await PerkManager.handleButton(
            interaction
          );

          return;

        }


        await handleButton(
          interaction
        );

        return;

      }


      if (
        interaction.isStringSelectMenu()
      ) {

        await handleSelectMenu(
          interaction
        );

        return;

      }


      if (
        interaction.isModalSubmit()
      ) {

        await handleModalSubmit(
          interaction
        );

        return;

      }

    }

    catch (error) {

      console.error(
        "Interaction error:"
      );

      console.error(
        error
      );


      await sendInteractionError(
        interaction,
        "☠ Something went wrong while processing that interaction."
      );

    }

  }
);


// ====================================================
// Error responder
// ====================================================

async function sendInteractionError(
  interaction,
  message
) {

  try {

    if (
      interaction.replied ||
      interaction.deferred
    ) {

      await interaction.followUp({

        content:
          message,

        ephemeral:
          true

      });

    }

    else {

      await interaction.reply({

        content:
          message,

        ephemeral:
          true

      });

    }

  }

  catch (replyError) {

    console.error(
      "Could not send Discord error response:"
    );

    console.error(
      replyError
    );

  }

}


// ====================================================
// Slash commands
// ====================================================

async function handleChatInput(
  interaction
) {

  if (
    interaction.commandName ===
    "ping"
  ) {

    await interaction.reply({

      content:
        "☠ 13 Omens is awake.",

      ephemeral:
        true

    });

    return;

  }


  if (
    interaction.commandName ===
    "game"
  ) {

    await handleGameCommand(
      interaction
    );

    return;

  }


  if (
    interaction.commandName ===
    "character"
  ) {

    await handleCharacterCommand(
      interaction
    );

    return;

  }


  if (
    interaction.commandName ===
    "check"
  ) {

    await CheckManager.handleCheckCommand(
      interaction
    );

    return;

  }


  if (
    interaction.commandName ===
    "gm"
  ) {

    await GmControls.handleGmCommand(
      interaction
    );

    return;

  }


  if (
    interaction.commandName ===
    "perk"
  ) {

    await PerkManager.handlePerkCommand(
      interaction
    );

    return;

  }

}


// ====================================================
// /game
// ====================================================

async function handleGameCommand(
  interaction
) {

  const subcommand =
    interaction.options.getSubcommand();


  if (
    subcommand ===
    "create"
  ) {

    await handleGameCreate(
      interaction
    );

  }

}


// ====================================================
// /game create
// ====================================================

async function handleGameCreate(
  interaction
) {

  if (!interaction.guildId) {

    await interaction.reply({

      content:
        "☠ A 13 Omens campaign must be created inside a Discord server.",

      ephemeral:
        true

    });

    return;

  }


  if (!interaction.channelId) {

    await interaction.reply({

      content:
        "☠ This command must be used inside a Discord channel.",

      ephemeral:
        true

    });

    return;

  }


  const existingCampaign =
    getCampaign(
      interaction.guildId,
      interaction.channelId
    );


  if (existingCampaign) {

    await interaction.reply({

      content:
        `☠ A 13 Omens campaign already exists in this channel: **${existingCampaign.name}**`,

      ephemeral:
        true

    });

    return;

  }


  const requestedName =
    interaction.options.getString(
      "name"
    );


  const campaignName =
    requestedName ||
    "13 Omens Campaign";


  let gmDisplayName =
    interaction.user.globalName ||
    interaction.user.username;


  if (
    interaction.member &&
    interaction.member.displayName
  ) {

    gmDisplayName =
      interaction.member.displayName;

  }


  const campaign =
    createCampaign({

      guildId:
        interaction.guildId,

      channelId:
        interaction.channelId,

      gmDiscordId:
        interaction.user.id,

      gmDisplayName,

      name:
        campaignName

    });


  const embed =
    new EmbedBuilder()

      .setTitle(
        "☠ 13 OMENS"
      )

      .setDescription(
        `**${campaign.name}** has begun.`
      )

      .addFields(

        {
          name:
            "Game Master",

          value:
            `<@${campaign.gm.discordId}>`,

          inline:
            true
        },

        {
          name:
            "Status",

          value:
            "Active",

          inline:
            true
        },

        {
          name:
            "Characters",

          value:
            "0",

          inline:
            true
        }

      )

      .setFooter({

        text:
          "The Omens are watching."

      })

      .setTimestamp(
        new Date(
          campaign.createdAt
        )
      );


  await interaction.reply({

    embeds: [
      embed
    ]

  });

}


// ====================================================
// Campaign helper
// ====================================================

async function getCampaignForInteraction(
  interaction
) {

  if (
    !interaction.guildId ||
    !interaction.channelId
  ) {

    await sendInteractionError(

      interaction,

      "☠ Character commands and editor controls must be used inside a Discord campaign channel."

    );

    return null;

  }


  const campaign =
    getCampaign(
      interaction.guildId,
      interaction.channelId
    );


  if (!campaign) {

    await sendInteractionError(

      interaction,

      "☠ There is no 13 Omens campaign in this channel. Use `/game create` first."

    );

    return null;

  }


  ensureAssignments(
    campaign
  );


  return campaign;

}


// ====================================================
// Assignment helpers
// ====================================================

function ensureAssignments(
  campaign
) {

  if (
    !campaign.gameState.assignments ||
    typeof campaign.gameState.assignments !==
      "object" ||
    Array.isArray(
      campaign.gameState.assignments
    )
  ) {

    campaign.gameState.assignments =
      {};

  }

}


function getAssignedUserId(
  campaign,
  characterId
) {

  ensureAssignments(
    campaign
  );


  return (
    campaign.gameState.assignments[
      characterId
    ] ||
    null
  );

}


function getCharacterAssignedToUser(
  campaign,
  discordUserId
) {

  ensureAssignments(
    campaign
  );


  return (
    campaign.gameState.characters?.find(
      character =>
        campaign.gameState.assignments[
          character.id
        ] ===
        discordUserId
    ) ||
    null
  );

}


function canManageCharacter(
  campaign,
  character,
  discordUserId
) {

  if (
    isGameMaster(
      campaign,
      discordUserId
    )
  ) {

    return true;

  }


  // --------------------------------------------------
  // Owned characters
  // --------------------------------------------------

  const ownerDiscordId =
    getCharacterOwnerId(
      character
    );


  if (ownerDiscordId) {

    return (
      ownerDiscordId ===
      discordUserId
    );

  }


  // --------------------------------------------------
  // Legacy characters
  // --------------------------------------------------

  /**
   * Characters created before ownership was introduced
   * do not have ownerDiscordId.
   *
   * Preserve the old behavior for those characters:
   * the assigned player may still edit/export them.
   */

  return (
    getAssignedUserId(
      campaign,
      character.id
    ) ===
    discordUserId
  );

}


function findCharacterById(
  campaign,
  characterId
) {

  return (
    campaign.gameState.characters?.find(
      character =>
        character.id ===
        characterId
    ) ||
    null
  );

}


function saveCampaignState(
  campaign
) {

  const saved =
    updateGameState(
      campaign.id,
      campaign.gameState
    );


  if (!saved) {

    throw new Error(
      "The campaign state could not be saved."
    );

  }

}


// ====================================================
// Character editor formatting
// ====================================================

function truncateButtonLabel(
  value,
  fallback
) {

  const text =
    String(
      value ||
      fallback ||
      ""
    ).trim() ||
    fallback ||
    "Aspect";


  if (
    text.length <=
    80
  ) {

    return text;

  }


  return (
    `${text.slice(0, 77)}...`
  );

}


function truncateEmbedText(
  value,
  maxLength,
  fallback = "Not set"
) {

  const text =
    String(
      value ??
      ""
    ).trim() ||
    fallback;


  if (
    text.length <=
    maxLength
  ) {

    return text;

  }


  if (
    maxLength <=
    3
  ) {

    return text.slice(
      0,
      maxLength
    );

  }


  return (
    `${text.slice(0, maxLength - 3)}...`
  );

}


function buildCharacterEditorEmbed(
  campaign,
  character
) {

  const assignedUserId =
    getAssignedUserId(
      campaign,
      character.id
    );


  const ownerDiscordId =
    getCharacterOwnerId(
      character
    );


  const coreAspects =
    (
      character.aspects ||
      []
    ).filter(
      aspect =>
        aspect.type ===
        "core"
    );


  const storyAspects =
    (
      character.aspects ||
      []
    ).filter(
      aspect =>
        aspect.type ===
        "story"
    );


  const coreText =
    coreAspects.length
      ? coreAspects
          .map(
            aspect =>
              `**${aspect.name}** — ${aspect.rating} ` +
              `(TN ${ThirteenOmensRules.getTargetNumberForRating(aspect.rating)})`
          )
          .join("\n")
      : "No Core Aspects found.";


  const storyText =
    storyAspects.length
      ? storyAspects
          .map(
            aspect =>
              `**${aspect.name}** — ${aspect.rating} ` +
              `(TN ${ThirteenOmensRules.getTargetNumberForRating(aspect.rating)})`
          )
          .join("\n")
      : "No Story Aspects found.";


  const perkSummary =
    character.perks?.length
      ? character.perks
          .slice(0, 10)
          .map(
            perk =>
              `• ${perk.name}${perk.disabled ? " (Disabled)" : ""}`
          )
          .join("\n")
      : "None";


  const gearSummary =
    character.gear?.length
      ? character.gear
          .slice(0, 10)
          .map(
            item =>
              `• ${item.name}`
          )
          .join("\n")
      : "None";


  return (
    new EmbedBuilder()

      .setTitle(
        truncateEmbedText(
          `☠ ${character.name}`,
          256,
          "☠ Character"
        )
      )

      .setDescription(
        "Character editor"
      )

      .addFields(

        {
          name:
            "Archetype",

          value:
            truncateEmbedText(
              character.archetype,
              200
            ),

          inline:
            true
        },

        {
          name:
            "Owner",

          value:
            ownerDiscordId
              ? `<@${ownerDiscordId}>`
              : "GM / Legacy",

          inline:
            true
        },

        {
          name:
            "Assigned Player",

          value:
            assignedUserId
              ? `<@${assignedUserId}>`
              : "Unassigned",

          inline:
            true
        },

        {
          name:
            "Status",

          value:
            character.active === false
              ? "Dead"
              : "Active",

          inline:
            true
        },

        {
          name:
            "Core Aspects",

          value:
            truncateEmbedText(
              coreText,
              800,
              "No Core Aspects found."
            )
        },

        {
          name:
            "Story Aspects",

          value:
            truncateEmbedText(
              storyText,
              800,
              "No Story Aspects found."
            )
        },

        {
          name:
            "Perks",

          value:
            truncateEmbedText(
              perkSummary,
              700,
              "None"
            )
        },

        {
          name:
            "Gear",

          value:
            truncateEmbedText(
              gearSummary,
              700,
              "None"
            )
        },

        {
          name:
            "Description",

          value:
            truncateEmbedText(
              character.description,
              900
            )
        },

        {
          name:
            "Notes",

          value:
            truncateEmbedText(
              character.notes,
              900
            )
        }

      )

      .setFooter({

        text:
          "Use the controls below to edit this character. Changes save immediately."

      })
  );

}


function buildCharacterEditorComponents(
  character
) {

  const mainRow =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_archetype|${character.id}`
          )

          .setLabel(
            "Edit Archetype"
          )

          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()

          .setCustomId(
            `char_core|${character.id}`
          )

          .setLabel(
            "Edit Core Aspects"
          )

          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()

          .setCustomId(
            `char_story|${character.id}`
          )

          .setLabel(
            "Edit Story Aspects"
          )

          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()

          .setCustomId(
            `char_details|${character.id}`
          )

          .setLabel(
            "Edit Details"
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      );


  const itemsRow =
    CharacterItems.buildItemsButtons(
      character
    );


  const finishRow =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_finish|${character.id}`
          )

          .setLabel(
            "Finish"
          )

          .setStyle(
            ButtonStyle.Success
          )

      );


  return [
    mainRow,
    itemsRow,
    finishRow
  ];

}


// ====================================================
// /character
// ====================================================

async function handleCharacterCommand(
  interaction
) {

  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  const subcommand =
    interaction.options.getSubcommand();


  if (
    subcommand ===
    "create"
  ) {

    await handleCharacterCreate(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "edit"
  ) {

    await handleCharacterEdit(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "import"
  ) {

    await handleCharacterImport(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "export"
  ) {

    await handleCharacterExport(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "list"
  ) {

    await handleCharacterList(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "assign"
  ) {

    await handleCharacterAssign(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "unassign"
  ) {

    await handleCharacterUnassign(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "mine"
  ) {

    await handleCharacterMine(
      interaction,
      campaign
    );

  }

}


// ====================================================
// Character create
// ====================================================

async function handleCharacterCreate(
  interaction,
  campaign
) {

  campaign.gameState.characters ??=
    [];


  if (
    campaign.gameState.characters.length >=
    6
  ) {

    await interaction.reply({
      content:
        "☠ This campaign already has the maximum of 6 characters.",
      ephemeral:
        true
    });

    return;

  }


  const requestedName =
    interaction.options
      .getString(
        "name",
        true
      )
      .trim();


  const duplicate =
    campaign.gameState.characters.some(
      character =>
        String(
          character.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
        requestedName.toLowerCase()
    );


  if (duplicate) {

    await interaction.reply({
      content:
        `☠ A character named **${requestedName}** already exists.`,
      ephemeral:
        true
    });

    return;

  }


  const temporaryState =
    ThirteenOmensState.defaultState();


  const character =
    JSON.parse(
      JSON.stringify(
        temporaryState.characters[0]
      )
    );


  character.name =
    requestedName;


  const creatorIsGameMaster =
    isGameMaster(
      campaign,
      interaction.user.id
    );


  // --------------------------------------------------
  // Player ownership
  // --------------------------------------------------

  /**
   * GM-created characters remain GM/legacy controlled
   * unless ownership is added later.
   *
   * Player-created characters are owned by the player
   * who created them.
   */

  if (!creatorIsGameMaster) {

    setCharacterOwner(
      character,
      interaction.user.id
    );

  }


  campaign.gameState.characters.push(
    character
  );


  // --------------------------------------------------
  // Auto-assign a player-created character when possible
  // --------------------------------------------------

  /**
   * A Discord player may only be assigned to one
   * character at a time under the current campaign
   * assignment system.
   *
   * If the player is not already assigned to another
   * character, their newly created character becomes
   * their active assigned character automatically.
   *
   * If they already have an assignment, ownership is
   * still preserved and the new character remains
   * unassigned until the GM changes assignments.
   */

  if (
    !creatorIsGameMaster &&
    !getCharacterAssignedToUser(
      campaign,
      interaction.user.id
    )
  ) {

    campaign.gameState.assignments[
      character.id
    ] =
      interaction.user.id;

  }


  saveCampaignState(
    campaign
  );


  await interaction.reply({

    content:
      creatorIsGameMaster
        ? `☠ Created **${character.name}**.`
        : (
            getAssignedUserId(
              campaign,
              character.id
            ) ===
            interaction.user.id
              ? `☠ Created **${character.name}**. You own and are assigned to this character.`
              : `☠ Created **${character.name}**. You own this character, but your existing campaign assignment was not changed.`
          ),

    embeds: [
      buildCharacterEditorEmbed(
        campaign,
        character
      )
    ],

    components:
      buildCharacterEditorComponents(
        character
      ),

    ephemeral:
      !creatorIsGameMaster

  });

}


// ====================================================
// Character edit
// ====================================================

async function handleCharacterEdit(
  interaction,
  campaign
) {

  const character =
    findCharacterByName(
      campaign,
      interaction.options.getString(
        "character",
        true
      )
    );


  if (!character) {

    await interaction.reply({
      content:
        "☠ Character not found.",
      ephemeral:
        true
    });

    return;

  }


  if (
    !canManageCharacter(
      campaign,
      character,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        `☠ You are not allowed to edit **${character.name}**.`,
      ephemeral:
        true
    });

    return;

  }


  await interaction.reply({

    embeds: [
      buildCharacterEditorEmbed(
        campaign,
        character
      )
    ],

    components:
      buildCharacterEditorComponents(
        character
      ),

    ephemeral:
      true

  });

}


// ====================================================
// Character import
// ====================================================

async function handleCharacterImport(
  interaction,
  campaign
) {

  const attachment =
    interaction.options.getAttachment(
      "file",
      true
    );


  if (
    attachment.size >
    512 * 1024
  ) {

    await interaction.reply({
      content:
        "☠ Character file is too large.",
      ephemeral:
        true
    });

    return;

  }


  await interaction.deferReply({
    ephemeral:
      true
  });


  try {

    const response =
      await fetch(
        attachment.url
      );


    if (!response.ok) {

      throw new Error(
        `Discord attachment download failed (${response.status}).`
      );

    }


    const text =
      await response.text();


    const importerIsGameMaster =
      isGameMaster(
        campaign,
        interaction.user.id
      );


    const character =
      importCharacterIntoCampaign(
        campaign,
        JSON.parse(
          text
        ),
        importerIsGameMaster
          ? {}
          : {
              ownerDiscordId:
                interaction.user.id
            }
      );


    // ------------------------------------------------
    // Auto-assign a player import when possible
    // ------------------------------------------------

    if (
      !importerIsGameMaster &&
      !getCharacterAssignedToUser(
        campaign,
        interaction.user.id
      )
    ) {

      campaign.gameState.assignments[
        character.id
      ] =
        interaction.user.id;

    }


    saveCampaignState(
      campaign
    );


    const assignedToImporter =
      getAssignedUserId(
        campaign,
        character.id
      ) ===
      interaction.user.id;


    await interaction.editReply({
      content:
        importerIsGameMaster
          ? `☠ **${character.name}** has been imported.`
          : (
              assignedToImporter
                ? `☠ **${character.name}** has been imported. You own and are assigned to this character.`
                : `☠ **${character.name}** has been imported. You own this character, but your existing campaign assignment was not changed.`
            )
    });

  }

  catch (error) {

    await interaction.editReply({
      content:
        `☠ Character import failed: ${error.message}`
    });

  }

}


// ====================================================
// Character export
// ====================================================

async function handleCharacterExport(
  interaction,
  campaign
) {

  const character =
    findCharacterByName(
      campaign,
      interaction.options.getString(
        "name",
        true
      )
    );


  if (!character) {

    await interaction.reply({
      content:
        "☠ Character not found.",
      ephemeral:
        true
    });

    return;

  }


  if (
    !canManageCharacter(
      campaign,
      character,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ You are not allowed to export this character.",
      ephemeral:
        true
    });

    return;

  }


  const json =
    JSON.stringify(
      exportCharacter(
        character
      ),
      null,
      2
    );


  const attachment =
    new AttachmentBuilder(

      Buffer.from(
        json,
        "utf8"
      ),

      {
        name:
          characterFilename(
            character
          )
      }

    );


  await interaction.reply({
    content:
      `☠ Exported **${character.name}**.`,
    files: [
      attachment
    ],
    ephemeral:
      true
  });

}


// ====================================================
// Character list
// ====================================================

async function handleCharacterList(
  interaction,
  campaign
) {

  const characters =
    campaign.gameState.characters ||
    [];


  if (!characters.length) {

    await interaction.reply({
      content:
        "☠ This campaign has no characters.",
      ephemeral:
        true
    });

    return;

  }


  const lines =
    characters.map(
      (
        character,
        index
      ) => {

        const assigned =
          getAssignedUserId(
            campaign,
            character.id
          );


        const owner =
          getCharacterOwnerId(
            character
          );


        return (
          `**${index + 1}. ${character.name}**` +
          `${character.archetype ? ` — ${character.archetype}` : ""}\n` +
          `${character.active === false ? "Dead" : "Active"} • ` +
          `Owner: ${owner ? `<@${owner}>` : "GM / Legacy"} • ` +
          `Assigned: ${assigned ? `<@${assigned}>` : "Unassigned"}`
        );

      }
    );


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          "☠ 13 OMENS — Characters"
        )

        .setDescription(
          truncateEmbedText(
            lines.join(
              "\n\n"
            ),
            4000,
            "No characters."
          )
        )

    ]

  });

}


// ====================================================
// Assign character
// ====================================================

async function handleCharacterAssign(
  interaction,
  campaign
) {

  if (
    !isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ Only the Game Master can assign characters.",
      ephemeral:
        true
    });

    return;

  }


  const character =
    findCharacterByName(
      campaign,
      interaction.options.getString(
        "character",
        true
      )
    );


  const player =
    interaction.options.getUser(
      "player",
      true
    );


  if (
    !character ||
    player.bot
  ) {

    await interaction.reply({
      content:
        "☠ Invalid character or player.",
      ephemeral:
        true
    });

    return;

  }


  const existing =
    getCharacterAssignedToUser(
      campaign,
      player.id
    );


  if (
    existing &&
    existing.id !==
    character.id
  ) {

    await interaction.reply({
      content:
        `<@${player.id}> is already assigned to **${existing.name}**.`,
      ephemeral:
        true
    });

    return;

  }


  const current =
    getAssignedUserId(
      campaign,
      character.id
    );


  if (
    current &&
    current !==
    player.id
  ) {

    await interaction.reply({
      content:
        `☠ **${character.name}** is already assigned to <@${current}>.`,
      ephemeral:
        true
    });

    return;

  }


  campaign.gameState.assignments[
    character.id
  ] =
    player.id;


  saveCampaignState(
    campaign
  );


  await interaction.reply({
    content:
      `☠ **${character.name}** is now assigned to <@${player.id}>.`
  });

}


// ====================================================
// Unassign character
// ====================================================

async function handleCharacterUnassign(
  interaction,
  campaign
) {

  if (
    !isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ Only the Game Master can unassign characters.",
      ephemeral:
        true
    });

    return;

  }


  const character =
    findCharacterByName(
      campaign,
      interaction.options.getString(
        "character",
        true
      )
    );


  if (!character) {

    await interaction.reply({
      content:
        "☠ Character not found.",
      ephemeral:
        true
    });

    return;

  }


  delete campaign.gameState.assignments[
    character.id
  ];


  saveCampaignState(
    campaign
  );


  await interaction.reply({
    content:
      `☠ **${character.name}** is now unassigned.`
  });

}


// ====================================================
// My character
// ====================================================

async function handleCharacterMine(
  interaction,
  campaign
) {

  const character =
    getCharacterAssignedToUser(
      campaign,
      interaction.user.id
    );


  if (!character) {

    await interaction.reply({
      content:
        "☠ You do not have an assigned character.",
      ephemeral:
        true
    });

    return;

  }


  await interaction.reply({

    embeds: [
      buildCharacterEditorEmbed(
        campaign,
        character
      )
    ],

    ephemeral:
      true

  });

}


// ====================================================
// Character button handler
// ====================================================

async function handleButton(
  interaction
) {

  const [
    action,
    characterId,
    extra
  ] =
    interaction.customId.split(
      "|"
    );


  if (
    !action.startsWith(
      "char_"
    )
  ) {

    return;

  }


  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  const character =
    findCharacterById(
      campaign,
      characterId
    );


  if (!character) {

    await interaction.reply({
      content:
        "☠ That character no longer exists.",
      ephemeral:
        true
    });

    return;

  }


  if (
    !canManageCharacter(
      campaign,
      character,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ You are not allowed to edit this character.",
      ephemeral:
        true
    });

    return;

  }


  const itemHandled =
    await CharacterItems.handleButton({

      interaction,
      action,
      character,
      campaign,
      extra,
      saveCampaignState,
      isGameMaster

    });


  if (itemHandled) {
    return;
  }


  if (
    action ===
    "char_archetype"
  ) {

    await showArchetypeModal(
      interaction,
      character
    );

    return;

  }


  if (
    action ===
    "char_details"
  ) {

    await showDetailsModal(
      interaction,
      character
    );

    return;

  }


  if (
    action ===
    "char_core"
  ) {

    await interaction.reply({

      content:
        `**${character.name} — Core Aspects**`,

      components:
        buildCoreAspectRows(
          character
        ),

      ephemeral:
        true

    });

    return;

  }


  if (
    action ===
    "char_story"
  ) {

    await interaction.reply({

      content:
        `**${character.name} — Story Aspects**`,

      components: [
        buildStoryPickerRow(
          character
        )
      ],

      ephemeral:
        true

    });

    return;

  }


  if (
    action ===
    "char_story_rename"
  ) {

    const aspect =
      character.aspects.find(
        item =>
          item.id ===
          extra
      );


    await showStoryNameModal(
      interaction,
      character,
      aspect
    );

    return;

  }


  if (
    action ===
    "char_finish"
  ) {

    const embed =
      buildCharacterEditorEmbed(
        campaign,
        character
      );


    embed.setDescription(
      "Character setup saved."
    );


    await interaction.update({
      embeds: [
        embed
      ],
      components: []
    });

  }

}


// ====================================================
// Rating options
// ====================================================

function buildRatingOptions(
  selectedRating
) {

  return (
    RATING_VALUES.map(
      rating => ({

        label:
          `${rating} — TN ${ThirteenOmensRules.getTargetNumberForRating(rating)}`,

        value:
          rating,

        default:
          rating ===
          selectedRating

      })
    )
  );

}


// ====================================================
// Core Aspect rows
// ====================================================

function buildCoreAspectRows(
  character
) {

  return (
    character.aspects
      .filter(
        aspect =>
          aspect.type ===
          "core"
      )
      .map(
        aspect =>

          new ActionRowBuilder()

            .addComponents(

              new StringSelectMenuBuilder()

                .setCustomId(
                  `char_core_rating|${character.id}|${aspect.id}`
                )

                .setPlaceholder(
                  `${aspect.name}: ${aspect.rating}`
                )

                .addOptions(
                  buildRatingOptions(
                    aspect.rating
                  )
                )

            )

      )
  );

}


// ====================================================
// Story picker
// ====================================================

function buildStoryPickerRow(
  character
) {

  const story =
    character.aspects.filter(
      aspect =>
        aspect.type ===
        "story"
    );


  return (
    new ActionRowBuilder()

      .addComponents(

        new StringSelectMenuBuilder()

          .setCustomId(
            `char_story_pick|${character.id}`
          )

          .setPlaceholder(
            "Choose a Story Aspect"
          )

          .addOptions(

            story.map(
              aspect => ({

                label:
                  truncateButtonLabel(
                    aspect.name,
                    "Story Aspect"
                  ),

                value:
                  aspect.id,

                description:
                  `${aspect.rating} — TN ${ThirteenOmensRules.getTargetNumberForRating(aspect.rating)}`

              })
            )

          )

      )
  );

}


// ====================================================
// Story Aspect controls
// ====================================================

function buildStoryAspectEditorComponents(
  character,
  aspect
) {

  return [

    new ActionRowBuilder()

      .addComponents(

        new StringSelectMenuBuilder()

          .setCustomId(
            `char_story_rating|${character.id}|${aspect.id}`
          )

          .setPlaceholder(
            `${aspect.rating} — TN ${ThirteenOmensRules.getTargetNumberForRating(aspect.rating)}`
          )

          .addOptions(
            buildRatingOptions(
              aspect.rating
            )
          )

      ),


    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_story_rename|${character.id}|${aspect.id}`
          )

          .setLabel(
            "Rename Story Aspect"
          )

          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()

          .setCustomId(
            `char_story|${character.id}`
          )

          .setLabel(
            "Choose Another"
          )

          .setStyle(
            ButtonStyle.Primary
          )

      )

  ];

}


// ====================================================
// Select menus
// ====================================================

async function handleSelectMenu(
  interaction
) {

  const [
    action,
    characterId,
    aspectId
  ] =
    interaction.customId.split(
      "|"
    );


  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  const character =
    findCharacterById(
      campaign,
      characterId
    );


  if (
    !character ||
    !canManageCharacter(
      campaign,
      character,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ You cannot edit this character.",
      ephemeral:
        true
    });

    return;

  }


  const itemHandled =
    await CharacterItems.handleSelectMenu({

      interaction,
      action,
      character,
      campaign,
      aspectId,
      saveCampaignState,
      isGameMaster

    });


  if (itemHandled) {
    return;
  }


  if (
    action ===
    "char_core_rating"
  ) {

    const aspect =
      character.aspects.find(
        item =>
          item.id ===
          aspectId
      );


    aspect.rating =
      interaction.values[0];


    saveCampaignState(
      campaign
    );


    await interaction.update({

      content:
        `Updated **${aspect.name}** to **${aspect.rating}**.`,

      components:
        buildCoreAspectRows(
          character
        )

    });

    return;

  }


  if (
    action ===
    "char_story_pick"
  ) {

    const aspect =
      character.aspects.find(
        item =>
          item.id ===
          interaction.values[0]
      );


    await interaction.update({

      content:
        `**${aspect.name}** — ${aspect.rating}`,

      components:
        buildStoryAspectEditorComponents(
          character,
          aspect
        )

    });

    return;

  }


  if (
    action ===
    "char_story_rating"
  ) {

    const aspect =
      character.aspects.find(
        item =>
          item.id ===
          aspectId
      );


    aspect.rating =
      interaction.values[0];


    saveCampaignState(
      campaign
    );


    await interaction.update({

      content:
        `**${aspect.name}** — ${aspect.rating}`,

      components:
        buildStoryAspectEditorComponents(
          character,
          aspect
        )

    });

  }

}


// ====================================================
// Archetype modal
// ====================================================

async function showArchetypeModal(
  interaction,
  character
) {

  const input =
    new TextInputBuilder()

      .setCustomId(
        "archetype"
      )

      .setLabel(
        "Archetype"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        false
      )

      .setMaxLength(
        120
      );


  if (
    character.archetype
  ) {

    input.setValue(
      character.archetype
    );

  }


  const modal =
    new ModalBuilder()

      .setCustomId(
        `char_modal_archetype|${character.id}`
      )

      .setTitle(
        "Edit Archetype"
      )

      .addComponents(

        new ActionRowBuilder()
          .addComponents(
            input
          )

      );


  await interaction.showModal(
    modal
  );

}


// ====================================================
// Details modal
// ====================================================

async function showDetailsModal(
  interaction,
  character
) {

  const description =
    new TextInputBuilder()

      .setCustomId(
        "description"
      )

      .setLabel(
        "Description"
      )

      .setStyle(
        TextInputStyle.Paragraph
      )

      .setRequired(
        false
      )

      .setMaxLength(
        4000
      );


  if (
    character.description
  ) {

    description.setValue(
      character.description
    );

  }


  const notes =
    new TextInputBuilder()

      .setCustomId(
        "notes"
      )

      .setLabel(
        "Notes"
      )

      .setStyle(
        TextInputStyle.Paragraph
      )

      .setRequired(
        false
      )

      .setMaxLength(
        4000
      );


  if (
    character.notes
  ) {

    notes.setValue(
      character.notes
    );

  }


  const modal =
    new ModalBuilder()

      .setCustomId(
        `char_modal_details|${character.id}`
      )

      .setTitle(
        "Edit Character Details"
      )

      .addComponents(

        new ActionRowBuilder()
          .addComponents(
            description
          ),

        new ActionRowBuilder()
          .addComponents(
            notes
          )

      );


  await interaction.showModal(
    modal
  );

}


// ====================================================
// Story name modal
// ====================================================

async function showStoryNameModal(
  interaction,
  character,
  aspect
) {

  const input =
    new TextInputBuilder()

      .setCustomId(
        "name"
      )

      .setLabel(
        "Story Aspect Name"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMaxLength(
        120
      )

      .setValue(
        aspect.name
      );


  const modal =
    new ModalBuilder()

      .setCustomId(
        `char_modal_story_name|${character.id}|${aspect.id}`
      )

      .setTitle(
        "Rename Story Aspect"
      )

      .addComponents(

        new ActionRowBuilder()
          .addComponents(
            input
          )

      );


  await interaction.showModal(
    modal
  );

}


// ====================================================
// Modal submissions
// ====================================================

async function handleModalSubmit(
  interaction
) {

  const [
    action,
    characterId,
    aspectId
  ] =
    interaction.customId.split(
      "|"
    );


  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  const character =
    findCharacterById(
      campaign,
      characterId
    );


  if (
    !character ||
    !canManageCharacter(
      campaign,
      character,
      interaction.user.id
    )
  ) {

    await interaction.reply({
      content:
        "☠ You cannot edit this character.",
      ephemeral:
        true
    });

    return;

  }


  const itemHandled =
    await CharacterItems.handleModalSubmit({

      interaction,
      action,
      character,
      campaign,
      aspectId,
      saveCampaignState

    });


  if (itemHandled) {
    return;
  }


  if (
    action ===
    "char_modal_archetype"
  ) {

    character.archetype =
      interaction.fields
        .getTextInputValue(
          "archetype"
        )
        .trim();


    saveCampaignState(
      campaign
    );


    await interaction.reply({

      embeds: [
        buildCharacterEditorEmbed(
          campaign,
          character
        )
      ],

      components:
        buildCharacterEditorComponents(
          character
        ),

      ephemeral:
        true

    });

    return;

  }


  if (
    action ===
    "char_modal_details"
  ) {

    character.description =
      interaction.fields
        .getTextInputValue(
          "description"
        )
        .trim();


    character.notes =
      interaction.fields
        .getTextInputValue(
          "notes"
        )
        .trim();


    saveCampaignState(
      campaign
    );


    await interaction.reply({

      embeds: [
        buildCharacterEditorEmbed(
          campaign,
          character
        )
      ],

      components:
        buildCharacterEditorComponents(
          character
        ),

      ephemeral:
        true

    });

    return;

  }


  if (
    action ===
    "char_modal_story_name"
  ) {

    const aspect =
      character.aspects.find(
        item =>
          item.id ===
          aspectId
      );


    aspect.name =
      interaction.fields
        .getTextInputValue(
          "name"
        )
        .trim();


    saveCampaignState(
      campaign
    );


    await interaction.reply({

      content:
        `☠ Story Aspect renamed to **${aspect.name}**.`,

      components:
        buildStoryAspectEditorComponents(
          character,
          aspect
        ),

      ephemeral:
        true

    });

  }

}


// ====================================================
// Graceful shutdown
// ====================================================

let shuttingDown =
  false;


async function shutdown(
  reason,
  exitCode = 0
) {

  if (shuttingDown) {
    return;
  }


  shuttingDown =
    true;


  console.log(
    ""
  );

  console.log(
    "========================================"
  );

  console.log(
    "13 Omens shutdown requested"
  );

  console.log(
    `Reason: ${reason}`
  );

  console.log(
    "========================================"
  );


  // --------------------------------------------------
  // Disconnect from Discord
  // --------------------------------------------------

  try {

    if (
      client &&
      client.isReady()
    ) {

      console.log(
        "Disconnecting from Discord..."
      );


      await Promise.resolve(
        client.destroy()
      );


      console.log(
        "Discord client disconnected."
      );

    }

  }

  catch (error) {

    console.error(
      "Error while disconnecting Discord client:"
    );

    console.error(
      error
    );


    exitCode =
      1;

  }


  // --------------------------------------------------
  // Flush SQLite WAL
  // --------------------------------------------------

  try {

    if (
      db &&
      db.open
    ) {

      console.log(
        "Checkpointing SQLite database..."
      );


      db.pragma(
        "wal_checkpoint(TRUNCATE)"
      );


      console.log(
        "SQLite checkpoint complete."
      );

    }

  }

  catch (error) {

    console.error(
      "Could not checkpoint SQLite database:"
    );

    console.error(
      error
    );


    exitCode =
      1;

  }


  // --------------------------------------------------
  // Close SQLite
  // --------------------------------------------------

  try {

    if (
      db &&
      db.open
    ) {

      console.log(
        "Closing SQLite database..."
      );


      db.close();


      console.log(
        "SQLite database closed."
      );

    }

  }

  catch (error) {

    console.error(
      "Error while closing SQLite database:"
    );

    console.error(
      error
    );


    exitCode =
      1;

  }


  console.log(
    `13 Omens stopped with exit code ${exitCode}.`
  );


  process.exit(
    exitCode
  );

}


// ====================================================
// Operating-system shutdown signals
// ====================================================

// Ctrl+C
process.once(
  "SIGINT",

  () => {

    shutdown(
      "SIGINT",
      0
    );

  }
);


// Linux/systemd/cloud shutdown
process.once(
  "SIGTERM",

  () => {

    shutdown(
      "SIGTERM",
      0
    );

  }
);


// ====================================================
// Fatal process errors
// ====================================================

process.on(
  "uncaughtException",

  error => {

    console.error(
      "Uncaught exception:"
    );

    console.error(
      error
    );


    shutdown(
      "uncaughtException",
      1
    );

  }
);


process.on(
  "unhandledRejection",

  reason => {

    console.error(
      "Unhandled promise rejection:"
    );

    console.error(
      reason
    );


    shutdown(
      "unhandledRejection",
      1
    );

  }
);


// ====================================================
// Login
// ====================================================

client.login(
  process.env.DISCORD_TOKEN
).catch(
  error => {

    console.error(
      "Discord login failed:"
    );

    console.error(
      error
    );


    shutdown(
      "Discord login failure",
      1
    );

  }
);