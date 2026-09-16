"use strict";

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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

function clone(value) {

  return JSON.parse(
    JSON.stringify(value)
  );

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


// ====================================================
// Ensure older Discord campaign data has everything
// needed by the shared rules engine.
// ====================================================

function ensureRulesState(
  campaign
) {

  const state =
    campaign.gameState;


  const baseline =
    State.defaultState();


  if (
    !Array.isArray(
      state.characters
    )
  ) {

    state.characters = [];

  }


  if (
    !state.assignments ||
    typeof state.assignments !==
      "object" ||
    Array.isArray(
      state.assignments
    )
  ) {

    state.assignments = {};

  }


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
      state.characters.length
    );

  state.perishedCharacterIds ??=
    state.characters
      .filter(
        character =>
          character.active === false
      )
      .map(
        character =>
          character.id
      );


  if (
    !Array.isArray(
      state.history
    )
  ) {

    state.history = [];

  }


  state.currentCheck ??=
    null;


  return state;

}


// ====================================================
// Campaign lookup
// ====================================================

async function getCampaignForInteraction(
  interaction
) {

  if (
    !interaction.guildId ||
    !interaction.channelId
  ) {

    await interaction.reply({

      content:
        "☠ Perks must be used inside a 13 Omens campaign channel.",

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


// ====================================================
// Character helpers
// ====================================================

function assignedUserId(
  campaign,
  characterId
) {

  return (
    campaign.gameState.assignments?.[
      characterId
    ] ||
    null
  );

}


function characterAssignedToUser(
  campaign,
  userId
) {

  return (
    campaign.gameState.characters.find(
      character =>
        assignedUserId(
          campaign,
          character.id
        ) ===
        userId
    ) ||
    null
  );

}


function findCharacterByName(
  campaign,
  name
) {

  const normalized =
    String(
      name ||
      ""
    )
      .trim()
      .toLowerCase();


  return (
    campaign.gameState.characters.find(
      character =>
        String(
          character.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
        normalized
    ) ||
    null
  );

}


// ====================================================
// Get character requested by Player / GM
// ====================================================

async function resolveCharacter(
  interaction,
  campaign
) {

  const requestedName =
    interaction.options?.getString?.(
      "character"
    );


  // --------------------------------------------------
  // GM may explicitly select any character.
  // --------------------------------------------------

  if (
    requestedName &&
    isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    const character =
      findCharacterByName(
        campaign,
        requestedName
      );


    if (!character) {

      await interaction.reply({

        content:
          `☠ No character named **${requestedName}** exists in this campaign.`,

        ephemeral:
          true

      });


      return null;

    }


    return character;

  }


  // --------------------------------------------------
  // Normal Players use their assigned character.
  // --------------------------------------------------

  const character =
    characterAssignedToUser(
      campaign,
      interaction.user.id
    );


  if (character) {

    if (
      requestedName &&
      character.name
        .trim()
        .toLowerCase() !==
      requestedName
        .trim()
        .toLowerCase()
    ) {

      await interaction.reply({

        content:
          `☠ You are assigned to **${character.name}**, not **${requestedName}**.`,

        ephemeral:
          true

      });


      return null;

    }


    return character;

  }


  // --------------------------------------------------
  // GM with no character specified.
  // --------------------------------------------------

  if (
    isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    await interaction.reply({

      content:
        "☠ Specify a character when using this command as the GM.",

      ephemeral:
        true

    });


    return null;

  }


  await interaction.reply({

    content:
      "☠ You do not have a character assigned in this campaign.",

    ephemeral:
      true

  });


  return null;

}


// ====================================================
// Pending Check helper
// ====================================================

function hasPendingCheck(
  state
) {

  return Boolean(
    state.currentCheck &&
    state.currentCheck.phase !==
      Rules.PHASE_RESOLVED
  );

}


// ====================================================
// Outside-Check Perk helpers
// ====================================================

function isOutsideCheckRule(
  rule
) {

  return Boolean(
    rule &&
    Array.isArray(
      rule.timing
    ) &&
    rule.timing.includes(
      "OUTSIDE_CHECK"
    )
  );

}


function getOutsideCheckPerks(
  character,
  state
) {

  return (
    (
      character.perks ||
      []
    )

      .map(
        (
          perk,
          perkIndex
        ) => {

          const rule =
            perk.ruleKey
              ? Rules.Perks
                  .PERK_RULES[
                    perk.ruleKey
                  ]
              : null;


          return {

            perk,

            perkIndex,

            rule

          };

        }
      )

      .filter(
        entry =>
          isOutsideCheckRule(
            entry.rule
          )
      )
  );

}


function getEligibleOutsideCheckPerks(
  character,
  state
) {

  return (
    getOutsideCheckPerks(
      character,
      state
    )

      .filter(
        entry =>
          Rules.Perks.eligible(
            character,
            entry.perk,
            state,
            null
          )
      )
  );

}


// ====================================================
// Usage status
// ====================================================

function getUsageStatus(
  character,
  perk,
  state
) {

  return (
    Rules.Perks.usageStatus(
      character,
      perk,
      state,
      null
    )
  );

}


// ====================================================
// /perk status
// ====================================================

async function handlePerkStatus(
  interaction,
  campaign,
  character
) {

  const automated =
    (
      character.perks ||
      []
    )

      .filter(
        perk =>
          perk.ruleKey &&
          Rules.Perks
            .PERK_RULES[
              perk.ruleKey
            ]
      );


  const manual =
    (
      character.perks ||
      []
    )

      .filter(
        perk =>
          !perk.ruleKey
      );


  let automatedText =
    "None";


  if (
    automated.length
  ) {

    automatedText =
      automated

        .map(
          perk => {

            const rule =
              Rules.Perks
                .PERK_RULES[
                  perk.ruleKey
                ];


            return (
              `**${perk.name}**\n` +
              `${getUsageStatus(
                character,
                perk,
                campaign.gameState
              )}\n` +
              `${rule.timing.join(", ")}`
            );

          }
        )

        .join(
          "\n\n"
        );

  }


  let manualText =
    "None";


  if (
    manual.length
  ) {

    manualText =
      manual

        .map(
          perk =>
            `• ${perk.name}`
        )

        .join(
          "\n"
        );

  }


  const strained =
    (
      character.aspects ||
      []
    )

      .filter(
        aspect =>
          aspect.strained
      );


  const strainText =
    strained.length

      ? strained
          .map(
            aspect =>
              `• ${aspect.name}`
          )
          .join(
            "\n"
          )

      : "None";


  const embed =
    new EmbedBuilder()

      .setTitle(
        `✨ ${character.name} — Perks`
      )

      .addFields(

        {

          name:
            "Automated Perks",

          value:
            automatedText.slice(
              0,
              1024
            ),

          inline:
            false

        },

        {

          name:
            "Custom / Manual Perks",

          value:
            manualText.slice(
              0,
              1024
            ),

          inline:
            false

        },

        {

          name:
            "Current Strain",

          value:
            strainText,

          inline:
            false

        }

      )

      .setFooter({

        text:
          "Use /perk use to activate an available outside-Check Perk."

      });


  await interaction.reply({

    embeds: [
      embed
    ],

    ephemeral:
      true

  });

}


// ====================================================
// /perk use
// ====================================================

async function handlePerkUse(
  interaction,
  campaign,
  character
) {

  const state =
    campaign.gameState;


  // --------------------------------------------------
  // These Perks specifically operate outside a Check.
  // --------------------------------------------------

  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Outside-Check Perks cannot be used while a Check is unresolved. Finish or cancel the current Check first.",

      ephemeral:
        true

    });


    return;

  }


  const allOutside =
    getOutsideCheckPerks(
      character,
      state
    );


  if (
    !allOutside.length
  ) {

    await interaction.reply({

      content:
        `✨ **${character.name}** does not have any automated outside-Check Perks.`,

      ephemeral:
        true

    });


    return;

  }


  const eligible =
    getEligibleOutsideCheckPerks(
      character,
      state
    );


  if (
    !eligible.length
  ) {

    const status =
      allOutside

        .map(
          entry =>
            `**${entry.perk.name}** — ` +
            `${getUsageStatus(
              character,
              entry.perk,
              state
            )}`
        )

        .join(
          "\n"
        );


    const strained =
      character.aspects?.some(
        aspect =>
          aspect.strained
      );


    await interaction.reply({

      content:
        `✨ **${character.name}** has no outside-Check Perk available right now.\n\n` +
        `${status}` +
        (
          !strained
            ? "\n\nThere is currently no Strain to remove."
            : ""
        ),

      ephemeral:
        true

    });


    return;

  }


  const rows = [];


  for (
    let i = 0;
    i < eligible.length;
    i += 5
  ) {

    const row =
      new ActionRowBuilder();


    for (
      const entry of
        eligible.slice(
          i,
          i + 5
        )
    ) {

      const characterIndex =
        state.characters.findIndex(
          item =>
            item.id ===
            character.id
        );


      row.addComponents(

        new ButtonBuilder()

          .setCustomId(
            `perk_use|${characterIndex}|${entry.perkIndex}`
          )

          .setLabel(
            entry.rule.name.slice(
              0,
              80
            )
          )

          .setStyle(
            ButtonStyle.Primary
          )

      );

    }


    rows.push(
      row
    );

  }


  const text =
    eligible

      .map(
        entry => {

          let effect =
            "Use this Perk outside a Check.";


          if (
            entry.rule.type ===
            "strain"
          ) {

            effect =
              "Remove one Strain.";

          }


          return (
            `**${entry.rule.name}**\n` +
            `${effect}\n` +
            `*${getUsageStatus(
              character,
              entry.perk,
              state
            )}*`
          );

        }
      )

      .join(
        "\n\n"
      );


  await interaction.reply({

    embeds: [

      new EmbedBuilder()

        .setTitle(
          `✨ ${character.name} — Use Perk`
        )

        .setDescription(
          text
        )

        .setFooter({

          text:
            "Choose the Perk you want to activate."

        })

    ],

    components:
      rows,

    ephemeral:
      true

  });

}


// ====================================================
// Slash-command router
// ====================================================

async function handlePerkCommand(
  interaction
) {

  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {
    return;
  }


  const character =
    await resolveCharacter(
      interaction,
      campaign
    );


  if (!character) {
    return;
  }


  if (
    character.active ===
    false
  ) {

    await interaction.reply({

      content:
        `☠ **${character.name}** is no longer active.`,

      ephemeral:
        true

    });


    return;

  }


  const subcommand =
    interaction.options.getSubcommand();


  if (
    subcommand ===
    "status"
  ) {

    await handlePerkStatus(
      interaction,
      campaign,
      character
    );


    return;

  }


  if (
    subcommand ===
    "use"
  ) {

    await handlePerkUse(
      interaction,
      campaign,
      character
    );

  }

}


// ====================================================
// Permission check for button interactions
// ====================================================

async function mayUseCharacter(
  interaction,
  campaign,
  character
) {

  if (
    isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {

    return true;

  }


  return (
    assignedUserId(
      campaign,
      character.id
    ) ===
    interaction.user.id
  );

}


// ====================================================
// Perk button router
// ====================================================

async function handleButton(
  interaction
) {

  const parts =
    interaction.customId.split(
      "|"
    );


  const action =
    parts[0];


  if (
    !action.startsWith(
      "perk_"
    )
  ) {

    return false;

  }


  const campaign =
    await getCampaignForInteraction(
      interaction
    );


  if (!campaign) {

    return true;

  }


  const state =
    campaign.gameState;


  if (
    hasPendingCheck(
      state
    )
  ) {

    await interaction.reply({

      content:
        "☠ Outside-Check Perks cannot be used while a Check is unresolved.",

      ephemeral:
        true

    });


    return true;

  }


  const characterIndex =
    Number.parseInt(
      parts[1],
      10
    );


  const perkIndex =
    Number.parseInt(
      parts[2],
      10
    );


  if (
    !Number.isInteger(
      characterIndex
    ) ||
    !Number.isInteger(
      perkIndex
    )
  ) {

    await interaction.reply({

      content:
        "☠ That Perk selection is no longer valid.",

      ephemeral:
        true

    });


    return true;

  }


  const character =
    state.characters[
      characterIndex
    ];


  const perk =
    character?.perks?.[
      perkIndex
    ];


  if (
    !character ||
    !perk
  ) {

    await interaction.reply({

      content:
        "☠ That character or Perk no longer exists.",

      ephemeral:
        true

    });


    return true;

  }


  if (
    !await mayUseCharacter(
      interaction,
      campaign,
      character
    )
  ) {

    await interaction.reply({

      content:
        "☠ You are not allowed to activate this character's Perk.",

      ephemeral:
        true

    });


    return true;

  }


  const rule =
    perk.ruleKey
      ? Rules.Perks
          .PERK_RULES[
            perk.ruleKey
          ]
      : null;


  if (
    !isOutsideCheckRule(
      rule
    )
  ) {

    await interaction.reply({

      content:
        "☠ That is not an outside-Check automated Perk.",

      ephemeral:
        true

    });


    return true;

  }


  if (
    !Rules.Perks.eligible(
      character,
      perk,
      state,
      null
    )
  ) {

    await interaction.reply({

      content:
        `☠ **${perk.name}** is no longer available.`,

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Perks that remove Strain
  // ==================================================

  if (
    action ===
    "perk_use" &&
    rule.type ===
    "strain"
  ) {

    const strainedAspects =
      (
        character.aspects ||
        []
      )

        .map(
          (
            aspect,
            aspectIndex
          ) => ({

            aspect,

            aspectIndex

          })
        )

        .filter(
          entry =>
            entry.aspect.strained
        );


    if (
      !strainedAspects.length
    ) {

      await interaction.update({

        content:
          `✨ **${character.name}** has no Strain to remove.`,

        embeds: [],

        components: []

      });


      return true;

    }


    const rows = [];


    for (
      let i = 0;
      i < strainedAspects.length;
      i += 5
    ) {

      const row =
        new ActionRowBuilder();


      for (
        const entry of
          strainedAspects.slice(
            i,
            i + 5
          )
      ) {

        row.addComponents(

          new ButtonBuilder()

            .setCustomId(
              `perk_strain|` +
              `${characterIndex}|` +
              `${perkIndex}|` +
              `${entry.aspectIndex}`
            )

            .setLabel(
              entry.aspect.name.slice(
                0,
                80
              )
            )

            .setStyle(
              ButtonStyle.Success
            )

        );

      }


      rows.push(
        row
      );

    }


    let instructions =
      `Choose the Strain **${perk.name}** will remove.`;


    if (
      perk.ruleKey ===
      "five-minute-break"
    ) {

      instructions +=
        "\n\nUse this after the character has successfully completed an uninterrupted five-minute break.";

    }


    if (
      perk.ruleKey ===
      "late-for-work"
    ) {

      instructions +=
        "\n\nUse this after the character complains about how late they are.";

    }


    await interaction.update({

      embeds: [

        new EmbedBuilder()

          .setTitle(
            `✨ ${perk.name}`
          )

          .setDescription(
            instructions
          )

          .setFooter({

            text:
              "The Perk is not spent until you select a Strained Aspect."

          })

      ],

      components:
        rows

    });


    return true;

  }


  // ==================================================
  // Resolve Strain-removal Perk
  // ==================================================

  if (
    action ===
    "perk_strain"
  ) {

    const aspectIndex =
      Number.parseInt(
        parts[3],
        10
      );


    const aspect =
      character.aspects?.[
        aspectIndex
      ];


    if (
      !Number.isInteger(
        aspectIndex
      ) ||
      !aspect ||
      !aspect.strained
    ) {

      await interaction.reply({

        content:
          "☠ That Strain is no longer available to remove.",

        ephemeral:
          true

      });


      return true;

    }


    // ------------------------------------------------
    // Use the SAME state.js activatePerk() function
    // used by the web application.
    // ------------------------------------------------

    const assignments =
      clone(
        state.assignments ||
        {}
      );


    const store =
      State.createStore({

        storage:
          null,

        initialState:
          state

      });


    try {

      store.activatePerk(
        character.id,
        perk.id,
        aspect.id
      );

    }

    catch (error) {

      await interaction.reply({

        content:
          `☠ **${perk.name}** could not be used: ${error.message}`,

        ephemeral:
          true

      });


      return true;

    }


    const next =
      store.getState();


    next.assignments =
      assignments;


    campaign.gameState =
      next;


    saveCampaign(
      campaign
    );


    // ------------------------------------------------
    // Close the private picker.
    // ------------------------------------------------

    await interaction.update({

      content:
        `✨ **${character.name} used ${perk.name}.**\n\n` +
        `**${aspect.name}** is no longer Strained.`,

      embeds: [],

      components: []

    });


    // ------------------------------------------------
    // Public play-by-post announcement.
    // ------------------------------------------------

    try {

      await interaction.channel.send({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              `✨ ${perk.name}`
            )

            .setDescription(
              `**${character.name}** uses **${perk.name}**.`
            )

            .addFields(

              {

                name:
                  "Strain Removed",

                value:
                  aspect.name,

                inline:
                  true

              },

              {

                name:
                  "Usage",

                value:
                  "Used — Story",

                inline:
                  true

              }

            )

        ]

      });

    }

    catch (error) {

      console.warn(
        "Could not post public Perk announcement:"
      );

      console.warn(
        error.message
      );

    }


    return true;

  }


  return false;

}


// ====================================================
// Exports
// ====================================================

module.exports = {

  handlePerkCommand,

  handleButton

};