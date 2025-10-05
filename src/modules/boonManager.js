// ------------------------------------------------------------
// Boon Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Offers Ancestor boons to players after rooms or shop events.
//   Pulls weighted cards from the appropriate boon decks,
//   charges Scrip based on rarity, and records the choice in state.
//
//   It also exposes chat commands so the GM can manually
//   trigger boon menus or players can confirm their selection.
// ------------------------------------------------------------

var BoonManager = (function () {

  var RARITY_WEIGHTS = {
    C: 0.45,
    G: 0.40,
    S: 0.15
  };

  var RARITY_PRICES = {
    C: 35,
    G: 55,
    S: 90
  };

  var OFFER_COUNT = 3;

  /** Returns the Roll20 display name (quoted for whispers) */
  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    if (player) {
      return '"' + player.get('_displayname') + '"';
    }
    return '"Unknown"';
  }

  /** Determines the ancestor deck path */
  function getDeckBase(ancestor) {
    var active = ancestor || 'Default';
    return 'Boons.' + active;
  }

  /** Draws weighted boon cards from ancestor deck */
  function drawBoons(ancestor) {
    if (typeof DeckManager === 'undefined' || typeof DeckManager.drawByWeight !== 'function') {
      if (typeof UIManager !== 'undefined' && typeof UIManager.gmLog === 'function') {
        UIManager.gmLog('BoonManager: DeckManager.drawByWeight() not available.');
      } else {
        sendChat('Hoard Run', '/w gm BoonManager: DeckManager.drawByWeight() not available.');
      }
      return [];
    }

    var cards = [];
    var base = getDeckBase(ancestor);
    for (var i = 0; i < OFFER_COUNT; i += 1) {
      var card = DeckManager.drawByWeight(base, RARITY_WEIGHTS);
      if (!card) {
        break;
      }
      cards.push(card);
    }
    return cards;
  }

  /** Builds a friendly reminder about boon pricing */
  function buildPricingNote() {
    return '<span style="color:#ccc;">Costs: Common ' + RARITY_PRICES.C + ' · Greater ' + RARITY_PRICES.G + ' · Signature ' + RARITY_PRICES.S + ' Scrip.</span>';
  }

  /** Offers boon choices to the specified player */
  function offerBoons(playerid, ancestor) {
    StateManager.initPlayer(playerid);

    var name = getPlayerName(playerid);
    var ps = StateManager.getPlayer(playerid);
    var chosenAncestor = ancestor || ps.ancestor_id || 'Default';

    var cards = drawBoons(chosenAncestor);
    if (!cards.length) {
      if (typeof UIManager !== 'undefined' && typeof UIManager.gmLog === 'function') {
        UIManager.gmLog('⚠️ No boon cards were drawn from ' + getDeckBase(chosenAncestor) + '.');
      } else {
        sendChat('Hoard Run', '/w gm ⚠️ No boon cards were drawn from ' + getDeckBase(chosenAncestor) + '.');
      }
      return;
    }

    DeckManager.presentChoices(name, cards, 'chooseboon');

    if (typeof UIManager !== 'undefined' && typeof UIManager.whisper === 'function') {
      UIManager.whisper(name, 'Ancestor Boons', 'Choose one boon from the menu above.<br>' + buildPricingNote());
    } else {
      sendChat('Hoard Run', '/w ' + name + ' Choose one boon from the menu above. ' + buildPricingNote());
    }
  }

  /** Maps deck name into rarity shorthand */
  function getRarityFromDeck(deckName) {
    if (!deckName) {
      return 'C';
    }
    var lower = deckName.toLowerCase();
    if (lower.indexOf('signature') !== -1) {
      return 'S';
    }
    if (lower.indexOf('greater') !== -1) {
      return 'G';
    }
    return 'C';
  }

  /** Attempts to parse ancestor from deck path */
  function getAncestorFromDeck(deckName) {
    if (!deckName) {
      return 'Unknown';
    }
    var parts = deckName.split('.');
    if (parts.length >= 2) {
      return parts[1];
    }
    return deckName;
  }

  /** Handles the player selecting a boon */
  function chooseBoon(playerid, cardId) {
    if (!cardId) {
      return;
    }

    var card = getObj('card', cardId);
    if (!card) {
      if (typeof UIManager !== 'undefined' && typeof UIManager.gmLog === 'function') {
        UIManager.gmLog('BoonManager: Invalid card id ' + cardId + '.');
      } else {
        sendChat('Hoard Run', '/w gm BoonManager: Invalid card id ' + cardId + '.');
      }
      return;
    }

    var deck = getObj('deck', card.get('deckid'));
    var deckName = deck ? deck.get('name') : '';
    var rarity = getRarityFromDeck(deckName);
    var cost = RARITY_PRICES[rarity] || RARITY_PRICES.C;

    if (!StateManager.spendScrip(playerid, cost)) {
      return;
    }

    var ps = StateManager.getPlayer(playerid);
    if (!ps.boons) {
      ps.boons = [];
    }

    ps.boons.push({
      cardId: cardId,
      name: card.get('name'),
      rarity: rarity,
      ancestor: getAncestorFromDeck(deckName),
      acquiredAt: new Date().toISOString(),
      cost: cost
    });

    var playerName = getPlayerName(playerid);
    var rarityLabel = rarity === 'S' ? 'Signature' : (rarity === 'G' ? 'Greater' : 'Common');
    var message = '🌟 You gained <b>' + card.get('name') + '</b> (' + rarityLabel + ') for ' + cost + ' Scrip!';

    if (typeof UIManager !== 'undefined' && typeof UIManager.whisper === 'function') {
      UIManager.whisper(playerName, 'Boon Purchased', message);
    } else {
      sendChat('Hoard Run', '/w ' + playerName + ' ' + message);
    }
  }

  /** Chat command dispatcher */
  function handleChat(msg) {
    if (msg.type !== 'api') {
      return;
    }

    var parts = msg.content.trim().split(/\s+/);
    var command = parts.shift();

    if (command === '!offerboons') {
      var ancestor = parts[0];
      offerBoons(msg.playerid, ancestor);
    }

    if (command === '!chooseboon') {
      var cardId = parts[0];
      chooseBoon(msg.playerid, cardId);
    }
  }

  /** Registers chat listeners */
  function registerCommands() {
    on('chat:message', handleChat);
    if (typeof UIManager !== 'undefined' && typeof UIManager.gmLog === 'function') {
      UIManager.gmLog('BoonManager ready. Use !offerboons [Ancestor] to present choices.');
    } else {
      sendChat('Hoard Run', '/w gm BoonManager ready. Use !offerboons [Ancestor] to present choices.');
    }
  }

  return {
    offerBoons: offerBoons,
    chooseBoon: chooseBoon,
    registerCommands: registerCommands
  };

})();

on('ready', BoonManager.registerCommands);

