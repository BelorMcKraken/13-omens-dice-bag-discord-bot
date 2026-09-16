const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const ThirteenOmensRules =
  require("../js/rules.js");


// ====================================================
// Constants
// ====================================================

const PAGE_SIZE =
  25;

const MAX_PERKS =
  50;

const MAX_GEAR =
  50;


// ====================================================
// Helpers
// ====================================================

function newEntryId(prefix) {

  if (
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID ===
      "function"
  ) {

    return globalThis.crypto.randomUUID();

  }


  return (
    `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
  );

}


function truncate(
  value,
  max = 80
) {

  const text =
    String(
      value ||
      ""
    );


  if (
    text.length <=
    max
  ) {

    return text;

  }


  return (
    `${text.slice(
      0,
      max - 3
    )}...`
  );

}


function getPageCount(
  items
) {

  return (
    Math.max(
      1,
      Math.ceil(
        items.length /
        PAGE_SIZE
      )
    )
  );

}


function normalizePage(
  items,
  requestedPage
) {

  const pageCount =
    getPageCount(
      items
    );


  const parsed =
    Number.parseInt(
      requestedPage,
      10
    );


  let page =
    Number.isFinite(
      parsed
    )
      ? parsed
      : 0;


  if (
    page < 0
  ) {

    page =
      0;

  }


  if (
    page >=
    pageCount
  ) {

    page =
      pageCount - 1;

  }


  return page;

}


function getPageItems(
  items,
  requestedPage
) {

  const page =
    normalizePage(
      items,
      requestedPage
    );


  const start =
    page *
    PAGE_SIZE;


  const end =
    start +
    PAGE_SIZE;


  return {

    page,

    start,

    end,

    pageCount:
      getPageCount(
        items
      ),

    items:
      items.slice(
        start,
        end
      )

  };

}


function findPerk(
  character,
  perkId
) {

  return (
    character.perks?.find(
      perk =>
        perk.id ===
        perkId
    ) ||
    null
  );

}


function findGear(
  character,
  gearId
) {

  return (
    character.gear?.find(
      gear =>
        gear.id ===
        gearId
    ) ||
    null
  );

}


// ====================================================
// Character editor buttons
// ====================================================

function buildItemsButtons(
  character
) {

  return (
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_perks|${character.id}`
          )

          .setLabel(
            "Perks"
          )

          .setStyle(
            ButtonStyle.Secondary
          ),


        new ButtonBuilder()

          .setCustomId(
            `char_gear|${character.id}`
          )

          .setLabel(
            "Gear"
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      )
  );

}


// ====================================================
// PERKS
// ====================================================

function buildPerksEmbed(
  character,
  requestedPage = 0
) {

  const perks =
    Array.isArray(
      character.perks
    )
      ? character.perks
      : [];


  const pageData =
    getPageItems(
      perks,
      requestedPage
    );


  let text =
    "No Perks.";


  if (
    pageData.items.length
  ) {

    text =
      pageData.items
        .map(
          (
            perk,
            localIndex
          ) => {

            const globalIndex =
              pageData.start +
              localIndex;


            const rule =
              perk.ruleKey
                ? ThirteenOmensRules.Perks
                    .PERK_RULES[
                      perk.ruleKey
                    ]
                : null;


            const automation =
              rule
                ? rule.name
                : "Custom / Manual";


            const disabled =
              perk.disabled
                ? " • Disabled"
                : "";


            return (
              `**${globalIndex + 1}. ${perk.name}**\n` +
              `Automation: ${automation}${disabled}` +
              (
                perk.notes
                  ? `\n${perk.notes}`
                  : ""
              )
            );

          }
        )
        .join(
          "\n\n"
        );

  }


  let rangeText =
    "0 entries";


  if (
    perks.length
  ) {

    const rangeStart =
      pageData.start +
      1;


    const rangeEnd =
      Math.min(
        pageData.end,
        perks.length
      );


    rangeText =
      `${rangeStart}-${rangeEnd} of ${perks.length}`;

  }


  return (
    new EmbedBuilder()

      .setTitle(
        truncate(
          `☠ ${character.name} — Perks`,
          256
        )
      )

      .setDescription(
        truncate(
          text,
          4000
        ) ||
        "No Perks."
      )

      .setFooter({
        text:
          `${rangeText} • Page ${pageData.page + 1} of ${pageData.pageCount} • ${perks.length}/${MAX_PERKS} Perks`
      })
  );

}


function buildPerksComponents(
  character,
  requestedPage = 0
) {

  const perks =
    Array.isArray(
      character.perks
    )
      ? character.perks
      : [];


  const pageData =
    getPageItems(
      perks,
      requestedPage
    );


  const rows = [];


  rows.push(

    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_perk_add|${character.id}|${pageData.page}`
          )

          .setLabel(
            "Add Perk"
          )

          .setStyle(
            ButtonStyle.Success
          )

          .setDisabled(
            perks.length >=
            MAX_PERKS
          )

      )

  );


  if (
    pageData.items.length
  ) {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new StringSelectMenuBuilder()

            .setCustomId(
              `char_perk_pick|${character.id}|${pageData.page}`
            )

            .setPlaceholder(
              `Choose a Perk — Page ${pageData.page + 1}`
            )

            .addOptions(

              pageData.items.map(
                (
                  perk,
                  localIndex
                ) => ({

                  label:
                    truncate(
                      `${pageData.start + localIndex + 1}. ${perk.name || "Unnamed Perk"}`,
                      100
                    ),

                  value:
                    perk.id

                })
              )

            )

        )

    );

  }


  if (
    pageData.pageCount >
    1
  ) {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              `char_perks_page|${character.id}|${pageData.page - 1}`
            )

            .setLabel(
              "Previous"
            )

            .setStyle(
              ButtonStyle.Secondary
            )

            .setDisabled(
              pageData.page <=
              0
            ),


          new ButtonBuilder()

            .setCustomId(
              `char_perks_page|${character.id}|${pageData.page + 1}`
            )

            .setLabel(
              "Next"
            )

            .setStyle(
              ButtonStyle.Secondary
            )

            .setDisabled(
              pageData.page >=
              pageData.pageCount - 1
            )

        )

    );

  }


  return rows;

}


// ----------------------------------------------------
// Selected Perk
// ----------------------------------------------------

function buildSelectedPerkEmbed(
  character,
  perk
) {

  const rule =
    perk.ruleKey
      ? ThirteenOmensRules.Perks
          .PERK_RULES[
            perk.ruleKey
          ]
      : null;


  return (
    new EmbedBuilder()

      .setTitle(
        truncate(
          `☠ ${character.name} — ${perk.name}`,
          256
        )
      )

      .addFields(

        {
          name:
            "Automation",

          value:
            truncate(
              rule
                ? rule.name
                : "Custom / Manual",
              1024
            ),

          inline:
            true
        },

        {
          name:
            "Status",

          value:
            perk.disabled
              ? "Disabled"
              : "Enabled",

          inline:
            true
        },

        {
          name:
            "Notes",

          value:
            truncate(
              perk.notes ||
              "None",
              1024
            ),

          inline:
            false
        }

      )
  );

}


function buildSelectedPerkComponents(
  character,
  perk,
  isGameMaster,
  requestedPage = 0
) {

  const perks =
    Array.isArray(
      character.perks
    )
      ? character.perks
      : [];


  const page =
    normalizePage(
      perks,
      requestedPage
    );


  const rows = [];


  // --------------------------------------------------
  // Automation select
  // --------------------------------------------------

  const automationOptions = [

    {
      label:
        "Custom / Manual",

      value:
        "manual",

      default:
        !perk.ruleKey
    }

  ];


  for (
    const [
      key,
      rule
    ] of Object.entries(
      ThirteenOmensRules.Perks.PERK_RULES
    )
  ) {

    automationOptions.push({

      label:
        truncate(
          rule.name,
          100
        ),

      value:
        key,

      description:
        truncate(
          `${rule.usage} • ${rule.type}`,
          100
        ),

      default:
        perk.ruleKey ===
        key

    });

  }


  rows.push(

    new ActionRowBuilder()

      .addComponents(

        new StringSelectMenuBuilder()

          .setCustomId(
            `char_perk_rule|${character.id}|${perk.id}`
          )

          .setPlaceholder(
            "Choose Perk automation"
          )

          .addOptions(
            automationOptions
          )

      )

  );


  // --------------------------------------------------
  // Buttons
  // --------------------------------------------------

  const buttons =
    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_perk_edit|${character.id}|${perk.id}`
          )

          .setLabel(
            "Edit Perk"
          )

          .setStyle(
            ButtonStyle.Primary
          ),


        new ButtonBuilder()

          .setCustomId(
            `char_perk_remove|${character.id}|${perk.id}`
          )

          .setLabel(
            "Remove Perk"
          )

          .setStyle(
            ButtonStyle.Danger
          ),


        new ButtonBuilder()

          .setCustomId(
            `char_perks_page|${character.id}|${page}`
          )

          .setLabel(
            "Back to Perks"
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      );


  if (
    isGameMaster
  ) {

    buttons.addComponents(

      new ButtonBuilder()

        .setCustomId(
          `char_perk_disable|${character.id}|${perk.id}`
        )

        .setLabel(
          perk.disabled
            ? "Restore Perk"
            : "Disable Perk"
        )

        .setStyle(
          perk.disabled
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        )

    );

  }


  rows.push(
    buttons
  );


  return rows;

}


// ====================================================
// GEAR
// ====================================================

function buildGearEmbed(
  character,
  requestedPage = 0
) {

  const gear =
    Array.isArray(
      character.gear
    )
      ? character.gear
      : [];


  const pageData =
    getPageItems(
      gear,
      requestedPage
    );


  let text =
    "No Gear.";


  if (
    pageData.items.length
  ) {

    text =
      pageData.items
        .map(
          (
            item,
            localIndex
          ) => {

            const globalIndex =
              pageData.start +
              localIndex;


            return (
              `**${globalIndex + 1}. ${item.name}**` +
              (
                item.notes
                  ? `\n${item.notes}`
                  : ""
              )
            );

          }
        )
        .join(
          "\n\n"
        );

  }


  let rangeText =
    "0 entries";


  if (
    gear.length
  ) {

    const rangeStart =
      pageData.start +
      1;


    const rangeEnd =
      Math.min(
        pageData.end,
        gear.length
      );


    rangeText =
      `${rangeStart}-${rangeEnd} of ${gear.length}`;

  }


  return (
    new EmbedBuilder()

      .setTitle(
        truncate(
          `☠ ${character.name} — Gear`,
          256
        )
      )

      .setDescription(
        truncate(
          text,
          4000
        ) ||
        "No Gear."
      )

      .setFooter({
        text:
          `${rangeText} • Page ${pageData.page + 1} of ${pageData.pageCount} • ${gear.length}/${MAX_GEAR} Gear entries`
      })
  );

}


function buildGearComponents(
  character,
  requestedPage = 0
) {

  const gear =
    Array.isArray(
      character.gear
    )
      ? character.gear
      : [];


  const pageData =
    getPageItems(
      gear,
      requestedPage
    );


  const rows = [];


  rows.push(

    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_gear_add|${character.id}|${pageData.page}`
          )

          .setLabel(
            "Add Gear"
          )

          .setStyle(
            ButtonStyle.Success
          )

          .setDisabled(
            gear.length >=
            MAX_GEAR
          )

      )

  );


  if (
    pageData.items.length
  ) {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new StringSelectMenuBuilder()

            .setCustomId(
              `char_gear_pick|${character.id}|${pageData.page}`
            )

            .setPlaceholder(
              `Choose Gear — Page ${pageData.page + 1}`
            )

            .addOptions(

              pageData.items.map(
                (
                  item,
                  localIndex
                ) => ({

                  label:
                    truncate(
                      `${pageData.start + localIndex + 1}. ${item.name || "Unnamed Gear"}`,
                      100
                    ),

                  value:
                    item.id

                })
              )

            )

        )

    );

  }


  if (
    pageData.pageCount >
    1
  ) {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              `char_gear_page|${character.id}|${pageData.page - 1}`
            )

            .setLabel(
              "Previous"
            )

            .setStyle(
              ButtonStyle.Secondary
            )

            .setDisabled(
              pageData.page <=
              0
            ),


          new ButtonBuilder()

            .setCustomId(
              `char_gear_page|${character.id}|${pageData.page + 1}`
            )

            .setLabel(
              "Next"
            )

            .setStyle(
              ButtonStyle.Secondary
            )

            .setDisabled(
              pageData.page >=
              pageData.pageCount - 1
            )

        )

    );

  }


  return rows;

}


function buildSelectedGearEmbed(
  character,
  item
) {

  return (
    new EmbedBuilder()

      .setTitle(
        truncate(
          `☠ ${character.name} — ${item.name}`,
          256
        )
      )

      .addFields(

        {
          name:
            "Notes",

          value:
            truncate(
              item.notes ||
              "None",
              1024
            ),

          inline:
            false
        }

      )
  );

}


function buildSelectedGearComponents(
  character,
  item,
  requestedPage = 0
) {

  const gear =
    Array.isArray(
      character.gear
    )
      ? character.gear
      : [];


  const page =
    normalizePage(
      gear,
      requestedPage
    );


  return [

    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            `char_gear_edit|${character.id}|${item.id}`
          )

          .setLabel(
            "Edit Gear"
          )

          .setStyle(
            ButtonStyle.Primary
          ),


        new ButtonBuilder()

          .setCustomId(
            `char_gear_remove|${character.id}|${item.id}`
          )

          .setLabel(
            "Remove Gear"
          )

          .setStyle(
            ButtonStyle.Danger
          ),


        new ButtonBuilder()

          .setCustomId(
            `char_gear_page|${character.id}|${page}`
          )

          .setLabel(
            "Back to Gear"
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      )

  ];

}


// ====================================================
// Modals
// ====================================================

function buildPerkModal(
  character,
  perk = null
) {

  const editing =
    Boolean(
      perk
    );


  const modal =
    new ModalBuilder()

      .setCustomId(

        editing

          ? `char_modal_perk_edit|${character.id}|${perk.id}`

          : `char_modal_perk_add|${character.id}`

      )

      .setTitle(

        editing
          ? "Edit Perk"
          : "Add Perk"

      );


  const name =
    new TextInputBuilder()

      .setCustomId(
        "name"
      )

      .setLabel(
        "Perk Name"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMaxLength(
        120
      );


  if (
    perk?.name
  ) {

    name.setValue(
      perk.name.slice(
        0,
        120
      )
    );

  }


  const notes =
    new TextInputBuilder()

      .setCustomId(
        "notes"
      )

      .setLabel(
        "Perk Notes"
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
    perk?.notes
  ) {

    notes.setValue(
      perk.notes.slice(
        0,
        4000
      )
    );

  }


  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(
        name
      ),

    new ActionRowBuilder()
      .addComponents(
        notes
      )

  );


  return modal;

}


function buildGearModal(
  character,
  item = null
) {

  const editing =
    Boolean(
      item
    );


  const modal =
    new ModalBuilder()

      .setCustomId(

        editing

          ? `char_modal_gear_edit|${character.id}|${item.id}`

          : `char_modal_gear_add|${character.id}`

      )

      .setTitle(

        editing
          ? "Edit Gear"
          : "Add Gear"

      );


  const name =
    new TextInputBuilder()

      .setCustomId(
        "name"
      )

      .setLabel(
        "Gear Name"
      )

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(
        true
      )

      .setMaxLength(
        120
      );


  if (
    item?.name
  ) {

    name.setValue(
      item.name.slice(
        0,
        120
      )
    );

  }


  const notes =
    new TextInputBuilder()

      .setCustomId(
        "notes"
      )

      .setLabel(
        "Gear Notes"
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
    item?.notes
  ) {

    notes.setValue(
      item.notes.slice(
        0,
        4000
      )
    );

  }


  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(
        name
      ),

    new ActionRowBuilder()
      .addComponents(
        notes
      )

  );


  return modal;

}


// ====================================================
// Button handling
// ====================================================

async function handleButton({
  interaction,
  action,
  character,
  campaign,
  extra,
  saveCampaignState,
  isGameMaster
}) {

  // ==================================================
  // Perks list
  // ==================================================

  if (
    action ===
    "char_perks"
  ) {

    await interaction.reply({

      embeds: [
        buildPerksEmbed(
          character,
          0
        )
      ],

      components:
        buildPerksComponents(
          character,
          0
        ),

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Perks page
  // ==================================================

  if (
    action ===
    "char_perks_page"
  ) {

    const perks =
      Array.isArray(
        character.perks
      )
        ? character.perks
        : [];


    const page =
      normalizePage(
        perks,
        extra
      );


    await interaction.update({

      embeds: [
        buildPerksEmbed(
          character,
          page
        )
      ],

      components:
        buildPerksComponents(
          character,
          page
        )

    });


    return true;

  }


  // ==================================================
  // Add Perk
  // ==================================================

  if (
    action ===
    "char_perk_add"
  ) {

    await interaction.showModal(

      buildPerkModal(
        character
      )

    );


    return true;

  }


  // ==================================================
  // Edit Perk
  // ==================================================

  if (
    action ===
    "char_perk_edit"
  ) {

    const perk =
      findPerk(
        character,
        extra
      );


    if (!perk) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    await interaction.showModal(

      buildPerkModal(
        character,
        perk
      )

    );


    return true;

  }


  // ==================================================
  // Remove Perk
  // ==================================================

  if (
    action ===
    "char_perk_remove"
  ) {

    const perks =
      Array.isArray(
        character.perks
      )
        ? character.perks
        : [];


    const perkIndex =
      perks.findIndex(
        perk =>
          perk.id ===
          extra
      );


    if (
      perkIndex ===
      -1
    ) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    const pageBeforeRemoval =
      Math.floor(
        perkIndex /
        PAGE_SIZE
      );


    const perk =
      perks[
        perkIndex
      ];


    character.perks =
      perks.filter(
        entry =>
          entry.id !==
          perk.id
      );


    saveCampaignState(
      campaign
    );


    const page =
      normalizePage(
        character.perks,
        pageBeforeRemoval
      );


    await interaction.update({

      embeds: [
        buildPerksEmbed(
          character,
          page
        )
      ],

      components:
        buildPerksComponents(
          character,
          page
        )

    });


    return true;

  }


  // ==================================================
  // Host disable / restore Perk
  // ==================================================

  if (
    action ===
    "char_perk_disable"
  ) {

    if (
      !isGameMaster(
        campaign,
        interaction.user.id
      )
    ) {

      await interaction.reply({

        content:
          "☠ Only the Game Master can disable or restore Perks.",

        ephemeral:
          true

      });


      return true;

    }


    const perk =
      findPerk(
        character,
        extra
      );


    if (!perk) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    perk.disabled =
      !perk.disabled;


    saveCampaignState(
      campaign
    );


    const perkIndex =
      (
        character.perks ||
        []
      ).findIndex(
        entry =>
          entry.id ===
          perk.id
      );


    const page =
      perkIndex >= 0
        ? Math.floor(
            perkIndex /
            PAGE_SIZE
          )
        : 0;


    await interaction.update({

      embeds: [
        buildSelectedPerkEmbed(
          character,
          perk
        )
      ],

      components:
        buildSelectedPerkComponents(
          character,
          perk,
          true,
          page
        )

    });


    return true;

  }


  // ==================================================
  // Gear list
  // ==================================================

  if (
    action ===
    "char_gear"
  ) {

    await interaction.reply({

      embeds: [
        buildGearEmbed(
          character,
          0
        )
      ],

      components:
        buildGearComponents(
          character,
          0
        ),

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Gear page
  // ==================================================

  if (
    action ===
    "char_gear_page"
  ) {

    const gear =
      Array.isArray(
        character.gear
      )
        ? character.gear
        : [];


    const page =
      normalizePage(
        gear,
        extra
      );


    await interaction.update({

      embeds: [
        buildGearEmbed(
          character,
          page
        )
      ],

      components:
        buildGearComponents(
          character,
          page
        )

    });


    return true;

  }


  // ==================================================
  // Add Gear
  // ==================================================

  if (
    action ===
    "char_gear_add"
  ) {

    await interaction.showModal(

      buildGearModal(
        character
      )

    );


    return true;

  }


  // ==================================================
  // Edit Gear
  // ==================================================

  if (
    action ===
    "char_gear_edit"
  ) {

    const item =
      findGear(
        character,
        extra
      );


    if (!item) {

      await interaction.reply({

        content:
          "☠ That Gear entry no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    await interaction.showModal(

      buildGearModal(
        character,
        item
      )

    );


    return true;

  }


  // ==================================================
  // Remove Gear
  // ==================================================

  if (
    action ===
    "char_gear_remove"
  ) {

    const gear =
      Array.isArray(
        character.gear
      )
        ? character.gear
        : [];


    const gearIndex =
      gear.findIndex(
        item =>
          item.id ===
          extra
      );


    if (
      gearIndex ===
      -1
    ) {

      await interaction.reply({

        content:
          "☠ That Gear entry no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    const pageBeforeRemoval =
      Math.floor(
        gearIndex /
        PAGE_SIZE
      );


    const item =
      gear[
        gearIndex
      ];


    character.gear =
      gear.filter(
        entry =>
          entry.id !==
          item.id
      );


    saveCampaignState(
      campaign
    );


    const page =
      normalizePage(
        character.gear,
        pageBeforeRemoval
      );


    await interaction.update({

      embeds: [
        buildGearEmbed(
          character,
          page
        )
      ],

      components:
        buildGearComponents(
          character,
          page
        )

    });


    return true;

  }


  return false;

}


// ====================================================
// Select handling
// ====================================================

async function handleSelectMenu({
  interaction,
  action,
  character,
  campaign,
  aspectId,
  saveCampaignState,
  isGameMaster
}) {

  // ==================================================
  // Pick Perk
  // ==================================================

  if (
    action ===
    "char_perk_pick"
  ) {

    const perks =
      Array.isArray(
        character.perks
      )
        ? character.perks
        : [];


    const page =
      normalizePage(
        perks,
        aspectId
      );


    const perk =
      findPerk(
        character,
        interaction.values[0]
      );


    if (!perk) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    await interaction.update({

      embeds: [
        buildSelectedPerkEmbed(
          character,
          perk
        )
      ],

      components:
        buildSelectedPerkComponents(
          character,
          perk,
          isGameMaster(
            campaign,
            interaction.user.id
          ),
          page
        )

    });


    return true;

  }


  // ==================================================
  // Change Perk automation
  // ==================================================

  if (
    action ===
    "char_perk_rule"
  ) {

    const perk =
      findPerk(
        character,
        aspectId
      );


    if (!perk) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    const selected =
      interaction.values[0];


    if (
      selected ===
      "manual"
    ) {

      perk.ruleKey =
        null;

    }

    else {

      const rule =
        ThirteenOmensRules.Perks
          .PERK_RULES[
            selected
          ];


      if (!rule) {

        throw new Error(
          "Unknown Perk automation rule."
        );

      }


      perk.ruleKey =
        selected;


      // Match the web app's helpful behavior:
      // if this is still an empty/generic name,
      // use the automated Perk's proper name.

      if (
        !perk.name ||
        perk.name ===
          "Custom"
      ) {

        perk.name =
          rule.name;

      }

    }


    saveCampaignState(
      campaign
    );


    const perkIndex =
      (
        character.perks ||
        []
      ).findIndex(
        entry =>
          entry.id ===
          perk.id
      );


    const page =
      perkIndex >= 0
        ? Math.floor(
            perkIndex /
            PAGE_SIZE
          )
        : 0;


    await interaction.update({

      embeds: [
        buildSelectedPerkEmbed(
          character,
          perk
        )
      ],

      components:
        buildSelectedPerkComponents(
          character,
          perk,
          isGameMaster(
            campaign,
            interaction.user.id
          ),
          page
        )

    });


    return true;

  }


  // ==================================================
  // Pick Gear
  // ==================================================

  if (
    action ===
    "char_gear_pick"
  ) {

    const gear =
      Array.isArray(
        character.gear
      )
        ? character.gear
        : [];


    const page =
      normalizePage(
        gear,
        aspectId
      );


    const item =
      findGear(
        character,
        interaction.values[0]
      );


    if (!item) {

      await interaction.reply({

        content:
          "☠ That Gear entry no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    await interaction.update({

      embeds: [
        buildSelectedGearEmbed(
          character,
          item
        )
      ],

      components:
        buildSelectedGearComponents(
          character,
          item,
          page
        )

    });


    return true;

  }


  return false;

}


// ====================================================
// Modal handling
// ====================================================

async function handleModalSubmit({
  interaction,
  action,
  character,
  campaign,
  aspectId,
  saveCampaignState
}) {

  // ==================================================
  // Add Perk
  // ==================================================

  if (
    action ===
    "char_modal_perk_add"
  ) {

    character.perks ??=
      [];


    if (
      character.perks.length >=
      MAX_PERKS
    ) {

      await interaction.reply({

        content:
          `☠ This character already has the maximum of ${MAX_PERKS} Perks.`,

        ephemeral:
          true

      });


      return true;

    }


    const name =
      interaction.fields
        .getTextInputValue(
          "name"
        )
        .trim();


    const notes =
      interaction.fields
        .getTextInputValue(
          "notes"
        );


    character.perks.push({

      id:
        newEntryId(
          "perk"
        ),

      name,

      notes,

      ruleKey:
        null,

      disabled:
        false

    });


    saveCampaignState(
      campaign
    );


    const newPerkIndex =
      character.perks.length -
      1;


    const page =
      Math.floor(
        newPerkIndex /
        PAGE_SIZE
      );


    await interaction.reply({

      content:
        `☠ Added Perk **${name}** to **${character.name}**.`,

      embeds: [
        buildPerksEmbed(
          character,
          page
        )
      ],

      components:
        buildPerksComponents(
          character,
          page
        ),

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Edit Perk
  // ==================================================

  if (
    action ===
    "char_modal_perk_edit"
  ) {

    const perk =
      findPerk(
        character,
        aspectId
      );


    if (!perk) {

      await interaction.reply({

        content:
          "☠ That Perk no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    perk.name =
      interaction.fields
        .getTextInputValue(
          "name"
        )
        .trim();


    perk.notes =
      interaction.fields
        .getTextInputValue(
          "notes"
        );


    saveCampaignState(
      campaign
    );


    const perkIndex =
      (
        character.perks ||
        []
      ).findIndex(
        entry =>
          entry.id ===
          perk.id
      );


    const page =
      perkIndex >= 0
        ? Math.floor(
            perkIndex /
            PAGE_SIZE
          )
        : 0;


    await interaction.reply({

      content:
        `☠ Updated **${perk.name}**.`,

      embeds: [
        buildSelectedPerkEmbed(
          character,
          perk
        )
      ],

      components:
        buildSelectedPerkComponents(
          character,
          perk,
          false,
          page
        ),

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Add Gear
  // ==================================================

  if (
    action ===
    "char_modal_gear_add"
  ) {

    character.gear ??=
      [];


    if (
      character.gear.length >=
      MAX_GEAR
    ) {

      await interaction.reply({

        content:
          `☠ This character already has the maximum of ${MAX_GEAR} Gear entries.`,

        ephemeral:
          true

      });


      return true;

    }


    const name =
      interaction.fields
        .getTextInputValue(
          "name"
        )
        .trim();


    const notes =
      interaction.fields
        .getTextInputValue(
          "notes"
        );


    character.gear.push({

      id:
        newEntryId(
          "gear"
        ),

      name,

      notes

    });


    saveCampaignState(
      campaign
    );


    const newGearIndex =
      character.gear.length -
      1;


    const page =
      Math.floor(
        newGearIndex /
        PAGE_SIZE
      );


    await interaction.reply({

      content:
        `☠ Added **${name}** to **${character.name}**'s Gear.`,

      embeds: [
        buildGearEmbed(
          character,
          page
        )
      ],

      components:
        buildGearComponents(
          character,
          page
        ),

      ephemeral:
        true

    });


    return true;

  }


  // ==================================================
  // Edit Gear
  // ==================================================

  if (
    action ===
    "char_modal_gear_edit"
  ) {

    const item =
      findGear(
        character,
        aspectId
      );


    if (!item) {

      await interaction.reply({

        content:
          "☠ That Gear entry no longer exists.",

        ephemeral:
          true

      });


      return true;

    }


    item.name =
      interaction.fields
        .getTextInputValue(
          "name"
        )
        .trim();


    item.notes =
      interaction.fields
        .getTextInputValue(
          "notes"
        );


    saveCampaignState(
      campaign
    );


    const gearIndex =
      (
        character.gear ||
        []
      ).findIndex(
        entry =>
          entry.id ===
          item.id
      );


    const page =
      gearIndex >= 0
        ? Math.floor(
            gearIndex /
            PAGE_SIZE
          )
        : 0;


    await interaction.reply({

      content:
        `☠ Updated **${item.name}**.`,

      embeds: [
        buildSelectedGearEmbed(
          character,
          item
        )
      ],

      components:
        buildSelectedGearComponents(
          character,
          item,
          page
        ),

      ephemeral:
        true

    });


    return true;

  }


  return false;

}


// ====================================================
// Exports
// ====================================================

module.exports = {

  buildItemsButtons,

  handleButton,

  handleSelectMenu,

  handleModalSubmit

};