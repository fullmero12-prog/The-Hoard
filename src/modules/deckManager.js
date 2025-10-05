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

  /** Helper: finds a deck object by name */
  function getDeck(deckName) {
    let deck = findObjs({ type: "deck", name: deckName })[0];
    if (!deck) {
      log(`Deck "${deckName}" not found!`);
    }
    return deck;
  }

  /** Draws a single card from a given deck */
  function drawOne(deckName) {
    const deck = getDeck(deckName);
    if (!deck) return null;

    // Draw the top card
    const cards = deck.get("cards");
    if (!cards || cards.length === 0) {
      log(`Deck ${deckName} is empty!`);
      return null;
    }

    const cardId = cards[0].id;
    const card = getObj("card", cardId);
    if (card) {
      deck.deal(1, Campaign().get("playerspecificpages"));
      return card;
    }
    return null;
  }

  /** Draws from weighted rarity decks (e.g., Common/Greater/Signature) */
  function drawByWeight(baseName, weights) {
    const roll = randomInteger(100) / 100;
    let deckName = `${baseName}.Common`;
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
    drawByWeight,
    shuffleAll,
    presentChoices
  };

})();
