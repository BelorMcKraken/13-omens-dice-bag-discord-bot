"use strict";
const {
  randomUUID
} = require("node:crypto");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const Rules =
  require("../js/rules.js");
const State =
  require("../js/state.js");
const {
  getCampaign,
  updateGameState,
  isGameMaster
} = require("./game-manager");

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function saveCampaign(campaign) {
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

function ensureRulesState(campaign) {
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

  const totalWounds =
    state.characters.reduce(
      (
        total,
        character
      ) =>
        total +
        Number(
          character.wounds ||
          0
        ),
      0
    );

  const totalSafeDiceLost =
    state.characters.reduce(
      (
        total,
        character
      ) =>
        total +
        Number(
          character.safeDiceLost ||
          0
        ),
      0
    );

  if (
    !state.bag ||
    typeof state.bag !==
      "object"
  ) {
    state.bag = {
      safe:
        Math.max(
          0,
          8 -
          totalSafeDiceLost
        ),
      omen:
        0
    };
  }

  state.bag.safe =
    Number.isInteger(
      state.bag.safe
    )
      ? state.bag.safe
      : 8;

  state.bag.omen =
    Number.isInteger(
      state.bag.omen
    )
      ? state.bag.omen
      : 0;

  if (
    !Number.isInteger(
      state.hostOmens
    )
  ) {
    state.hostOmens =
      Math.max(
        0,
        13 -
        state.bag.omen -
        totalWounds
      );
  }

  state.settings = {
    autoApplyStrainFlaw:
      false,
    lockActDuringPendingCheck:
      true,
    allowPlayerCharacterEdits:
      true,
    ...state.settings
  };

  if (
    !Array.isArray(
      state.history
    )
  ) {
    state.history = [];
  }

  state.currentCheck ??=
    null;

  if (
    state.characters.length > 0 &&
    !state.characters.some(
      character =>
        character.id ===
        state.selectedCharacterId
    )
  ) {
    state.selectedCharacterId =
      state.characters[0].id;
  }

  return state;
}

async function campaignForInteraction(
  interaction
) {
  if (
    !interaction.guildId ||
    !interaction.channelId
  ) {
    await interaction.reply({
      content:
        "☠ Checks must be used inside a Discord campaign channel.",
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

function findCharacter(
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

function findAspect(
  character,
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
    character.aspects?.find(
      aspect =>
        String(
          aspect.name ||
          ""
        )
          .trim()
          .toLowerCase() ===
          normalized ||

        String(
          aspect.id ||
          ""
        )
          .trim()
          .toLowerCase() ===
          normalized
    ) ||
    null
  );
}

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

function mayControlCheck(
  campaign,
  check,
  userId
) {
  if (
    isGameMaster(
      campaign,
      userId
    )
  ) {
    return true;
  }

  const assigned =
    assignedUserId(
      campaign,
      check.characterId
    );

  return (
    assigned ===
    userId
  );
}

function perkEffectText(rule) {
  if (!rule) {
    return "Manual Perk";
  }

  switch (rule.type) {

    case "reroll":
      return (
        "Reroll the same dice. " +
        "The better result is selected automatically."
      );

    case "keep":
      return (
        "Change resolution to Highest + Lowest."
      );

    case "bossy":
      return (
        "Gain 1 Edge and resolve using Highest + Lowest."
      );

    case "cancel":
      return (
        "Cancel one Flaw affecting this Check."
      );

    case "aid":
      return (
        "Help another character by canceling one Flaw."
      );

    case "lucky":
      return (
        "Use Luck instead of the original Aspect for this Check."
      );

    case "edge":
      return (
        "Gain 1 additional Edge for this Check."
      );

    default:
      return rule.type;
  }
}

function eligibleCheckPerks(
  campaign,
  userId
) {
  const state =
    campaign.gameState;

  const check =
    state.currentCheck;

  if (
    !check ||
    check.phase ===
      Rules.PHASE_RESOLVED
  ) {
    return [];
  }

  const gm =
    isGameMaster(
      campaign,
      userId
    );

  const results = [];

  state.characters.forEach(
    (
      character,
      characterIndex
    ) => {

      if (
        !gm &&
        assignedUserId(
          campaign,
          character.id
        ) !==
        userId
      ) {
        return;
      }

      const seenRuleKeys =
        new Set();

      (
        character.perks ||
        []
      ).forEach(
        (
          perk,
          perkIndex
        ) => {

          if (
            !perk ||
            !perk.ruleKey
          ) {
            return;
          }

          if (
            seenRuleKeys.has(
              perk.ruleKey
            )
          ) {
            return;
          }

          seenRuleKeys.add(
            perk.ruleKey
          );

          const rule =
            Rules.Perks
              .PERK_RULES[
                perk.ruleKey
              ];

          if (!rule) {
            return;
          }

          if (
            !Rules.Perks.eligible(
              character,
              perk,
              state,
              check
            )
          ) {
            return;
          }

          results.push({
            character,
            characterIndex,
            perk,
            perkIndex,
            rule
          });

        }
      );

    }
  );

  return results;
}

function hasAnyEligibleCheckPerk(
  state
) {
  const check =
    state.currentCheck;

  if (
    !check ||
    check.phase ===
      Rules.PHASE_RESOLVED
  ) {
    return false;
  }

  for (
    const character of
      state.characters
  ) {
    for (
      const perk of
        character.perks ||
        []
    ) {
      if (
        perk?.ruleKey &&
        Rules.Perks.eligible(
          character,
          perk,
          state,
          check
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function difficultyName(
  modifier
) {
  return (
    Object.entries(
      Rules.DIFFICULTIES
    ).find(
      (
        [
          ,
          value
        ]
      ) =>
        value ===
        modifier
    )?.[0] ||
    "Average"
  );
}

function dieTypeText(
  die
) {
  if (
    die.type ===
    Rules.DIE_OMEN
  ) {
    return "💀 Omen Die";
  }

  return "🎲 Safe Die";
}

function drawModeText(
  check
) {
  if (
    check.keepStrategy ===
    "highest-plus-lowest"
  ) {
    return "Highest + Lowest";
  }

  if (
    check.composition.resolutionMode ===
    "EDGE"
  ) {
    return "Edge — keep highest two";
  }

  if (
    check.composition.resolutionMode ===
    "FLAW"
  ) {
    return "Flaw — keep lowest two";
  }

  return "Normal — use both dice";
}

function formatDrawnDice(
  check
) {
  if (
    !Array.isArray(
      check.dice
    ) ||
    !check.dice.length
  ) {
    return "No dice drawn.";
  }

  return (
    check.dice
      .map(
        (
          die,
          index
        ) => {

          let text =
            `${index + 1}. ${dieTypeText(die)}`;

          if (
            die.source ===
            "forced"
          ) {
            text +=
              " — **Forced Omen**";
          }

          return text;

        }
      )
      .join(
        "\n"
      )
  );
}

function formatRolledDice(
  roll
) {
  if (
    !roll ||
    !Array.isArray(
      roll.dice
    )
  ) {
    return "No roll available.";
  }

  return (
    roll.dice
      .map(
        (
          die,
          index
        ) => {

          let status =
            die.used
              ? "**USED**"
              : "Discarded";

          if (
            die.selectedWound
          ) {
            status +=
              " • 💀 **WOUND DIE**";
          }

          else if (
            die.woundCandidate
          ) {
            status +=
              " • Omen wound candidate";
          }

          return (
            `${index + 1}. ` +
            `${dieTypeText(die)} — ` +
            `**${die.result}** — ` +
            `${status}`
          );

        }
      )
      .join(
        "\n"
      )
  );
}

function modifierText(
  check
) {
  const lines = [];

  if (
    check.configuration.edges
  ) {
    lines.push(
      `Edges: ${check.configuration.edges}`
    );
  }

  if (
    check.configuration.flaws
  ) {
    lines.push(
      `Flaws: ${check.configuration.flaws}`
    );
  }

  if (
    check.automaticFlaws?.wounds
  ) {
    lines.push(
      `Wound Flaw: ${check.automaticFlaws.wounds}`
    );
  }

  if (
    check.automaticFlaws?.strain
  ) {
    lines.push(
      `Strain Flaw: ${check.automaticFlaws.strain}`
    );
  }

  if (
    check.configuration.forcedOmen
  ) {
    lines.push(
      "Forced Omen: Yes"
    );
  }

  if (
    check.configuration.risky
  ) {
    lines.push(
      "Risky: Yes"
    );
  }

  if (
    check.configuration.harmless
  ) {
    lines.push(
      "Harmless: Yes"
    );
  }

  for (
    const activation of
      check.perkActivations ||
      []
  ) {
    lines.push(
      `Perk: ${activation.name}`
    );
  }

  if (!lines.length) {
    return "None";
  }

  return lines.join(
    "\n"
  );
}

function requestedEmbed(
  campaign,
  check
) {
  const assigned =
    assignedUserId(
      campaign,
      check.characterId
    );

  const embed =
    new EmbedBuilder()

      .setTitle(
        "☠ CHECK CALLED"
      )

      .setDescription(
        `**${check.characterName}** must make a Check.`
      )

      .addFields(

        {
          name:
            "Aspect",

          value:
            `${check.configuration.aspect} — ${check.configuration.rating}`,

          inline:
            true
        },

        {
          name:
            "Target Number",

          value:
            String(
              check.finalTn
            ),

          inline:
            true
        },

        {
          name:
            "Difficulty",

          value:
            difficultyName(
              check.configuration.difficultyModifier
            ),

          inline:
            true
        },

        {
          name:
            "Dice to Draw",

          value:
            String(
              check.composition.totalPhysicalDice
            ),

          inline:
            true
        },

        {
          name:
            "Resolution",

          value:
            drawModeText(
              check
            ),

          inline:
            true
        },

        {
          name:
            "Player",

          value:
            assigned
              ? `<@${assigned}>`
              : `<@${campaign.gm.discordId}> — GM control`,

          inline:
            false
        },

        {
          name:
            "Modifiers",

          value:
            modifierText(
              check
            ),

          inline:
            false
        }

      );

  if (
    check.originalAspectName &&
    check.originalAspectName !==
      check.configuration.aspect
  ) {
    embed.addFields({
      name:
        "Original Aspect",

      value:
        check.originalAspectName,

      inline:
        false
    });
  }

  embed.setFooter({
    text:
      "Reach into the bag when ready."
  });

  return embed;
}

function drawnEmbed(
  state,
  check
) {
  return (
    new EmbedBuilder()

      .setTitle(
        "🎲 DICE DRAWN"
      )

      .setDescription(
        `**${check.characterName}** reaches into the bag...`
      )

      .addFields(

        {
          name:
            "Check",

          value:
            `${check.configuration.aspect} — ${check.configuration.rating}\n` +
            `TN ${check.finalTn}`,

          inline:
            true
        },

        {
          name:
            "Resolution",

          value:
            drawModeText(
              check
            ),

          inline:
            true
        },

        {
          name:
            "Dice Drawn",

          value:
            formatDrawnDice(
              check
            ),

          inline:
            false
        },

        {
          name:
            "Modifiers",

          value:
            modifierText(
              check
            ),

          inline:
            false
        },

        {
          name:
            "Bag",

          value:
            `🎲 Safe: **${state.bag.safe}**\n` +
            `💀 Omens: **${state.bag.omen}**\n` +
            `Host Omens: **${state.hostOmens}**`,

          inline:
            false
        }

      )

      .setFooter({
        text:
          "The die types are known. Their faces are not. Roll when ready."
      })
  );
}

function rolledEmbed(
  state,
  check
) {
  const roll =
    Rules.getSelectedRoll(
      check
    );

  const embed =
    new EmbedBuilder()

      .setTitle(
        "🎲 CHECK RESULT"
      )

      .setDescription(
        `**${check.characterName} — ${check.configuration.aspect}**`
      )

      .addFields(

        {
          name:
            "Dice",

          value:
            formatRolledDice(
              roll
            ),

          inline:
            false
        },

        {
          name:
            "Total",

          value:
            String(
              roll.total
            ),

          inline:
            true
        },

        {
          name:
            "Target Number",

          value:
            String(
              check.finalTn
            ),

          inline:
            true
        },

        {
          name:
            "Result",

          value:
            `**${roll.result}**`,

          inline:
            true
        },

        {
          name:
            "Resolution",

          value:
            drawModeText(
              check
            ),

          inline:
            false
        }

      );

  if (
    check.reroll
  ) {
    const selectedName =
      check.selectedRoll ===
        "reroll"
        ? "Reroll"
        : "Original";

    embed.addFields({
      name:
        "🎭 Reroll",

      value:
        `Original: **${check.originalRoll.total}**\n` +
        `Reroll: **${check.reroll.total}**\n` +
        `Selected: **${selectedName}**`,

      inline:
        false
    });
  }

  if (
    check.perkActivations?.length
  ) {
    embed.addFields({
      name:
        "Perks Used",

      value:
        check.perkActivations
          .map(
            activation =>
              `• ${activation.name}`
          )
          .join(
            "\n"
          ),

      inline:
        false
    });
  }

  if (
    roll.riskyFailure
  ) {
    embed.addFields({
      name:
        "⚠ Risky Failure",

      value:
        "The GM may apply an additional narrative consequence.",

      inline:
        false
    });
  }

  if (
    roll.wound.triggered &&
    !check.configuration.harmless
  ) {
    embed.addFields({
      name:
        "💀 OMEN WOUND",

      value:
        `An Omen rolled **${roll.wound.selectedWoundDie?.result ?? "?"}**, ` +
        `at or below the ${check.act} Wound threshold of **${roll.wound.threshold}**.`,

      inline:
        false
    });
  }

  if (
    roll.wound.triggered &&
    check.configuration.harmless
  ) {
    embed.addFields({
      name:
        "⚠ Harmless Omen",

      value:
        `The Omen would cause a Wound, but this Check is Harmless. ` +
        `Finishing the Check will Strain **${check.configuration.aspect}** instead.`,

      inline:
        false
    });
  }

  return embed;
}

function completedEmbed(
  state,
  check,
  message = null
) {
  const roll =
    Rules.getSelectedRoll(
      check
    );

  const character =
    state.characters.find(
      entry =>
        entry.id ===
        check.characterId
    );

  const embed =
    new EmbedBuilder()

      .setTitle(
        "☠ CHECK COMPLETE"
      )

      .setDescription(
        `**${character?.name || check.characterName} — ${check.configuration.aspect}**`
      );

  if (roll) {
    embed.addFields(

      {
        name:
          "Result",

        value:
          `**${roll.result}**`,

        inline:
          true
      },

      {
        name:
          "Roll",

        value:
          `${roll.total} vs TN ${check.finalTn}`,

        inline:
          true
      }

    );
  }

  if (
    check.perkActivations?.length
  ) {
    embed.addFields({
      name:
        "Perks Used",

      value:
        check.perkActivations
          .map(
            activation =>
              `• ${activation.name}`
          )
          .join(
            "\n"
          ),

      inline:
        false
    });
  }

  if (message) {
    embed.addFields({
      name:
        "Resolution",

      value:
        message,

      inline:
        false
    });
  }

  embed.addFields({
    name:
      "Bag",

    value:
      `🎲 Safe: **${state.bag.safe}**\n` +
      `💀 Omens: **${state.bag.omen}**\n` +
      `Host Omens: **${state.hostOmens}**`,

    inline:
      false
  });

  embed.setFooter({
    text:
      "The Check is resolved."
  });

  return embed;
}

function makeUsePerkButton(
  state,
  check
) {
  if (
    !hasAnyEligibleCheckPerk(
      state
    )
  ) {
    return null;
  }

  return (
    new ButtonBuilder()

      .setCustomId(
        `check_perks|${check.id}`
      )

      .setLabel(
        "Use Perk"
      )

      .setEmoji(
        "✨"
      )

      .setStyle(
        ButtonStyle.Secondary
      )
  );
}

function requestedComponents(
  state,
  check
) {
  const row =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `check_draw|${check.id}`
          )

          .setLabel(
            "Reach Into the Bag"
          )

          .setStyle(
            ButtonStyle.Primary
          )

      );

  const perkButton =
    makeUsePerkButton(
      state,
      check
    );

  if (perkButton) {
    row.addComponents(
      perkButton
    );
  }

  return [
    row
  ];
}

function drawnComponents(
  state,
  check
) {
  const row =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `check_roll|${check.id}`
          )

          .setLabel(
            "Roll Dice"
          )

          .setStyle(
            ButtonStyle.Primary
          )

      );

  const perkButton =
    makeUsePerkButton(
      state,
      check
    );

  if (perkButton) {
    row.addComponents(
      perkButton
    );
  }

  if (
    check.valiantAvailable
  ) {
    row.addComponents(

      new ButtonBuilder()

        .setCustomId(
          `check_valiant|${check.id}`
        )

        .setLabel(
          "Valiant Sacrifice"
        )

        .setStyle(
          ButtonStyle.Danger
        )

    );
  }

  return [
    row
  ];
}

function rolledComponents(
  state,
  check
) {
  const row =
    new ActionRowBuilder();

  if (
    check.phase ===
    Rules.PHASE_AWAITING_WOUND
  ) {
    row.addComponents(

      new ButtonBuilder()

        .setCustomId(
          `check_wound|${check.id}`
        )

        .setLabel(
          "Take Wound"
        )

        .setStyle(
          ButtonStyle.Danger
        )

    );

    if (
      Rules.canCheatDeath(
        state,
        check
      )
    ) {
      row.addComponents(

        new ButtonBuilder()

          .setCustomId(
            `check_cheat|${check.id}`
          )

          .setLabel(
            "Cheat Death"
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      );
    }
  }

  else {
    row.addComponents(

      new ButtonBuilder()

        .setCustomId(
          `check_finish|${check.id}`
        )

        .setLabel(
          "Finish Check"
        )

        .setStyle(
          ButtonStyle.Success
        )

    );
  }

  const perkButton =
    makeUsePerkButton(
      state,
      check
    );

  if (perkButton) {
    row.addComponents(
      perkButton
    );
  }

  return [
    row
  ];
}

function buildPerkPicker(
  campaign,
  userId
) {
  const perks =
    eligibleCheckPerks(
      campaign,
      userId
    );

  if (!perks.length) {
    return null;
  }

  const gm =
    isGameMaster(
      campaign,
      userId
    );

  const rows = [];

  const limited =
    perks.slice(
      0,
      25
    );

  for (
    let i = 0;
    i < limited.length;
    i += 5
  ) {
    const row =
      new ActionRowBuilder();

    for (
      const candidate of
        limited.slice(
          i,
          i + 5
        )
    ) {
      const {
        character,
        characterIndex,
        perk,
        perkIndex,
        rule
      } =
        candidate;

      const label =
        gm ||
        character.id !==
          campaign.gameState.currentCheck.characterId
          ? `${character.name}: ${rule.name}`
          : rule.name;

      row.addComponents(

        new ButtonBuilder()

          .setCustomId(
            `check_perkuse|` +
            `${campaign.gameState.currentCheck.id}|` +
            `${characterIndex}|` +
            `${perkIndex}|` +
            `${perk.ruleKey}`
          )

          .setLabel(
            label.slice(
              0,
              80
            )
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      );
    }

    rows.push(
      row
    );
  }

  const description =
    limited
      .map(
        candidate => {

          const status =
            Rules.Perks.usageStatus(
              candidate.character,
              candidate.perk,
              campaign.gameState,
              campaign.gameState.currentCheck
            );

          return (
            `**${candidate.character.name} — ${candidate.rule.name}**\n` +
            `${perkEffectText(candidate.rule)}\n` +
            `*${status}*`
          );

        }
      )
      .join(
        "\n\n"
      );

  return {
    embed:
      new EmbedBuilder()

        .setTitle(
          "✨ Available Perks"
        )

        .setDescription(
          description.slice(
            0,
            4000
          )
        )

        .setFooter({
          text:
            "Only Perks legal at the current Check phase are shown."
        }),

    rows
  };
}

function publicCheckPayload(
  campaign
) {
  const state =
    campaign.gameState;

  const check =
    state.currentCheck;

  if (!check) {
    return null;
  }

  if (
    check.phase ===
    Rules.PHASE_REQUESTED
  ) {
    return {
      embeds: [
        requestedEmbed(
          campaign,
          check
        )
      ],

      components:
        requestedComponents(
          state,
          check
        )
    };
  }

  if (
    check.phase ===
    Rules.PHASE_DRAWN
  ) {
    return {
      embeds: [
        drawnEmbed(
          state,
          check
        )
      ],

      components:
        drawnComponents(
          state,
          check
        )
    };
  }

  if (
    check.phase ===
      Rules.PHASE_ROLLED ||
    check.phase ===
      Rules.PHASE_AWAITING_WOUND
  ) {
    return {
      embeds: [
        rolledEmbed(
          state,
          check
        )
      ],

      components:
        rolledComponents(
          state,
          check
        )
    };
  }

  if (
    check.phase ===
    Rules.PHASE_RESOLVED
  ) {
    return {
      embeds: [
        completedEmbed(
          state,
          check,
          "Check resolved."
        )
      ],

      components: []
    };
  }

  return null;
}

async function refreshPublicCheckMessage(
  interaction,
  campaign
) {
  const check =
    campaign.gameState.currentCheck;

  if (
    !check?.discordMessageId
  ) {
    return;
  }

  const payload =
    publicCheckPayload(
      campaign
    );

  if (!payload) {
    return;
  }

  try {

    if (
      !interaction.channel ||
      !interaction.channel.messages
    ) {
      return;
    }

    const message =
      await interaction.channel.messages.fetch(
        check.discordMessageId
      );

    await message.edit(
      payload
    );

  }

  catch (error) {
    console.warn(
      "Could not refresh public Check message:"
    );

    console.warn(
      error.message
    );
  }
}

async function handleCheckCommand(
  interaction
) {
  const campaign =
    await campaignForInteraction(
      interaction
    );

  if (!campaign) {
    return;
  }

  if (
    !isGameMaster(
      campaign,
      interaction.user.id
    )
  ) {
    await interaction.reply({
      content:
        "☠ Only the Game Master can call for a Check.",
      ephemeral:
        true
    });

    return;
  }

  const state =
    campaign.gameState;

  if (
    state.currentCheck &&
    state.currentCheck.phase !==
      Rules.PHASE_RESOLVED
  ) {
    await interaction.reply({
      content:
        `☠ **${state.currentCheck.characterName || "A character"}** already has a pending Check.`,
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

  const aspectName =
    interaction.options.getString(
      "aspect",
      true
    );

  const difficulty =
    interaction.options.getString(
      "difficulty"
    ) ||
    "Average";

  const edges =
    interaction.options.getInteger(
      "edges"
    ) ??
    0;

  const flaws =
    interaction.options.getInteger(
      "flaws"
    ) ??
    0;

  const risky =
    interaction.options.getBoolean(
      "risky"
    ) ??
    false;

  const harmless =
    interaction.options.getBoolean(
      "harmless"
    ) ??
    false;

  const forcedOmen =
    interaction.options.getBoolean(
      "forced_omen"
    ) ??
    false;

  const character =
    findCharacter(
      campaign,
      characterName
    );

  if (!character) {
    await interaction.reply({
      content:
        `☠ No character named **${characterName}** exists in this campaign.`,
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
        `☠ **${character.name}** is not active and cannot make a Check.`,
      ephemeral:
        true
    });

    return;
  }

  const aspect =
    findAspect(
      character,
      aspectName
    );

  if (!aspect) {
    const available =
      (
        character.aspects ||
        []
      )
        .map(
          item =>
            item.name
        )
        .join(
          ", "
        );

    await interaction.reply({
      content:
        `☠ **${character.name}** does not have an Aspect named **${aspectName}**.\n\n` +
        `Available Aspects: ${available}`,
      ephemeral:
        true
    });

    return;
  }

  const difficultyModifier =
    Rules.DIFFICULTIES[
      difficulty
    ];

  if (
    difficultyModifier ===
    undefined
  ) {
    await interaction.reply({
      content:
        `☠ Unknown difficulty: **${difficulty}**.`,
      ephemeral:
        true
    });

    return;
  }

  if (
    forcedOmen &&
    state.hostOmens < 1
  ) {
    await interaction.reply({
      content:
        "☠ The Host has no Omens available to force into this Check.",
      ephemeral:
        true
    });

    return;
  }

  const automaticFlaws =
    Rules.automaticFlawSources(
      state,
      aspect.id,
      {
        characterId:
          character.id
      }
    );

  const configuration = {
    aspectId:
      aspect.id,

    aspect:
      aspect.name,

    rating:
      aspect.rating,

    manualTn:
      false,

    baseTn:
      Rules.getTargetNumberForRating(
        aspect.rating
      ),

    allowPlayerRating:
      false,

    difficultyModifier,

    edges,

    flaws,

    risky,

    harmless,

    forcedOmen
  };

  const check = {
    id:
      randomUUID(),

    characterId:
      character.id,

    characterName:
      character.name,

    playerId:
      assignedUserId(
        campaign,
        character.id
      ),

    requestedBy:
      interaction.user.id,

    act:
      state.act,

    sceneNumber:
      state.sceneNumber,

    phase:
      Rules.PHASE_REQUESTED,

    configuration,

    composition:
      Rules.calculateCheckComposition({
        ...configuration,

        automaticFlaws:
          automaticFlaws.wounds +
          automaticFlaws.strain
      }),

    automaticFlaws,

    finalTn:
      Rules.determineFinalTN(
        configuration.baseTn,
        configuration.difficultyModifier
      ),

    dice:
      [],

    originalRoll:
      null,

    reroll:
      null,

    selectedRoll:
      null,

    forcedOmenCommitted:
      false,

    valiantAvailable:
      false,

    resolved:
      false,

    woundThreshold:
      Rules.getWoundThreshold(
        character,
        state.act
      ),

    perkActivations:
      [],

    originalAspectId:
      aspect.id,

    originalAspectName:
      aspect.name,

    effectiveAspectId:
      aspect.id,

    discordMessageId:
      null
  };

  Rules.refreshCheckModifiers(
    state,
    check
  );

  state.currentCheck =
    check;

  state.selectedCharacterId =
    character.id;

  state.history.push({
    time:
      new Date().toISOString(),

    text:
      `${interaction.user.username} called for ` +
      `${character.name} to make a ${difficulty} ` +
      `${aspect.name} Check (${state.act}).`
  });

  state.history =
    state.history.slice(
      -250
    );

  saveCampaign(
    campaign
  );

  await interaction.reply({
    embeds: [
      requestedEmbed(
        campaign,
        check
      )
    ],

    components:
      requestedComponents(
        state,
        check
      )
  });

  try {
    const message =
      await interaction.fetchReply();

    state.currentCheck.discordMessageId =
      message.id;

    saveCampaign(
      campaign
    );
  }

  catch (error) {
    console.warn(
      "Could not store Check message ID:"
    );

    console.warn(
      error.message
    );
  }
}

async function activateCheckPerk(
  interaction,
  campaign,
  characterIndex,
  perkIndex,
  expectedRuleKey
) {
  const state =
    campaign.gameState;

  const check =
    state.currentCheck;

  if (
    !check ||
    check.phase ===
      Rules.PHASE_RESOLVED
  ) {
    await interaction.reply({
      content:
        "☠ This Check is no longer active.",
      ephemeral:
        true
    });

    return;
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
    !perk ||
    perk.ruleKey !==
      expectedRuleKey
  ) {
    await interaction.reply({
      content:
        "☠ That Perk is no longer available.",
      ephemeral:
        true
    });

    return;
  }

  if (
    !isGameMaster(
      campaign,
      interaction.user.id
    ) &&
    assignedUserId(
      campaign,
      character.id
    ) !==
      interaction.user.id
  ) {
    await interaction.reply({
      content:
        "☠ You cannot activate that character's Perk.",
      ephemeral:
        true
    });

    return;
  }

  if (
    !Rules.Perks.eligible(
      character,
      perk,
      state,
      check
    )
  ) {
    await interaction.reply({
      content:
        `☠ **${perk.name}** is no longer available at this point in the Check.`,
      ephemeral:
        true
    });

    return;
  }

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
      perk.id
    );
  }

  catch (error) {
    await interaction.reply({
      content:
        `☠ **${perk.name}** could not be activated: ${error.message}`,
      ephemeral:
        true
    });

    return;
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

  const rule =
    Rules.Perks.PERK_RULES[
      perk.ruleKey
    ];

  await interaction.update({
    content:
      `✨ **${character.name} used ${perk.name}.**\n\n` +
      `${perkEffectText(rule)}`,

    embeds: [],

    components: []
  });

  await refreshPublicCheckMessage(
    interaction,
    campaign
  );
}

async function handleButton(
  interaction
) {
  const parts =
    interaction.customId.split(
      "|"
    );

  const action =
    parts[0];

  const checkId =
    parts[1];

  if (
    !action.startsWith(
      "check_"
    )
  ) {
    return false;
  }

  const campaign =
    await campaignForInteraction(
      interaction
    );

  if (!campaign) {
    return true;
  }

  const state =
    campaign.gameState;

  const check =
    state.currentCheck;

  if (
    !check ||
    check.id !==
      checkId
  ) {
    await interaction.reply({
      content:
        "☠ This Check is no longer active.",
      ephemeral:
        true
    });

    return true;
  }

  if (
    action ===
    "check_perks"
  ) {
    const picker =
      buildPerkPicker(
        campaign,
        interaction.user.id
      );

    if (!picker) {
      await interaction.reply({
        content:
          "✨ You do not currently have an eligible active Perk for this Check.",
        ephemeral:
          true
      });

      return true;
    }

    await interaction.reply({
      embeds: [
        picker.embed
      ],

      components:
        picker.rows,

      ephemeral:
        true
    });

    return true;
  }

  if (
    action ===
    "check_perkuse"
  ) {
    const characterIndex =
      Number.parseInt(
        parts[2],
        10
      );

    const perkIndex =
      Number.parseInt(
        parts[3],
        10
      );

    const expectedRuleKey =
      parts[4];

    if (
      !Number.isInteger(
        characterIndex
      ) ||
      !Number.isInteger(
        perkIndex
      ) ||
      !expectedRuleKey
    ) {
      await interaction.reply({
        content:
          "☠ Invalid Perk selection.",
        ephemeral:
          true
      });

      return true;
    }

    await activateCheckPerk(
      interaction,
      campaign,
      characterIndex,
      perkIndex,
      expectedRuleKey
    );

    return true;
  }

  if (
    !mayControlCheck(
      campaign,
      check,
      interaction.user.id
    )
  ) {
    const assigned =
      assignedUserId(
        campaign,
        check.characterId
      );

    await interaction.reply({
      content:
        assigned
          ? `☠ Only <@${assigned}> or the Game Master may control this Check.`
          : "☠ Only the Game Master may control this unassigned character's Check.",

      ephemeral:
        true
    });

    return true;
  }

  if (
    action ===
    "check_draw"
  ) {
    if (
      check.phase !==
      Rules.PHASE_REQUESTED
    ) {
      await interaction.reply({
        content:
          "☠ The dice have already been drawn for this Check.",
        ephemeral:
          true
      });

      return true;
    }

    const drawState =
      clone(
        state
      );

    drawState.currentCheck =
      null;

    drawState.selectedCharacterId =
      check.characterId;

    drawState.act =
      check.act;

    const store =
      State.createStore({
        storage:
          null,

        initialState:
          drawState
      });

    try {
      store.drawCheck({
        ...check.configuration,

        automaticFlawSnapshot:
          check.automaticFlaws,

        compositionSnapshot:
          check.composition
      });
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ The dice could not be drawn: ${error.message}`,
        ephemeral:
          true
      });

      return true;
    }

    const next =
      store.getState();

    next.assignments =
      clone(
        state.assignments ||
        {}
      );

    next.act =
      state.act;

    next.selectedCharacterId =
      state.selectedCharacterId;

    Object.assign(
      next.currentCheck,
      {
        id:
          check.id,

        playerId:
          check.playerId,

        requestedBy:
          check.requestedBy,

        sceneNumber:
          check.sceneNumber,

        woundThreshold:
          check.woundThreshold,

        perkActivations:
          clone(
            check.perkActivations ||
            []
          ),

        keepStrategy:
          check.keepStrategy,

        modifierSources:
          clone(
            check.modifierSources ||
            []
          ),

        originalAspectId:
          check.originalAspectId,

        originalAspectName:
          check.originalAspectName,

        effectiveAspectId:
          check.effectiveAspectId,

        discordMessageId:
          check.discordMessageId,

        configuration: {
          ...check.configuration,
          ...next.currentCheck.configuration
        }
      }
    );

    campaign.gameState =
      next;

    saveCampaign(
      campaign
    );

    await interaction.update({
      embeds: [
        drawnEmbed(
          next,
          next.currentCheck
        )
      ],

      components:
        drawnComponents(
          next,
          next.currentCheck
        )
    });

    return true;
  }

  if (
    action ===
    "check_roll"
  ) {
    if (
      check.phase !==
      Rules.PHASE_DRAWN
    ) {
      await interaction.reply({
        content:
          "☠ This Check is not ready to roll.",
        ephemeral:
          true
      });

      return true;
    }

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
      store.rollCheck();
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ The dice could not be rolled: ${error.message}`,
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

    await interaction.update({
      embeds: [
        rolledEmbed(
          next,
          next.currentCheck
        )
      ],

      components:
        rolledComponents(
          next,
          next.currentCheck
        )
    });

    return true;
  }

  if (
    action ===
    "check_finish"
  ) {
    if (
      check.phase !==
      Rules.PHASE_ROLLED
    ) {
      await interaction.reply({
        content:
          "☠ This Check cannot be finished yet.",
        ephemeral:
          true
      });

      return true;
    }

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

    let message =
      "Check resolved.";

    try {
      const selected =
        Rules.getSelectedRoll(
          check
        );

      if (
        check.configuration.harmless &&
        selected?.wound?.triggered
      ) {
        message =
          `Harmless Omen: **${check.configuration.aspect}** becomes Strained.`;
      }

      store.finishCheck();
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ The Check could not be finished: ${error.message}`,
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

    await interaction.update({
      embeds: [
        completedEmbed(
          next,
          next.currentCheck,
          message
        )
      ],

      components: []
    });

    return true;
  }

  if (
    action ===
    "check_wound"
  ) {
    if (
      check.phase !==
      Rules.PHASE_AWAITING_WOUND
    ) {
      await interaction.reply({
        content:
          "☠ There is no unresolved Omen Wound.",
        ephemeral:
          true
      });

      return true;
    }

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
      store.takeWound();
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ The Wound could not be resolved: ${error.message}`,
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

    const resolvedCheck =
      next.currentCheck;

    const character =
      next.characters.find(
        entry =>
          entry.id ===
          resolvedCheck.characterId
      );

    let resolution;

    if (
      character.active
    ) {
      resolution =
        `**${character.name}** takes an Omen Wound.\n` +
        `Current Wounds: **${character.wounds}**`;
    }

    else {
      resolution =
        `**${character.name}** succumbs to Death or Despair.\n` +
        "Their Wound Omens return to the bag.";
    }

    await interaction.update({
      embeds: [
        completedEmbed(
          next,
          resolvedCheck,
          resolution
        )
      ],

      components: []
    });

    return true;
  }

  if (
    action ===
    "check_cheat"
  ) {
    if (
      check.phase !==
      Rules.PHASE_AWAITING_WOUND
    ) {
      await interaction.reply({
        content:
          "☠ Cheat Death is not available right now.",
        ephemeral:
          true
      });

      return true;
    }

    if (
      !Rules.canCheatDeath(
        state,
        check
      )
    ) {
      await interaction.reply({
        content:
          "☠ This character cannot Cheat Death on this Check.",
        ephemeral:
          true
      });

      return true;
    }

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
      store.cheatDeath();
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ Cheat Death failed: ${error.message}`,
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

    const resolvedCheck =
      next.currentCheck;

    const character =
      next.characters.find(
        entry =>
          entry.id ===
          resolvedCheck.characterId
      );

    await interaction.update({
      embeds: [
        completedEmbed(
          next,
          resolvedCheck,

          `**${character.name}** Cheats Death.\n` +
          "One Safe die is permanently removed from the bag.\n" +
          `Safe dice remaining: **${next.bag.safe}**`
        )
      ],

      components: []
    });

    return true;
  }

  if (
    action ===
    "check_valiant"
  ) {
    if (
      check.phase !==
        Rules.PHASE_DRAWN ||
      !check.valiantAvailable
    ) {
      await interaction.reply({
        content:
          "☠ Valiant Sacrifice is not available for this Check.",
        ephemeral:
          true
      });

      return true;
    }

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
      store.valiantSacrifice();
    }

    catch (error) {
      await interaction.reply({
        content:
          `☠ Valiant Sacrifice could not be resolved: ${error.message}`,
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

    const resolvedCheck =
      next.currentCheck;

    const character =
      next.characters.find(
        entry =>
          entry.id ===
          resolvedCheck.characterId
      );

    await interaction.update({
      embeds: [

        new EmbedBuilder()

          .setTitle(
            "☠ VALIANT SACRIFICE"
          )

          .setDescription(
            `**${character.name}** makes the ultimate sacrifice.`
          )

          .addFields(

            {
              name:
                "Result",

              value:
                "**AUTOMATIC SUCCESS**",

              inline:
                true
            },

            {
              name:
                "Status",

              value:
                "Removed from play",

              inline:
                true
            },

            {
              name:
                "Bag",

              value:
                `🎲 Safe: **${next.bag.safe}**\n` +
                `💀 Omens: **${next.bag.omen}**\n` +
                `Host Omens: **${next.hostOmens}**`,

              inline:
                false
            }

          )

          .setFooter({
            text:
              "Their Wound Omens return to the bag."
          })

      ],

      components: []
    });

    return true;
  }

  return false;
}

module.exports = {
  handleCheckCommand,
  handleButton
};