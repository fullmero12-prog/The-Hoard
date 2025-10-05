// ------------------------------------------------------------
// Deck Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Handles all card pulling logic for the game.
//   It knows how to find decks (Relics, Boons, Upgrades),
//   draw random cards from them, apply rarity weights,
//   and reshuffle or discard cards as needed.
//
//   Think of it as the dealer in a card game —
//   it decides what cards come up next for each event.
// ------------------------------------------------------------

var DeckManager = (function () {

  // ------------------------------------------------------------
  // Static deck data (for manual import + fallback draws)
  // ------------------------------------------------------------
  // This mirrors the JSON file in /src/data/Relics.json so the
  // API script can still simulate draws even if the Roll20 deck
  // has not been created yet. When Roll20 grants create/update
  // permissions for card decks we can use this payload to seed
  // everything automatically.
  var STATIC_DECK_DATA = {
    Relics: {
      Common: [
        {
          id: "relic_quickcast_signet_C",
          name: "Quickcast Signet",
          rarity: "Common",
          category: "Tempo",
          price: 30,
          text_in_run: "Once per room, you may cast a cantrip as a bonus action.",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Tempo", "Casting", "BonusAction"]
        },
        {
          id: "relic_second_wind_flask_C",
          name: "Second Wind Flask",
          rarity: "Common",
          category: "Defense",
          price: 25,
          text_in_run: "Once per room, heal 2d8 HP as a bonus action.",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Defense", "Healing", "Sustain"]
        },
        {
          id: "relic_encore_coin_C",
          name: "Encore Coin",
          rarity: "Common",
          category: "Reroll",
          price: 30,
          text_in_run: "Once per room, reroll any d20 you roll (you must use the new result).",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Reroll", "Dice", "Control"]
        },
        {
          id: "relic_midas_marker_C",
          name: "Midas Marker",
          rarity: "Common",
          category: "Economy",
          price: 25,
          text_in_run: "Gain +5 Scrip after every room.",
          uses: { cadence: "per_room", value: 0 },
          tags: ["Economy", "Currency"]
        }
      ],
      Greater: [
        {
          id: "relic_quickcast_signet_G",
          name: "Quickcast Signet (Greater)",
          rarity: "Greater",
          category: "Tempo",
          price: 50,
          text_in_run: "Twice per room, you may cast a cantrip as a bonus action. Regains 1 use after defeating an enemy.",
          uses: { cadence: "per_room", value: 2 },
          tags: ["Tempo", "Casting", "BonusAction"]
        },
        {
          id: "relic_second_wind_flask_G",
          name: "Second Wind Flask (Greater)",
          rarity: "Greater",
          category: "Defense",
          price: 45,
          text_in_run: "Heal 4d8 HP and cleanse 1 condition once per room.",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Defense", "Healing", "Cleanse"]
        },
        {
          id: "relic_encore_coin_G",
          name: "Encore Coin (Greater)",
          rarity: "Greater",
          category: "Reroll",
          price: 50,
          text_in_run: "Twice per room, reroll any d20 you or an ally roll.",
          uses: { cadence: "per_room", value: 2 },
          tags: ["Reroll", "Dice", "AllySupport"]
        },
        {
          id: "relic_midas_marker_G",
          name: "Midas Marker (Greater)",
          rarity: "Greater",
          category: "Economy",
          price: 45,
          text_in_run: "Gain +10 Scrip after every room and +1 reroll token at the first shop.",
          uses: { cadence: "per_room", value: 0 },
          tags: ["Economy", "Currency", "Reroll"]
        }
      ],
      Signature: [
        {
          id: "relic_quickcast_signet_S",
          name: "Quickcast Signet (Signature)",
          rarity: "Signature",
          category: "Tempo",
          price: 70,
          text_in_run: "Once per turn, cast any spell of 2nd level or lower as a bonus action (1/room).",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Tempo", "Casting", "BonusAction"]
        },
        {
          id: "relic_second_wind_flask_S",
          name: "Second Wind Flask (Signature)",
          rarity: "Signature",
          category: "Defense",
          price: 70,
          text_in_run: "Heal 5d8 HP, cleanse all conditions, and gain resistance to all damage until the start of your next turn (1/room).",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Defense", "Healing", "Cleanse", "Resistance"]
        },
        {
          id: "relic_encore_coin_S",
          name: "Encore Coin (Signature)",
          rarity: "Signature",
          category: "Reroll",
          price: 70,
          text_in_run: "Once per room, reroll any d20 (you choose which result to keep). If both are 20s, gain +1 FSE.",
          uses: { cadence: "per_room", value: 1 },
          tags: ["Reroll", "Luck", "ResourceGain"]
        },
        {
          id: "relic_midas_marker_S",
          name: "Midas Marker (Signature)",
          rarity: "Signature",
          category: "Economy",
          price: 70,
          text_in_run: "Gain +15 Scrip after every room. Shop rerolls cost 0 once per visit.",
          uses: { cadence: "per_room", value: 0 },
          tags: ["Economy", "Currency", "Discount"]
        }
      ]
    }
  };

  /** Helper: clone static data so consumers cannot mutate the source */
  function cloneStaticData() {
    return JSON.parse(JSON.stringify(STATIC_DECK_DATA));
  }

  /** Returns the local payload for a given base deck */
  function getStaticDeckData(baseName) {
    if (!STATIC_DECK_DATA[baseName]) {
      return null;
    }
    return cloneStaticData()[baseName];
  }

  /** Build a faux card object so downstream code can reuse existing paths */
  function buildCardStub(baseName, rarity, entry) {
    var card = {
      id: entry.id,
      name: entry.name,
      data: entry,
      deckSource: baseName,
      rarity: rarity,
      isStub: true,
      get: function (prop) {
        if (prop === "name") {
          return entry.name;
        }
        if (prop === "gmnotes") {
          return JSON.stringify(entry);
        }
        if (prop === "notes") {
          return entry.text_in_run || "";
        }
        return null;
      }
    };
    return card;
  }

  /** Draw from static payload if the Roll20 deck is missing */
  function drawFromStatic(deckName) {
    var parts = (deckName || "").split(".");
    if (parts.length < 2) {
      return null;
    }

    var baseName = parts[0];
    var rarityName = parts[1];
    var table = STATIC_DECK_DATA[baseName];
    if (!table) {
      return null;
    }

    var entries = table[rarityName];
    if (!entries || !entries.length) {
      return null;
    }

    var index = randomInteger(entries.length) - 1;
    var entry = entries[index];
    log(`DeckManager: using static ${baseName}.${rarityName} entry (${entry.name}).`);
    return buildCardStub(baseName, rarityName, entry);
  }

  /** Helper: finds a deck object by name */
  function getDeck(deckName) {
    var deck = findObjs({ type: "deck", name: deckName })[0];
    if (!deck) {
      log(`Deck "${deckName}" not found! Falling back to static data if available.`);
    }
    return deck;
  }

  /** Draws a single card from a given deck */
  function drawOne(deckName) {
    var deck = getDeck(deckName);
    if (!deck) {
      return drawFromStatic(deckName);
    }

    var cards = deck.get("cards");
    if (!cards || cards.length === 0) {
      log(`Deck ${deckName} is empty! Using static fallback.`);
      return drawFromStatic(deckName);
    }

    var cardId = cards[0].id;
    var card = getObj("card", cardId);
    if (card) {
      deck.deal(1, Campaign().get("playerspecificpages"));
      return card;
    }

    log(`DeckManager: Card ${cardId} missing, using static fallback for ${deckName}.`);
    return drawFromStatic(deckName);
  }

  /** Draws a card from a specific rarity deck */
  function drawByRarity(baseName, rarity) {
    if (!baseName || !rarity) {
      return null;
    }

    var normalized = rarity;
    if (rarity === "C") normalized = "Common";
    if (rarity === "G") normalized = "Greater";
    if (rarity === "S") normalized = "Signature";

    return drawOne(`${baseName}.${normalized}`);
  }

  /** Draws from weighted rarity decks (e.g., Common/Greater/Signature) */
  function drawByWeight(baseName, weights) {
    var roll = randomInteger(100) / 100;
    var deckName = `${baseName}.Common`;
    if (roll > weights.C && roll <= weights.C + weights.G) deckName = `${baseName}.Greater`;
    if (roll > weights.C + weights.G) deckName = `${baseName}.Signature`;
    return drawOne(deckName);
  }

  /** Shuffles all decks in a given category */
  function shuffleAll(baseName, rarities) {
    rarities.forEach(r => {
      const d = getDeck(`${baseName}.${r}`);
      if (d) d.shuffle();
    });
  }

  /** Shows a menu of drawn cards (K options) */
  function presentChoices(playerName, cards, commandPrefix) {
    let menu = `<div style="border:1px solid #555;background:#1a1a1a;padding:5px;color:#eee">`;
    menu += `<b>Choose one:</b><br>`;
    cards.forEach(c => {
      menu += `[${c.get("name")}](!${commandPrefix} ${c.id}) `;
    });
    menu += `</div>`;
    sendChat("Hoard Run", `/w ${playerName} ${menu}`);
  }

  return {
    getDeck,
    drawOne,
    drawByRarity,
    drawByWeight,
    shuffleAll,
    presentChoices,
    getStaticDeckData
  };

})();
