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
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('DeckManager', message);
    } else {
      log('[Hoard Run] [DeckManager] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('DeckManager', message);
    } else {
      log('[Hoard Run] [DeckManager] ⚠️ ' + message);
    }
  }

  // ------------------------------------------------------------
  // Static deck data (for manual import + fallback draws)
  // ------------------------------------------------------------
  // All fallback data is sourced from the canonical loaders in
  // /src/data so Roll20 decks, static draws, and shops stay in
  // sync. Each builder returns a fresh clone to prevent callers
  // from mutating the underlying catalog.

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function bucketize(entries) {
    var buckets = {};
    (entries || []).forEach(function (entry) {
      var rarity = entry.rarity || 'Common';
      if (!buckets[rarity]) {
        buckets[rarity] = [];
      }
      buckets[rarity].push(deepClone(entry));
    });
    return buckets;
  }

  function resolveRelicBuckets() {
    if (typeof RelicData !== 'undefined' && RelicData.getRarityBuckets) {
      return RelicData.getRarityBuckets();
    }

    if (state && state.HoardRun && state.HoardRun.relicBuckets) {
      return deepClone(state.HoardRun.relicBuckets);
    }

    if (state && state.HoardRun && state.HoardRun.relics) {
      return bucketize(state.HoardRun.relics);
    }

    return null;
  }

  var STATIC_DECK_BUILDERS = {
    Relics: resolveRelicBuckets
  };

  /** Helper: clone static data so consumers cannot mutate the source */
  function getStaticDeckData(baseName) {
    var builder = STATIC_DECK_BUILDERS[baseName];
    if (!builder) {
      return null;
    }

    var data = builder();
    if (!data) {
      return null;
    }

    return deepClone(data);
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
    info('Using static ' + baseName + '.' + rarityName + ' entry (' + entry.name + ').');
    return buildCardStub(baseName, rarityName, entry);
  }

  /** Helper: finds a deck object by name */
  function getDeck(deckName) {
    var deck = findObjs({ type: "deck", name: deckName })[0];
    if (!deck) {
      warn('Deck "' + deckName + '" not found. Using static data if available.');
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
      warn('Deck ' + deckName + ' is empty. Using static fallback.');
      return drawFromStatic(deckName);
    }

    var cardId = cards[0].id;
    var card = getObj("card", cardId);
    if (card) {
      deck.deal(1, Campaign().get("playerspecificpages"));
      return card;
    }

    warn('Card ' + cardId + ' missing from deck ' + deckName + '. Using static fallback.');
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
