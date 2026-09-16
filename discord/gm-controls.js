"use strict";

const {
  EmbedBuilder
} = require("discord.js");

const State =
  require("../js/state.js");

const Rules =
  require("../js/rules.js");

const {
  getCampaign,
  updateGameState,
  isGameMaster
} = require("./game-manager");


// ====================================================
// Helpers
// ====================================================

function clone(
  value
) {

  return JSON.parse(
    JSON.stringify(
      value
    )
  );

}


function ensureRulesState(
  campaign
) {

  const state =
    campaign.gameState;

  const baseline =
    State.defaultState();


  state.schemaVersion ??=
    baseline.schemaVersion;

  state.version ??=
    baseline.version;

  state.act ??=
    "Prologue";

  state.sceneNumber ??=
    1;

  state.storyCharacterCount ??=
    Math.max(
      1,
      state.characters?.length || 1
    );

  state.perishedCharacterIds ??=
    (
      state.characters ||
      []
    )
      .filter(
        character =>
          character.active === false
      )
      .map(
        character =>
          character.id
      );


  state.bag ??= {
    safe: 8,
    omen: 0
  };


  if (
    !Number.isInteger(
      state.bag.safe
    )
  ) {

    state.bag.safe =
      8;

  }


  if (
    !Number.isInteger(
      state.bag.omen
    )
  ) {

    state.bag.omen =
      0;

  }


  if (
    !Number.isInteger(
      state.hostOmens
    )
  ) {

    const woundOmens =
      (
        state.characters ||
        []
      ).reduce(
        (
          total,
          character
        ) =>
          total +
          (
            Number.isInteger(
              character.wounds
            )
              ? character.wounds
              : 0
          ),
        0
      );


    state.hostOmens =
      Math.max(
        0,
        13 -
        state.bag.omen -
        woundOmens
      );

  }


  state.settings = {

    ...baseline.settings,

    ...(
      state.settings ||
      {}
    )

  };


  state.currentCheck ??=
    null;

  state.history ??=
    [];


  if (
    !state.assignments ||
    typeof state.assignments !==
      "object" ||
    Array.isArray(
      state.assignments
    )
  ) {

    state.assignments =
      {};

  }


  for (
    const character of
      state.characters ||
      []
  ) {

    character.wounds ??=
      0;

    character.active ??=
      true;

    character.cheatDeathUsed ??=
      false;

    character.safeDiceLost ??=
      0;

    character.strain ??=
      {};

    character.strainReliefUsed ??=
      false;

    character.perkUsage ??=
      {};

    character.perks ??=
      [];

    character.gear ??=
      [];

    character.archetype ??=
      "";

    character.description ??=
      "";

    character.notes ??=
      "";

    character.statusMessage ??=
      "";

  }


  return state;

}


function saveCampaign(
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


async function getCampaignForInteraction(
  interaction
) {

  if (
    !interaction.guildId ||
    !interaction.channelId
  ) {

    await interaction.reply({

      content:
        "☠ GM controls must be used inside a 13 Omens campaign channel.",

      ephemeral:
        true

    });


    return null;

  }


  const campaign =
    getCampaign(
      interaction.guildId,
      interaction.channelId
    );


  if (!campaign) {

    await interaction.reply({

      content:
        "☠ There is no 13 Omens campaign in this channel.",

      ephemeral:
        true

    });


    return null;

  }


  ensureRulesState(
    campaign
  );


  return campaign;

}


async function requireGameMaster(
  interaction,
  campaign
) {

  if (
    isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    return true;

  }


  await interaction.reply({

    content:
      "☠ Only the Game Master can use GM controls.",

    ephemeral:
      true

  });


  return false;

}


function hasPendingCheck(
  state
) {

  return Boolean(
    state.currentCheck &&
    state.currentCheck.phase !==
      Rules.PHASE_RESOLVED
  );

}


function findCharacterByName(
  state,
  name
) {

  const wanted =
    String(
      name ||
      ""
    )
      .trim()
      .toLowerCase();


  return (
    (
      state.characters ||
      []
    ).find(
      character =>
        String(
          character.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
        wanted
    ) ||
    null
  );

}


function findAspectByName(
  character,
  name
) {

  const wanted =
    String(
      name ||
      ""
    )
      .trim()
      .toLowerCase();


  return (
    (
      character.aspects ||
      []
    ).find(
      aspect =>
        String(
          aspect.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
          wanted ||

        String(
          aspect.id ||
          ""
        )
          .trim()
          .toLowerCase() ===
          wanted
    ) ||
    null
  );

}


function woundOmenCount(
  state
) {

  return (
    (
      state.characters ||
      []
    ).reduce(
      (
        total,
        character
      ) =>
        total +
        (
          character.wounds ||
          0
        ),
      0
    )
  );

}


function activeCharacterCount(
  state
) {

  return (
    (
      state.characters ||
      []
    ).filter(
      character =>
        character.active !==
          false
    ).length
  );

}


function addHistory(
  state,
  text
) {

  state.history ??=
    [];


  state.history.push({

    time:
      new Date().toISOString(),

    text

  });


  if (
    state.history.length >
    250
  ) {

    state.history =
      state.history.slice(
        -250
      );

  }

}


function storeMutation(
  campaign,
  action,
  ...args
) {

  const oldState =
    campaign.gameState;

  const assignments =
    clone(
      oldState.assignments ||
      {}
    );


  const store =
    State.createStore({

      storage:
        null,

      initialState:
        oldState

    });


  if (
    typeof store[action] !==
    "function"
  ) {

    throw new Error(
      `Unknown game-state action: ${action}`
    );

  }


  store[action](
    ...args
  );


  const nextState =
    store.getState();


  nextState.assignments =
    assignments;


  campaign.gameState =
    nextState;


  saveCampaign(
    campaign
  );


  return nextState;

}


function validateAndSaveManualState(
  campaign,
  nextState
) {

  if (
    !Rules.validateOmenEconomy(
      nextState
    )
  ) {

    throw new Error(
      `Omen economy would become ${Rules.getTotalOmenDice(nextState)}/13. Change canceled.`
    );

  }


  const assignments =
    clone(
      campaign.gameState.assignments ||
      {}
    );


  const validator =
    State.createStore({

      storage:
        null,

      initialState:
        nextState

    });


  const validated =
    validator.getState();


  validated.assignments =
    assignments;


  campaign.gameState =
    validated;


  saveCampaign(
    campaign
  );


  return validated;

}


// ====================================================
// Status
// ====================================================

async function handleStatus(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;

  const woundOmens =
    woundOmenCount(
      state
    );

  const totalOmens =
    Rules.getTotalOmenDice(
      state
    );

  const pendingCheck =
    state.currentCheck &&
    state.currentCheck.phase !==
      Rules.PHASE_RESOLVED
      ? state.currentCheck
      : null;


  let pendingText =
    "None";


  if (pendingCheck) {

    const character =
      (
        state.characters ||
        []
      ).find(
        item =>
          item.id ===
          pendingCheck.characterId
      );


    pendingText =
      character
        ? `${character.name} — ${pendingCheck.configuration?.aspect || "Check"}`
        : "Pending Check";

  }


  const woundLines =
    (
      state.characters ||
      []
    )
      .filter(
        character =>
          (
            character.wounds ||
            0
          ) > 0
      )
      .map(
        character =>
          `• ${character.name}: ${character.wounds}`
      );


  const embed =
    new EmbedBuilder()

      .setTitle(
        "☠ 13 OMENS — GM STATUS"
      )

      .setDescription(
        `**${campaign.name}**`
      )

      .addFields(

        {
          name:
            "Act",

          value:
            state.act,

          inline:
            true
        },

        {
          name:
            "Scene",

          value:
            String(
              state.sceneNumber
            ),

          inline:
            true
        },

        {
          name:
            "Story Size",

          value:
            String(
              state.storyCharacterCount
            ),

          inline:
            true
        },

        {
          name:
            "Safe Dice",

          value:
            String(
              state.bag.safe
            ),

          inline:
            true
        },

        {
          name:
            "Bag Omens",

          value:
            String(
              state.bag.omen
            ),

          inline:
            true
        },

        {
          name:
            "Host Omens",

          value:
            String(
              state.hostOmens
            ),

          inline:
            true
        },

        {
          name:
            "Wound Omens",

          value:
            String(
              woundOmens
            ),

          inline:
            true
        },

        {
          name:
            "Active Characters",

          value:
            String(
              activeCharacterCount(
                state
              )
            ),

          inline:
            true
        },

        {
          name:
            "Omen Economy",

          value:
            `${totalOmens}/13`,

          inline:
            true
        },

        {
          name:
            "Pending Check",

          value:
            pendingText,

          inline:
            false
        },

        {
          name:
            "Character Wounds",

          value:
            woundLines.length
              ? woundLines.join(
                  "\n"
                )
              : "None",

          inline:
            false
        }

      );


  await interaction.reply({

    embeds: [
      embed
    ],

    ephemeral:
      true

  });

}


// ====================================================
// Act
// ====================================================

async function handleAct(
  interaction,
  campaign
) {

  const act =
    interaction.options.getString(
      "act",
      true
    );


  try {

    storeMutation(
      campaign,
      "setAct",
      act
    );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not change Act: ${error.message}`,

      ephemeral:
        true

    });


    return;

  }


  await interaction.reply({

    content:
      `☠ The campaign is now in **${act}**.`

  });

}


// ====================================================
// Scene
// ====================================================

async function handleSceneNext(
  interaction,
  campaign
) {

  try {

    const state =
      storeMutation(
        campaign,
        "advanceScene"
      );


    await interaction.reply({

      content:
        `🎬 Advanced to **Scene ${state.sceneNumber}**.`

    });

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not advance the Scene: ${error.message}`,

      ephemeral:
        true

    });

  }

}


// ====================================================
// Omen controls
// ====================================================

async function handleOmenAdd(
  interaction,
  campaign
) {

  try {

    const state =
      storeMutation(
        campaign,
        "addOmenToBag"
      );


    await interaction.reply({

      content:
        `☠ One Host Omen was added to the bag.\n` +
        `**Bag Omens:** ${state.bag.omen}\n` +
        `**Host Omens:** ${state.hostOmens}\n` +
        `**Omen Economy:** ${Rules.getTotalOmenDice(state)}/13`

    });

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not add an Omen: ${error.message}`,

      ephemeral:
        true

    });

  }

}


async function handleOmenRemove(
  interaction,
  campaign
) {

  try {

    const state =
      storeMutation(
        campaign,
        "removeOmenFromBag"
      );


    await interaction.reply({

      content:
        `☠ One Omen was returned from the bag to the Host.\n` +
        `**Bag Omens:** ${state.bag.omen}\n` +
        `**Host Omens:** ${state.hostOmens}\n` +
        `**Omen Economy:** ${Rules.getTotalOmenDice(state)}/13`

    });

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not remove an Omen: ${error.message}`,

      ephemeral:
        true

    });

  }

}


// ====================================================
// Story size
// ====================================================

async function handleStorySize(
  interaction,
  campaign
) {

  const count =
    interaction.options.getInteger(
      "count",
      true
    );


  try {

    storeMutation(
      campaign,
      "setStoryCharacterCount",
      count
    );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not change Story Size: ${error.message}`,

      ephemeral:
        true

    });


    return;

  }


  await interaction.reply({

    content:
      `👥 Story character count set to **${count}**.`

  });

}


// ====================================================
// Cancel Check
// ====================================================

async function handleCancelCheck(
  interaction,
  campaign
) {

  const check =
    campaign.gameState.currentCheck;


  if (
    !check ||
    check.phase ===
      Rules.PHASE_RESOLVED
  ) {

    await interaction.reply({

      content:
        "☠ There is no unresolved Check to cancel.",

      ephemeral:
        true

    });


    return;

  }


  const character =
    (
      campaign.gameState.characters ||
      []
    ).find(
      item =>
        item.id ===
        check.characterId
    );


  const name =
    character?.name ||
    "Character";


  try {

    storeMutation(
      campaign,
      "cancelCheck"
    );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not cancel the Check: ${error.message}`,

      ephemeral:
        true

    });


    return;

  }


  await interaction.reply({

    content:
      `☠ **${name}'s** pending Check has been canceled. Temporary resources were restored.`

  });

}


// ====================================================
// Strain
// ====================================================

async function handleStrainAdd(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;

  const characterName =
    interaction.options.getString(
      "character",
      true
    );

  const aspectName =
    interaction.options.getString(
      "aspect",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    character.active ===
    false
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}** is not currently active.`,

      ephemeral:
        true

    });

    return;

  }


  const aspect =
    findAspectByName(
      character,
      aspectName
    );


  if (!aspect) {

    await interaction.reply({

      content:
        `☠ **${aspectName}** is not an Aspect on ${character.name}.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    aspect.strained
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}'s ${aspect.name}** is already Strained.`,

      ephemeral:
        true

    });

    return;

  }


  try {

    storeMutation(
      campaign,
      "setStrain",
      character.id,
      aspect.id,
      true
    );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not add Strain: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  await interaction.reply({

    embeds: [

      new EmbedBuilder()
        .setTitle(
          "⚠️ Strain Added"
        )
        .setDescription(
          `**${character.name}** gains Strain on **${aspect.name}**.`
        )

    ]

  });

}


async function handleStrainRemove(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;

  const characterName =
    interaction.options.getString(
      "character",
      true
    );

  const aspectName =
    interaction.options.getString(
      "aspect",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  const aspect =
    findAspectByName(
      character,
      aspectName
    );


  if (!aspect) {

    await interaction.reply({

      content:
        `☠ **${aspectName}** is not an Aspect on ${character.name}.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    !aspect.strained
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}'s ${aspect.name}** is not currently Strained.`,

      ephemeral:
        true

    });

    return;

  }


  try {

    storeMutation(
      campaign,
      "setStrain",
      character.id,
      aspect.id,
      false
    );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not remove Strain: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  await interaction.reply({

    embeds: [

      new EmbedBuilder()
        .setTitle(
          "✅ Strain Removed"
        )
        .setDescription(
          `Strain was removed from **${character.name}'s ${aspect.name}**.`
        )

    ]

  });

}


// ====================================================
// Add Wound
// ====================================================

async function handleWoundAdd(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;


  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Finish or cancel the pending Check before manually changing Wounds.",

      ephemeral:
        true

    });

    return;

  }


  const characterName =
    interaction.options.getString(
      "character",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    character.active ===
    false
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}** has already succumbed to death or despair.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    state.hostOmens <
    1
  ) {

    await interaction.reply({

      content:
        "☠ There are no Host Omens available to place as a Wound.",

      ephemeral:
        true

    });

    return;

  }


  const next =
    clone(
      state
    );


  const nextCharacter =
    findCharacterByName(
      next,
      character.name
    );


  next.hostOmens -=
    1;

  nextCharacter.wounds +=
    1;


  const deathThreshold =
    Rules.getDeathThreshold(
      next,
      nextCharacter
    );


  let perished =
    false;


  if (
    nextCharacter.wounds >=
    deathThreshold
  ) {

    const returnedWounds =
      nextCharacter.wounds;


    next.bag.omen +=
      returnedWounds;

    nextCharacter.wounds =
      0;


    Rules.markPerished(
      next,
      nextCharacter
    );


    nextCharacter.statusMessage =
      "Death/despair claimed the character. Wound Omens returned to the bag.";


    perished =
      true;

  }


  addHistory(
    next,
    perished
      ? `${nextCharacter.name} — GM added a Wound; character succumbed to Death/Despair`
      : `${nextCharacter.name} — GM added a Wound`
  );


  let savedState;


  try {

    savedState =
      validateAndSaveManualState(
        campaign,
        next
      );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not add Wound: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  const savedCharacter =
    findCharacterByName(
      savedState,
      character.name
    );


  if (perished) {

    await interaction.reply({

      embeds: [

        new EmbedBuilder()

          .setTitle(
            "💀 Death / Despair"
          )

          .setDescription(
            `**${savedCharacter.name}** receives a Wound and reaches their death/despair threshold.`
          )

          .addFields(

            {
              name:
                "Status",

              value:
                "Perished",

              inline:
                true
            },

            {
              name:
                "Wound Omens",

              value:
                "Returned to the bag",

              inline:
                true
            },

            {
              name:
                "Bag Omens",

              value:
                String(
                  savedState.bag.omen
                ),

              inline:
                true
            },

            {
              name:
                "Host Omens",

              value:
                String(
                  savedState.hostOmens
                ),

              inline:
                true
            },

            {
              name:
                "Omen Economy",

              value:
                `${Rules.getTotalOmenDice(savedState)}/13`,

              inline:
                true
            }

          )

      ]

    });

    return;

  }


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          "💀 Wound Added"
        )

        .setDescription(
          `**${savedCharacter.name}** receives one Wound.`
        )

        .addFields(

          {
            name:
              "Wounds",

            value:
              `${savedCharacter.wounds}/${deathThreshold}`,

            inline:
              true
          },

          {
            name:
              "Host Omens",

            value:
              String(
                savedState.hostOmens
              ),

            inline:
              true
          },

          {
            name:
              "Omen Economy",

            value:
              `${Rules.getTotalOmenDice(savedState)}/13`,

            inline:
              true
          }

        )

    ]

  });

}


// ====================================================
// Remove Wound
// ====================================================

async function handleWoundRemove(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;


  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Finish or cancel the pending Check before manually changing Wounds.",

      ephemeral:
        true

    });

    return;

  }


  const characterName =
    interaction.options.getString(
      "character",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    character.wounds <
    1
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}** has no Wounds to remove.`,

      ephemeral:
        true

    });

    return;

  }


  const next =
    clone(
      state
    );


  const nextCharacter =
    findCharacterByName(
      next,
      character.name
    );


  nextCharacter.wounds -=
    1;

  next.hostOmens +=
    1;


  addHistory(
    next,
    `${nextCharacter.name} — GM removed a Wound`
  );


  let savedState;


  try {

    savedState =
      validateAndSaveManualState(
        campaign,
        next
      );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not remove Wound: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  const savedCharacter =
    findCharacterByName(
      savedState,
      character.name
    );


  const deathThreshold =
    Rules.getDeathThreshold(
      savedState,
      savedCharacter
    );


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          "❤️‍🩹 Wound Removed"
        )

        .setDescription(
          `One Wound was removed from **${savedCharacter.name}**.`
        )

        .addFields(

          {
            name:
              "Wounds",

            value:
              `${savedCharacter.wounds}/${deathThreshold}`,

            inline:
              true
          },

          {
            name:
              "Host Omens",

            value:
              String(
                savedState.hostOmens
              ),

            inline:
              true
          },

          {
            name:
              "Omen Economy",

            value:
              `${Rules.getTotalOmenDice(savedState)}/13`,

            inline:
              true
          }

        )

    ]

  });

}


// ====================================================
// Revive / Reactivate Character
// ====================================================

async function handleRevive(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;


  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Finish or cancel the pending Check before reviving a character.",

      ephemeral:
        true

    });

    return;

  }


  const characterName =
    interaction.options.getString(
      "character",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  if (
    character.active !==
    false
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}** is already active.`,

      ephemeral:
        true

    });

    return;

  }


  const next =
    clone(
      state
    );


  const nextCharacter =
    findCharacterByName(
      next,
      character.name
    );


  // --------------------------------------------------
  // Reactivate the character.
  //
  // Do NOT move Omen Dice here. When the character
  // originally perished, their Wound Omens were
  // already returned to the bag.
  // --------------------------------------------------

  nextCharacter.active =
    true;

  nextCharacter.wounds =
    0;

  nextCharacter.statusMessage =
    "";


  next.perishedCharacterIds =
    (
      next.perishedCharacterIds ||
      []
    ).filter(
      id =>
        id !==
        nextCharacter.id
    );


  addHistory(
    next,
    `${nextCharacter.name} — GM revived/reactivated character`
  );


  let savedState;


  try {

    savedState =
      validateAndSaveManualState(
        campaign,
        next
      );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not revive character: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  const savedCharacter =
    findCharacterByName(
      savedState,
      character.name
    );


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          "✨ Character Reactivated"
        )

        .setDescription(
          `**${savedCharacter.name}** has been returned to active play.`
        )

        .addFields(

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
              "Wounds",

            value:
              String(
                savedCharacter.wounds
              ),

            inline:
              true
          },

          {
            name:
              "Omen Economy",

            value:
              `${Rules.getTotalOmenDice(savedState)}/13`,

            inline:
              true
          }

        )

        .setFooter({

          text:
            "Reviving a character does not reset Strain, Cheat Death, or Perk usage."

        })

    ]

  });

}


// ====================================================
// Reset Character Perk Usage
// ====================================================

async function handlePerkReset(
  interaction,
  campaign
) {

  const state =
    campaign.gameState;


  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Finish or cancel the pending Check before resetting Perk usage.",

      ephemeral:
        true

    });

    return;

  }


  const characterName =
    interaction.options.getString(
      "character",
      true
    );


  const character =
    findCharacterByName(
      state,
      characterName
    );


  if (!character) {

    await interaction.reply({

      content:
        `☠ Character **${characterName}** was not found.`,

      ephemeral:
        true

    });

    return;

  }


  const next =
    clone(
      state
    );


  const nextCharacter =
    findCharacterByName(
      next,
      character.name
    );


  const previousUsageCount =
    Object.keys(
      nextCharacter.perkUsage ||
      {}
    ).length;


  // --------------------------------------------------
  // Reset usage only.
  //
  // Perk.disabled is intentionally left untouched.
  // --------------------------------------------------

  nextCharacter.perkUsage =
    {};


  addHistory(
    next,
    `${nextCharacter.name} — GM reset Perk usage`
  );


  let savedState;


  try {

    savedState =
      validateAndSaveManualState(
        campaign,
        next
      );

  }

  catch (error) {

    await interaction.reply({

      content:
        `☠ Could not reset Perk usage: ${error.message}`,

      ephemeral:
        true

    });

    return;

  }


  const savedCharacter =
    findCharacterByName(
      savedState,
      character.name
    );


  const disabledPerks =
    (
      savedCharacter.perks ||
      []
    )
      .filter(
        perk =>
          perk.disabled
      )
      .map(
        perk =>
          perk.name
      );


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          "✨ Perk Usage Reset"
        )

        .setDescription(
          `Spent Perk usage has been cleared for **${savedCharacter.name}**.`
        )

        .addFields(

          {
            name:
              "Usage Records Cleared",

            value:
              String(
                previousUsageCount
              ),

            inline:
              true
          },

          {
            name:
              "Disabled Perks",

            value:
              disabledPerks.length
                ? disabledPerks.join(
                    ", "
                  )
                : "None",

            inline:
              false
          }

        )

        .setFooter({

          text:
            "Disabled Perks remain disabled. This only resets usage limits."

        })

    ]

  });

}


// ====================================================
// Main command router
// ====================================================

async function handleGmCommand(
  interaction
) {

  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  if (
    !await requireGameMaster(
      interaction,
      campaign
    )
  ) {

    return;

  }


  const subcommand =
    interaction.options.getSubcommand();


  if (
    subcommand ===
    "status"
  ) {

    await handleStatus(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "act"
  ) {

    await handleAct(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "scene-next"
  ) {

    await handleSceneNext(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "omen-add"
  ) {

    await handleOmenAdd(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "omen-remove"
  ) {

    await handleOmenRemove(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "story-size"
  ) {

    await handleStorySize(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "cancel-check"
  ) {

    await handleCancelCheck(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "strain-add"
  ) {

    await handleStrainAdd(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "strain-remove"
  ) {

    await handleStrainRemove(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "wound-add"
  ) {

    await handleWoundAdd(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "wound-remove"
  ) {

    await handleWoundRemove(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "revive"
  ) {

    await handleRevive(
      interaction,
      campaign
    );

    return;

  }


  if (
    subcommand ===
    "perk-reset"
  ) {

    await handlePerkReset(
      interaction,
      campaign
    );

    return;

  }


  await interaction.reply({

    content:
      "☠ Unknown GM command.",

    ephemeral:
      true

  });

}


// ====================================================
// Exports
// ====================================================

module.exports = {

  handleGmCommand

};