/**
 * 13 Omens Discord Character Manager
 *
 * Handles character import/export for Discord while
 * preserving compatibility with the existing
 * 13 Omens web application's character format.
 *
 * Discord-specific metadata such as character ownership
 * is stored only inside the Discord campaign state and
 * is never included in portable character exports.
 */

const ThirteenOmensState =
  require("../js/state.js");


// ====================================================
// Normalize character name
// ====================================================

function normalizeCharacterName(
  name
) {

  return String(
    name || ""
  )
    .trim()
    .toLowerCase();

}


// ====================================================
// Character owner helpers
// ====================================================

/**
 * ownerDiscordId is Discord-only metadata.
 *
 * It represents the Discord user who owns/manages the
 * character outside of temporary campaign assignment.
 *
 * Ownership and assignment are intentionally separate:
 *
 * ownerDiscordId
 *   = who may maintain/edit/export the character
 *
 * campaign.gameState.assignments
 *   = who is currently playing the character
 *
 * Old characters may not have ownerDiscordId at all.
 * Those characters are treated as having no player owner.
 */

function getCharacterOwnerId(
  character
) {

  if (
    !character ||
    typeof character !==
      "object"
  ) {

    return null;

  }


  if (
    typeof character.ownerDiscordId !==
      "string"
  ) {

    return null;

  }


  const ownerDiscordId =
    character.ownerDiscordId.trim();


  return (
    ownerDiscordId ||
    null
  );

}


// ====================================================
// Is character owner
// ====================================================

function isCharacterOwner(
  character,
  discordUserId
) {

  if (
    !discordUserId
  ) {

    return false;

  }


  return (
    getCharacterOwnerId(
      character
    ) ===
    String(
      discordUserId
    )
  );

}


// ====================================================
// Set character owner
// ====================================================

function setCharacterOwner(
  character,
  discordUserId
) {

  if (
    !character ||
    typeof character !==
      "object"
  ) {

    throw new Error(
      "Character not found."
    );

  }


  // --------------------------------------------------
  // Null / blank removes player ownership
  // --------------------------------------------------

  if (
    discordUserId ===
      null ||
    discordUserId ===
      undefined ||
    String(
      discordUserId
    ).trim() ===
      ""
  ) {

    delete character.ownerDiscordId;

    return null;

  }


  // --------------------------------------------------
  // Store Discord user ID
  // --------------------------------------------------

  character.ownerDiscordId =
    String(
      discordUserId
    ).trim();


  return (
    character.ownerDiscordId
  );

}


// ====================================================
// Import character into campaign
// ====================================================

function importCharacterIntoCampaign(
  campaign,
  characterFile,
  options = {}
) {

  // --------------------------------------------------
  // Validate campaign
  // --------------------------------------------------

  if (
    !campaign ||
    !campaign.gameState
  ) {

    throw new Error(
      "Invalid campaign."
    );

  }


  // --------------------------------------------------
  // Ensure character array exists
  // --------------------------------------------------

  if (
    !Array.isArray(
      campaign.gameState.characters
    )
  ) {

    campaign.gameState.characters = [];

  }


  // --------------------------------------------------
  // Same maximum as the web application
  // --------------------------------------------------

  if (
    campaign.gameState.characters.length >=
    6
  ) {

    throw new Error(
      "Cannot import character: campaign already has the maximum number of characters."
    );

  }


  // --------------------------------------------------
  // Create isolated copy of existing state engine
  // --------------------------------------------------

  /**
   * storage: null prevents the state engine from trying
   * to use browser localStorage while running in Node.
   *
   * This lets Discord use the SAME character validation
   * code as the web application.
   */

  const validator =
    ThirteenOmensState.createStore({
      storage:
        null
    });


  // --------------------------------------------------
  // Import and validate using web-app logic
  // --------------------------------------------------

  /**
   * importCharacter validates:
   *
   * - file type
   * - file version
   * - unknown/protected fields
   * - character text limits
   * - aspects
   * - ratings
   * - perks
   * - perk usage
   * - gear
   * - wounds
   * - character state
   *
   * It also assigns the imported character a new
   * internal character ID.
   *
   * Discord ownership is intentionally NOT read from
   * the imported file.
   */

  const validatedState =
    validator.importCharacter(
      characterFile
    );


  // --------------------------------------------------
  // Find newly imported character
  // --------------------------------------------------

  const importedCharacter =
    validatedState.characters.find(
      character =>
        character.id ===
        validatedState.selectedCharacterId
    );


  if (!importedCharacter) {

    throw new Error(
      "Character import failed."
    );

  }


  // --------------------------------------------------
  // Store detached copy
  // --------------------------------------------------

  const character =
    JSON.parse(
      JSON.stringify(
        importedCharacter
      )
    );


  // --------------------------------------------------
  // Validate imported character name
  // --------------------------------------------------

  const normalizedName =
    normalizeCharacterName(
      character.name
    );


  if (!normalizedName) {

    throw new Error(
      "Imported character does not have a valid name."
    );

  }


  // --------------------------------------------------
  // Prevent duplicate character names
  // --------------------------------------------------

  const duplicateName =
    campaign.gameState.characters.some(
      existing =>
        normalizeCharacterName(
          existing &&
          existing.name
        ) ===
        normalizedName
    );


  if (
    duplicateName
  ) {

    throw new Error(
      `A character named "${character.name}" already exists in this campaign.`
    );

  }


  // --------------------------------------------------
  // Prevent duplicate internal IDs
  // --------------------------------------------------

  if (
    campaign.gameState.characters.some(
      existing =>
        existing.id ===
        character.id
    )
  ) {

    throw new Error(
      "Character import generated a duplicate character ID."
    );

  }


  // --------------------------------------------------
  // Remove any untrusted Discord ownership metadata
  // --------------------------------------------------

  /**
   * The web validator should already reject unknown
   * Discord-only fields in portable files.
   *
   * This is an additional defensive measure so an
   * imported file can never choose its own Discord owner.
   */

  delete character.ownerDiscordId;


  // --------------------------------------------------
  // Apply trusted Discord owner
  // --------------------------------------------------

  /**
   * bot.js may pass:
   *
   * {
   *   ownerDiscordId: interaction.user.id
   * }
   *
   * when a PLAYER imports a character.
   *
   * GM imports may omit this option, leaving the
   * character without a player owner.
   */

  if (
    options &&
    typeof options ===
      "object" &&
    options.ownerDiscordId
  ) {

    setCharacterOwner(
      character,
      options.ownerDiscordId
    );

  }


  // --------------------------------------------------
  // Add to Discord campaign
  // --------------------------------------------------

  campaign.gameState.characters.push(
    character
  );


  return character;

}


// ====================================================
// Find character by name
// ====================================================

function findCharacterByName(
  campaign,
  name
) {

  if (
    !campaign ||
    !campaign.gameState ||
    !Array.isArray(
      campaign.gameState.characters
    )
  ) {

    return null;

  }


  const normalizedName =
    normalizeCharacterName(
      name
    );


  if (!normalizedName) {

    return null;

  }


  return (
    campaign.gameState.characters.find(
      character => {

        if (
          !character ||
          typeof character.name !==
            "string"
        ) {

          return false;

        }


        return (
          normalizeCharacterName(
            character.name
          ) ===
          normalizedName
        );

      }
    ) ||
    null
  );

}


// ====================================================
// Find character by ID
// ====================================================

function findCharacterById(
  campaign,
  characterId
) {

  if (
    !campaign ||
    !campaign.gameState ||
    !Array.isArray(
      campaign.gameState.characters
    )
  ) {

    return null;

  }


  if (
    !characterId
  ) {

    return null;

  }


  return (
    campaign.gameState.characters.find(
      character =>
        character &&
        character.id ===
        characterId
    ) ||
    null
  );

}


// ====================================================
// Get characters owned by Discord user
// ====================================================

function getCharactersOwnedByUser(
  campaign,
  discordUserId
) {

  if (
    !campaign ||
    !campaign.gameState ||
    !Array.isArray(
      campaign.gameState.characters
    ) ||
    !discordUserId
  ) {

    return [];

  }


  return (
    campaign.gameState.characters.filter(
      character =>
        isCharacterOwner(
          character,
          discordUserId
        )
    )
  );

}


// ====================================================
// Export character
// ====================================================

function exportCharacter(
  character
) {

  if (
    !character ||
    typeof character !==
      "object"
  ) {

    throw new Error(
      "Character not found."
    );

  }


  // --------------------------------------------------
  // Character field allowlist
  // --------------------------------------------------

  /**
   * This mirrors the persistent character fields used
   * by the 13 Omens web application.
   *
   * Discord-only data such as:
   *
   * - ownerDiscordId
   * - Discord user IDs
   * - Guild IDs
   * - Channel IDs
   * - Campaign IDs
   * - Assignment information
   *
   * must never become part of a portable character file.
   */

  const allowedCharacterKeys = [

    "id",

    "name",

    "archetype",

    "description",

    "notes",

    "aspects",

    "perkUsage",

    "perks",

    "gear",

    "strainReliefUsed",

    "wounds",

    "active",

    "cheatDeathUsed",

    "safeDiceLost",

    "strain",

    "statusMessage"

  ];


  const exportedCharacter = {};


  // --------------------------------------------------
  // Copy allowed fields
  // --------------------------------------------------

  for (
    const key of
      allowedCharacterKeys
  ) {

    if (
      Object.hasOwn(
        character,
        key
      )
    ) {

      exportedCharacter[key] =
        JSON.parse(
          JSON.stringify(
            character[key]
          )
        );

    }

  }


  // --------------------------------------------------
  // Sanitize aspects
  // --------------------------------------------------

  exportedCharacter.aspects =
    Array.isArray(
      character.aspects
    )
      ? character.aspects.map(
          aspect => ({

            id:
              aspect.id,

            type:
              aspect.type,

            name:
              aspect.name,

            rating:
              aspect.rating,

            strained:
              Boolean(
                aspect.strained
              )

          })
        )
      : [];


  // --------------------------------------------------
  // Sanitize perks
  // --------------------------------------------------

  exportedCharacter.perks =
    Array.isArray(
      character.perks
    )
      ? character.perks.map(
          perk => ({

            id:
              perk.id,

            name:
              perk.name,

            notes:
              perk.notes,

            ruleKey:
              perk.ruleKey ||
              null,

            disabled:
              Boolean(
                perk.disabled
              )

          })
        )
      : [];


  // --------------------------------------------------
  // Sanitize gear
  // --------------------------------------------------

  exportedCharacter.gear =
    Array.isArray(
      character.gear
    )
      ? character.gear.map(
          item => ({

            id:
              item.id,

            name:
              item.name,

            notes:
              item.notes

          })
        )
      : [];


  // --------------------------------------------------
  // Sanitize perk usage
  // --------------------------------------------------

  const perkUsage =
    character.perkUsage &&
    typeof character.perkUsage ===
      "object" &&
    !Array.isArray(
      character.perkUsage
    )
      ? character.perkUsage
      : {};


  exportedCharacter.perkUsage =
    Object.fromEntries(

      Object.entries(
        perkUsage
      ).map(
        (
          [
            key,
            usage
          ]
        ) => [

          key,

          {

            storyUsed:
              Boolean(
                usage &&
                usage.storyUsed
              ),

            actsUsed:
              usage &&
              Array.isArray(
                usage.actsUsed
              )
                ? [
                    ...usage.actsUsed
                  ]
                : [],

            scenesUsed:
              usage &&
              Array.isArray(
                usage.scenesUsed
              )
                ? [
                    ...usage.scenesUsed
                  ]
                : []

          }

        ]
      )

    );


  // --------------------------------------------------
  // Build portable character file
  // --------------------------------------------------

  return {

    type:
      "13-omens-character",

    version:
      1,

    exportedAt:
      new Date().toISOString(),

    character:
      exportedCharacter

  };

}


// ====================================================
// Create safe filename
// ====================================================

function characterFilename(
  character
) {

  if (
    !character ||
    typeof character.name !==
      "string"
  ) {

    return (
      "13-omens-character.json"
    );

  }


  const safeName =
    character.name
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );


  return (
    `13-omens-character-${safeName || "character"}.json`
  );

}


// ====================================================
// Exports
// ====================================================

module.exports = {

  importCharacterIntoCampaign,

  findCharacterByName,

  findCharacterById,

  normalizeCharacterName,

  getCharacterOwnerId,

  isCharacterOwner,

  setCharacterOwner,

  getCharactersOwnedByUser,

  exportCharacter,

  characterFilename

};