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
  var _pendingChoices = {};

  // Canonical ancestor key: matches BoonDataLoader (Azuren, SutraVayla, VladrenMoroi, LianVeilbinder, Morvox, SeraphineEmberwright)
  function canonAncestor(name) {
    // remove all non-alphanumerics, no underscores
    return (name || '').replace(/[^A-Za-z0-9]/g, '');
  }

  /** Returns the Roll20 display name (quoted for whispers) */
  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    if (player) {
      return '"' + player.get('_displayname') + '"';
    }
    return '"Unknown"';
  }

  function pickRarity(weights) {
    var r = Math.random();
    if (r < weights.C) {
      return 'Common';
    }
    if (r < weights.C + weights.G) {
      return 'Greater';
    }
    return 'Signature';
  }

  function drawBoons(ancestor) {
    var decksRoot = (state.HoardRun && state.HoardRun.boons) || {};
    var key = canonAncestor(ancestor);
    var deck = decksRoot[key];
    if (!deck) {
      gmSay('⚠️ No boon deck found for "' + ancestor + '" (key: ' + key + ').');
      return [];
    }
    var pools = {
      Common:    (deck.Common    || []).slice(),
      Greater:   (deck.Greater   || []).slice(),
      Signature: (deck.Signature || []).slice()
    };

    var picks = [];
    for (var i = 0; i < OFFER_COUNT; i += 1) {
      var rarity = pickRarity(RARITY_WEIGHTS);
      var order = rarity === 'Common' ? ['Common', 'Greater', 'Signature']
                 : rarity === 'Greater' ? ['Greater', 'Common', 'Signature']
                 : ['Signature', 'Greater', 'Common'];

      var chosen = null;
      for (var j = 0; j < order.length; j += 1) {
        var pool = pools[order[j]];
        if (pool && pool.length) {
          var idx = Math.floor(Math.random() * pool.length);
          var source = pool.splice(idx, 1)[0];
          if (!source) {
            continue;
          }
          chosen = JSON.parse(JSON.stringify(source));
          chosen._rarity = order[j];
          chosen._rarityCode = order[j].charAt(0);
          chosen._ancestor = key;
          chosen._ancestorName = ancestor;
          chosen.get = function (prop) {
            if (prop === 'name') {
              return this.name;
            }
            if (prop === 'notes') {
              return this.text_in_run || '';
            }
            if (prop === 'gmnotes') {
              return JSON.stringify(this);
            }
            return this[prop];
          };
          break;
        }
      }
      if (!chosen) {
        break;
      }
      picks.push(chosen);
    }
    return picks;
  }

  /** Builds a friendly reminder about boon pricing */
  function buildPricingNote() {
    return '<span style="color:#ccc;">Costs: Common ' + RARITY_PRICES.C + ' · Greater ' + RARITY_PRICES.G + ' · Signature ' + RARITY_PRICES.S + ' Scrip.</span>';
  }

  /** Offers boon choices to the specified player */
  function offerBoons(playerid, ancestorArg) {
    StateManager.initPlayer(playerid);

    var ps = StateManager.getPlayer(playerid) || {};
    var chosenAncestor = ancestorArg && ancestorArg.trim()
        ? ancestorArg.replace(/_/g, ' ')
        : (ps.ancestor_id || (state.HoardRun && state.HoardRun.runFlow && state.HoardRun.runFlow.ancestor) || 'Azuren');

    var cards = drawBoons(chosenAncestor);
    if (!cards.length) {
      gmSay('⚠️ No boon cards were drawn from ' + canonAncestor(chosenAncestor) + '.');
      return;
    }

    _pendingChoices[playerid] = cards;

    var name = getPlayerName(playerid);
    if (DeckManager && DeckManager.presentChoices) {
      DeckManager.presentChoices(name, cards, 'chooseboon');
    } else {
      gmSay('⚠️ DeckManager.presentChoices not available; implement inline rendering here.');
    }

    if (typeof UIManager !== 'undefined' && typeof UIManager.whisper === 'function') {
      UIManager.whisper(name, 'Ancestor Boons', 'Choose one boon from the menu above.<br>' + buildPricingNote());
    } else {
      whisperRaw(name, 'Choose one boon from the menu above. ' + buildPricingNote());
    }
  }

  /** Handles the player selecting a boon */
  function chooseBoon(playerid, cardId) {
    if (!cardId) {
      return;
    }

    var pending = _pendingChoices[playerid] || [];
    var selectedIndex = -1;
    var card = null;

    for (var k = 0; k < pending.length; k += 1) {
      if ((pending[k].id || '') === cardId) {
        selectedIndex = k;
        card = pending[k];
        break;
      }
    }

    if (!card) {
      gmSay('BoonManager: Invalid card id ' + cardId + '.');
      return;
    }

    var rarityName = card._rarity || card.rarity || 'Common';
    var rarityCode = (card._rarityCode || rarityName.charAt(0) || 'C').toUpperCase();
    var cost = RARITY_PRICES[rarityCode] || RARITY_PRICES.C;

    if (!StateManager.spendScrip(playerid, cost)) {
      return;
    }

    pending.splice(selectedIndex, 1);
    if (pending.length) {
      _pendingChoices[playerid] = pending;
    } else {
      delete _pendingChoices[playerid];
    }

    var ps = StateManager.getPlayer(playerid);
    if (!ps.boons) {
      ps.boons = [];
    }

    ps.boons.push({
      cardId: cardId,
      name: card.name,
      rarity: rarityCode,
      ancestor: card._ancestorName || card.ancestor || 'Unknown',
      acquiredAt: new Date().toISOString(),
      cost: cost
    });

    var playerName = getPlayerName(playerid);
    var rarityLabel = rarityCode === 'S' ? 'Signature' : (rarityCode === 'G' ? 'Greater' : 'Common');
    var message = '🌟 You gained <b>' + card.name + '</b> (' + rarityLabel + ') for ' + cost + ' Scrip!';

    if (typeof UIManager !== 'undefined' && typeof UIManager.whisper === 'function') {
      UIManager.whisper(playerName, 'Boon Purchased', message);
    } else {
      whisperRaw(playerName, message);
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
  function register() {
    on('chat:message', handleChat);
  }

  return {
    offerBoons: offerBoons,
    chooseBoon: chooseBoon,
    register: register
  };

})();

  function gmSay(msg) {
    var payload = '/w gm ' + msg;
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say(payload);
    } else {
      sendChat('Hoard Run', payload);
    }
  }

  function whisperRaw(target, msg) {
    var payload = '/w ' + target + ' ' + msg;
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say(payload);
    } else {
      sendChat('Hoard Run', payload);
    }
  }

