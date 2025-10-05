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

  function canonAncestor(name){ return (name||'').replace(/[^A-Za-z0-9]/g,''); }

  function rarityLabel(r){
    return r === 'Signature' ? 'Signature' : (r === 'Greater' ? 'Greater' : 'Common');
  }

  function ensureOffers(){
    if(!state.HoardRun) state.HoardRun = {};
    if(!state.HoardRun.boonOffers) state.HoardRun.boonOffers = {};
    return state.HoardRun.boonOffers;
  }

  // simple panel
  function panel(title, body){
    return '<div style="border:1px solid #444;background:#111;color:#eee;padding:8px;">'
         + '<div style="font-weight:bold;margin-bottom:6px;">'+title+'</div>'+body+'</div>';
  }

  /** Returns the Roll20 display name (quoted for whispers) */
  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    if (player) {
      return '"' + player.get('_displayname') + '"';
    }
    return '"Unknown"';
  }

  function pickRarity(weights){
    var r = Math.random();
    if (r < weights.C) return 'Common';
    if (r < weights.C + weights.G) return 'Greater';
    return 'Signature';
  }

  function drawBoons(ancestor){
    var decksRoot = (state.HoardRun && state.HoardRun.boons) || {};
    var key = canonAncestor(ancestor);
    var deck = decksRoot[key];
    if (!deck){
      gmSay('⚠️ No boon deck found for "' + ancestor + '" (key: ' + key + ').');
      return [];
    }
    var pools = {
      Common:    (deck.Common    || []).slice(),
      Greater:   (deck.Greater   || []).slice(),
      Signature: (deck.Signature || []).slice()
    };

    var picks = [];
    for (var i=0; i<OFFER_COUNT; i++){
      var pref = pickRarity(RARITY_WEIGHTS);
      var order = pref === 'Common' ? ['Common','Greater','Signature']
                : pref === 'Greater' ? ['Greater','Common','Signature']
                : ['Signature','Greater','Common'];
      var chosen=null;
      for (var j=0;j<order.length;j++){
        var pool=pools[order[j]];
        if(pool && pool.length){
          var idx = Math.floor(Math.random()*pool.length);
          chosen = pool.splice(idx,1)[0];
          chosen._rarity = order[j];
          chosen._idx = picks.length; // local index tag
          break;
        }
      }
      if(!chosen) break;
      picks.push(chosen);
    }
    return picks;
  }

  function renderOfferCards(playerName, ancestor, cards, freeMode){
    var items = cards.map(function(c, i){
      var head = '<div style="font-weight:600;color:#fff">'+_.escape(c.name)+'</div>'
               + '<div style="font-size:11px;color:#aaa;margin-bottom:4px;">'+rarityLabel(c._rarity)+'</div>';
      var body = '<div style="color:#ccc;margin-bottom:6px;">'+_.escape(c.text_in_run||'')+'</div>';

      // Prefer UIManager buttons so Roll20 renders proper command links.
      var btn = (typeof UIManager !== 'undefined' && UIManager.buttons)
        ? UIManager.buttons([{ label: 'Choose', command: '!chooseboon ' + i }])
        : '[Choose](!chooseboon ' + i + ')';

      return '<div style="border:1px solid #333;background:#0b0b0b;padding:8px;margin-bottom:8px;">'
           + head + body + btn + '</div>';
    }).join('');

    var html = panel('Ancestor Boons — '+_.escape(ancestor), items);
    if (typeof HRChat !== 'undefined' && HRChat.direct) HRChat.direct(html);
    else sendChat('Hoard Run','/direct '+html);
  }

  /** Offers boon choices to the specified player */
  function offerBoons(playerid, ancestorArg, modeArg) {
    StateManager.initPlayer(playerid);

    var ps = StateManager.getPlayer(playerid) || {};
    var chosenAncestor = ancestorArg && ancestorArg.trim()
        ? ancestorArg.replace(/_/g, ' ')
        : (ps.ancestor_id || (state.HoardRun && state.HoardRun.runFlow && state.HoardRun.runFlow.ancestor) || 'Azuren');

    var freeMode = true;
    if (typeof modeArg === 'string') {
      var m = modeArg.toLowerCase();
      if (m === 'shop' || m === 'paid' || m === 'cost') freeMode = false;
    }

    var cards = drawBoons(chosenAncestor);
    if (!cards.length) {
      gmSay('⚠️ No boon cards were drawn for ' + canonAncestor(chosenAncestor) + '.');
      return;
    }

    var offers = ensureOffers();
    offers[playerid] = { ancestor: chosenAncestor, free: freeMode, cards: cards };

    renderOfferCards(getPlayerName(playerid), chosenAncestor, cards, freeMode);
  }

  /** Handles the player selecting a boon */
  function chooseBoon(playerid, choiceIdx) {
    var offers = ensureOffers();
    var offer = offers[playerid];
    var i = parseInt(choiceIdx,10);

    if (!offer || !offer.cards || isNaN(i) || i<0 || i>=offer.cards.length) {
      gmSay('BoonManager: No active boon offer for you, or invalid choice.');
      return;
    }

    var picked = offer.cards[i];
    var rarity = picked._rarity || 'Common';
    var cost = offer.free ? 0 : (RARITY_PRICES[rarity==='Signature'?'S':(rarity==='Greater'?'G':'C')] || 0);

    if (cost>0 && !StateManager.spendScrip(playerid, cost)) {
      return; // spendScrip already warns
    }

    var ps = StateManager.getPlayer(playerid);
    if (!ps.boons) ps.boons = [];
    ps.boons.push({
      id: picked.id || picked.name,
      name: picked.name,
      rarity: rarity,
      ancestor: offer.ancestor,
      acquiredAt: new Date().toISOString(),
      cost: cost
    });

    delete offers[playerid];

    var playerName = getPlayerName(playerid);
    var label = rarityLabel(rarity);
    var message = '🌟 You gained <b>' + _.escape(picked.name) + '</b> (' + label + ')'
                + (cost>0 ? (' for ' + cost + ' Scrip!') : ' for 0 Scrip (free reward).');

    if (UIManager && UIManager.whisper) UIManager.whisper(playerName, 'Boon Gained', message);
    else whisperRaw(playerName, message);
  }

  /** Chat command dispatcher */
  function handleChat(msg) {
    if (msg.type !== 'api') {
      return;
    }

    var parts = msg.content.trim().split(/\s+/);
    var command = parts.shift();

    if (command === '!offerboons') {
      var ancestor = parts[0];           // optional
      var modeFlag = parts[1] || 'free'; // default end-of-room is free
      offerBoons(msg.playerid, ancestor, modeFlag);
    }

    if (command === '!chooseboon') {
      var idx = parts[0];
      chooseBoon(msg.playerid, idx);
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

