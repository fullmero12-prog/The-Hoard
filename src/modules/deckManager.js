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

  /** Build the relic fallback table from state or bundled data */
  function buildRelicFallback() {
    var pool = [];

    if (typeof state !== "undefined" && state.HoardRun && state.HoardRun.relics && state.HoardRun.relics.length) {
      pool = state.HoardRun.relics;
    } else if (typeof RelicDecks !== "undefined" && RelicDecks.Relics && RelicDecks.Relics.length) {
      pool = RelicDecks.Relics;
    }

    if (!pool.length) {
      return null;
    }

    var grouped = { Common: [], Greater: [], Signature: [] };
    pool.forEach(function (entry) {
      var rarity = entry.rarity || "Common";
      if (!grouped[rarity]) {
        grouped[rarity] = [];
      }
      grouped[rarity].push(entry);
    });

    return grouped;
  }

  /** Returns the local payload for a given base deck */
  function getStaticDeckData(baseName) {
    if (baseName === "Relics") {
      var data = buildRelicFallback();
      return data ? JSON.parse(JSON.stringify(data)) : null;
    }
    return null;
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
    var table = getStaticDeckData(baseName);
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
