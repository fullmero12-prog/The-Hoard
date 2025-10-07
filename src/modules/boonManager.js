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

  // --- config
  var RARITY_WEIGHTS = { C: 0.45, G: 0.40, S: 0.15 };
  var RARITY_PRICES  = { C: 35,  G: 55,   S: 90   };
  var OFFER_COUNT = 3;

  // --- utilities
  function canonAncestor(name) {
    return (name || '').replace(/[^A-Za-z0-9]/g, '');
  }

  function resolveDeckKey(ancestor) {
    var fallback = canonAncestor(ancestor);

    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry) {
      if (typeof AncestorRegistry.get === 'function') {
        var entry = AncestorRegistry.get(ancestor) || AncestorRegistry.get(fallback);
        if (entry) {
          if (entry.boonKey) {
            return entry.boonKey;
          }
          if (entry.displayName) {
            return canonAncestor(entry.displayName);
          }
        }
      }
    }

    return fallback;
  }

  function findDeckEntry(decks, key) {
    if (!decks || !key) {
      return null;
    }

    if (decks[key]) {
      return { name: key, deck: decks[key] };
    }

    var lower = String(key).toLowerCase();
    for (var k in decks) {
      if (!decks.hasOwnProperty(k)) {
        continue;
      }
      if (String(k).toLowerCase() === lower) {
        return { name: k, deck: decks[k] };
      }
    }

    return null;
  }

  function ensureDeckCache(preferredKey) {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }

    var decks = state.HoardRun.boons;
    var needsReload = !decks;
    if (!needsReload) {
      var hasAny = false;
      for (var existingKey in decks) {
        if (decks.hasOwnProperty(existingKey)) {
          hasAny = true;
          break;
        }
      }
      needsReload = !hasAny;
    }
    if (!needsReload && preferredKey) {
      needsReload = !findDeckEntry(decks, preferredKey);
    }

    if (needsReload && typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getBoonDecks === 'function') {
      decks = AncestorRegistry.getBoonDecks() || {};
      state.HoardRun.boons = decks;
      var count = 0;
      for (var key in decks) {
        if (decks.hasOwnProperty(key)) {
          count += 1;
        }
      }
      log('[BoonManager] Rebuilt boon deck cache from registry (' + count + ' ancestors).');
    }

    state.HoardRun.boons = decks || {};
    return state.HoardRun.boons;
  }

  function rarityLabel(r) {
    return r === 'Signature' ? 'Signature' : (r === 'Greater' ? 'Greater' : 'Common');
  }

  function ensureOffers() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }
    if (!state.HoardRun.boonOffers) {
      state.HoardRun.boonOffers = {};
    }
    return state.HoardRun.boonOffers;
  }

  function ensureBoonHistory() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }
    if (!state.HoardRun.boonHistory) {
      state.HoardRun.boonHistory = {};
    }
    return state.HoardRun.boonHistory;
  }

  function getPlayerHistory(playerid) {
    var root = ensureBoonHistory();
    if (!root[playerid]) {
      root[playerid] = [];
    }
    return root[playerid];
  }

  function rarityKey(value) {
    var text = String(value || '').toLowerCase();
    if (text === 'c') { return 'common'; }
    if (text === 'g') { return 'greater'; }
    if (text === 's') { return 'signature'; }
    return text;
  }

  function cardKey(card) {
    if (!card) {
      return '';
    }
    var base = card.id || card.cardId || card._id || card.name || '';
    return String(base).toLowerCase();
  }

  function historyKey(card) {
    var base = cardKey(card);
    var rare = rarityKey(card && (card._rarity || card.rarity || ''));
    return base + '|' + rare;
  }

  function buildOwnedBoonMap(playerid) {
    var ownedMap = {};

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function') {
      return ownedMap;
    }

    var ps = StateManager.getPlayer(playerid);
    if (!ps || !ps.boons || !ps.boons.length) {
      return ownedMap;
    }

    for (var i = 0; i < ps.boons.length; i++) {
      var boon = ps.boons[i];
      if (!boon) {
        continue;
      }

      var rarity = rarityKey(boon.rarity || '');

      var id = String(boon.id || '').toLowerCase();
      if (id) {
        ownedMap[id + '|' + rarity] = true;
      }

      // Record multiple identifiers so shop-purchased cards (Roll20 deck IDs)
      // and catalog entries (static slug IDs) both get recognized.
      var slug = '';
      if (boon.data && boon.data.id) {
        slug = String(boon.data.id).toLowerCase();
      }

      if (!slug) {
        slug = String(boon.name || '').toLowerCase();
      }

      if (slug) {
        ownedMap[slug + '|' + rarity] = true;
      }

      if (!rarity) {
        var bases = [id, slug];
        for (var j = 0; j < bases.length; j++) {
          var base = bases[j];
          if (!base) {
            continue;
          }
          ownedMap[base + '|common'] = true;
          ownedMap[base + '|greater'] = true;
          ownedMap[base + '|signature'] = true;
        }
      }
    }

    return ownedMap;
  }

  function rememberHistory(playerid, cards) {
    var history = getPlayerHistory(playerid);
    var limit = 24;
    (cards || []).forEach(function (card) {
      if (!card) {
        return;
      }
      var key = historyKey(card);
      if (!key) {
        return;
      }
      if (history.indexOf(key) === -1) {
        history.push(key);
      }
    });
    while (history.length > limit) {
      history.shift();
    }
  }

  function buildIndexOrder(length) {
    var indices = [];
    for (var i = 0; i < length; i++) {
      indices.push(i);
    }
    for (var j = indices.length - 1; j > 0; j--) {
      var swap = Math.floor(Math.random() * (j + 1));
      var tmp = indices[j];
      indices[j] = indices[swap];
      indices[swap] = tmp;
    }
    return indices;
  }

  function pickFromPool(pool, rarity, seen, banned) {
    if (!pool || !pool.length) {
      return null;
    }

    var order = buildIndexOrder(pool.length);
    var fallback = null;
    for (var i = 0; i < order.length; i++) {
      var idx = order[i];
      var candidate = pool[idx];
      var key = cardKey(candidate);
      var rarityTag = rarityKey(candidate && (candidate._rarity || candidate.rarity || rarity));
      var combined = key + '|' + rarityTag;

      if (banned && banned[combined]) {
        continue;
      }

      if (!seen[combined]) {
        pool.splice(idx, 1);
        seen[combined] = true;
        return candidate;
      }

      if (!fallback) {
        fallback = { index: idx, key: combined, card: candidate };
      }
    }

    if (fallback) {
      pool.splice(fallback.index, 1);
      seen[fallback.key] = true;
      return fallback.card;
    }

    return pool.splice(0, 1)[0] || null;
  }

  function getPlayerName(playerid) {
    var p = getObj('player', playerid);
    return p ? '"' + p.get('_displayname') + '"' : '"Unknown"';
  }

  // --- text formatting (escape, then restore **bold**)
  function mdInline(s) {
    if (!s) {
      return '';
    }
    var esc = _.escape(s);
    return esc.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  }

  function ensureListIncludes(list, value) {
    var entries = (list || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    if (entries.indexOf(value) === -1) {
      entries.push(value);
    }
    return entries.join(',');
  }

  function grantHandoutAccess(handout, playerid) {
    if (!handout || !playerid) {
      return;
    }

    var journals = handout.get('inplayerjournals');
    if (journals !== 'all') {
      handout.set('inplayerjournals', ensureListIncludes(journals, playerid));
    }

    var control = handout.get('controlledby');
    if (control !== 'all') {
      handout.set('controlledby', ensureListIncludes(control, playerid));
    }
  }

  function htmlEscape(text) {
    if (!text) {
      return '';
    }
    if (typeof _ !== 'undefined' && _.escape) {
      return _.escape(text);
    }
    return String(text);
  }

  function normalizeDescription(text) {
    if (!text) {
      return '';
    }
    return htmlEscape(text).replace(/\r?\n/g, '<br>');
  }

  function ensureBoonHandout(playerid, card, ancestor) {
    if (!card || !card.name) {
      return;
    }

    var title = card.name;
    var handout = findObjs({ _type: 'handout', name: title })[0];
    if (!handout) {
      handout = createObj('handout', {
        name: title,
        archived: false,
        inplayerjournals: '',
        controlledby: ''
      });
    }

    var rarity = card._rarity || card.rarity || '';
    var description = card.text_in_run || card.description || card.text || '';

    if (description) {
      if (rarity.length === 1) {
        if (rarity === 'C') rarity = 'Common';
        else if (rarity === 'G') rarity = 'Greater';
        else if (rarity === 'S') rarity = 'Signature';
      }
      var rarityText = rarity ? rarityLabel(rarity) : '';
      var parts = [];
      parts.push('<div style="font-family:inherit;font-size:13px;line-height:1.3;">');
      parts.push('<h3 style="margin:0 0 6px 0;">' + htmlEscape(title) + (rarityText ? ' <span style="font-size:11px;font-weight:600;opacity:0.75;">(' + htmlEscape(rarityText) + ')</span>' : '') + '</h3>');
      if (ancestor) {
        parts.push('<div style="font-size:11px;opacity:0.75;margin-bottom:4px;">Ancestor: ' + htmlEscape(ancestor) + '</div>');
      }
      parts.push('<div style="margin-bottom:8px;">' + normalizeDescription(description) + '</div>');
      parts.push('<div style="font-size:10px;opacity:0.6;">Auto-generated by Hoard Run.</div>');
      parts.push('</div>');
      handout.set('notes', parts.join(''));
    }

    grantHandoutAccess(handout, playerid);
  }

  // --- rarity styles (card colors)
  function rarityStyle(r) {
    var map = {
      Common:    { bg: '#0f2d1f', fg: '#e7fff1', br: '#1f6844', badgeBg: '#1aa567' },
      Greater:   { bg: '#0e2140', fg: '#e6f2ff', br: '#1d4e89', badgeBg: '#2a7bdc' },
      Signature: { bg: '#3b2208', fg: '#fff2e0', br: '#7a4513', badgeBg: '#ff8a00' }
    };
    return map[r] || map.Common;
  }

  // --- single boon card
  function cardHTML(c, i) {
    var rarity  = c._rarity || 'Common';
    var style = rarityStyle(rarity);

    var head =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
        '<div style="font-weight:700;font-size:14px;line-height:1.2;color:' + style.fg + '">' + _.escape(c.name) + '</div>' +
        '<span style="padding:2px 6px;border-radius:6px;font-size:11px;font-weight:700;background:' + style.badgeBg + ';color:#fff;">' +
          _.escape(rarity) +
        '</span>' +
      '</div>';

    var body = '<div style="color:' + style.fg + ';opacity:0.95;line-height:1.25;margin:6px 0 10px 0;">'
             + mdInline(c.text_in_run || '') + '</div>';

    var button = (UIManager && UIManager.buttons)
      ? UIManager.buttons([{ label: 'Choose', command: '!chooseboon ' + i }])
      : '[Choose](!chooseboon ' + i + ')';

    return '<div style="border:1px solid ' + style.br + ';background:' + style.bg + ';padding:10px 10px 12px;border-radius:8px;margin:10px 0;">'
         + head + body + button + '</div>';
  }

  // --- render full offer
  function renderOfferCards(playerName, ancestor, cards, freeMode) {
    var title   = 'Ancestor Boons — ' + _.escape(ancestor);
    var content = cards.map(cardHTML).join('');

    if (!freeMode) {
      content = '<div style="margin-bottom:6px;font-size:11px;opacity:0.85;">Scrip cost applies when you confirm a boon.</div>' + content;
    }

    if (UIManager && UIManager.whisper) {
      // IMPORTANT: do not escape content here; buttons must remain raw.
      UIManager.whisper(playerName, title, content);
      return;
    }

    var shell = (UIManager && UIManager.panel)
      ? UIManager.panel(title, content)
      : '<div style="border:1px solid #444;background:#111;color:#eee;padding:8px;">'
          + '<div style="font-weight:bold;margin-bottom:6px;">' + title + '</div>' + content + '</div>';

    sendChat('Hoard Run', '/w ' + playerName + ' ' + shell);
  }

  // --- weighted draw helpers
  function pickRarity(weights) {
    var roll = Math.random();
    if (roll < weights.C) return 'Common';
    if (roll < weights.C + weights.G) return 'Greater';
    return 'Signature';
  }

  function drawBoons(playerid, ancestor, historyList) {
    var canonicalKey = canonAncestor(ancestor);
    var resolvedKey = resolveDeckKey(ancestor);
    var preferredKey = resolvedKey || canonicalKey;

    var decksRoot = ensureDeckCache(preferredKey);
    var deckInfo = findDeckEntry(decksRoot, preferredKey);

    if (!deckInfo && preferredKey !== canonicalKey) {
      deckInfo = findDeckEntry(decksRoot, canonicalKey);
    }

    if (!deckInfo) {
      var message = '⚠️ No boon deck found for "' + ancestor + '" (key: ' + canonicalKey + ')';
      if (preferredKey && preferredKey !== canonicalKey) {
        message += '; attempted resolved key: ' + preferredKey;
      }
      gmSay(message + '.');
      return [];
    }

    var deck = deckInfo.deck;

    var pools = {
      Common:    (deck.Common    || []).slice(),
      Greater:   (deck.Greater   || []).slice(),
      Signature: (deck.Signature || []).slice()
    };

    var bannedMap = {};
    (historyList || []).forEach(function (entry) {
      bannedMap[entry] = true;
    });

    var ownedMap = buildOwnedBoonMap(playerid);
    for (var ownedKey in ownedMap) {
      if (ownedMap.hasOwnProperty(ownedKey)) {
        bannedMap[ownedKey] = true;
      }
    }

    var seen = {};
    var picks = [];
    for (var i = 0; i < OFFER_COUNT; i++) {
      var preferred = pickRarity(RARITY_WEIGHTS);
      var order = preferred === 'Common' ? ['Common', 'Greater', 'Signature']
                : preferred === 'Greater' ? ['Greater', 'Common', 'Signature']
                : ['Signature', 'Greater', 'Common'];

      var chosen = null;
      for (var j = 0; j < order.length; j++) {
        var pool = pools[order[j]];
        if (pool && pool.length) {
          chosen = pickFromPool(pool, order[j], seen, bannedMap);
          if (chosen) {
            chosen._rarity = order[j];
            chosen._idx = picks.length;
            break;
          }
        }
      }

      if (!chosen) {
        break;
      }
      picks.push(chosen);
    }

    rememberHistory(playerid, picks);
    return picks;
  }

  // --- public actions
  /** Offers boon choices to the specified player */
  function offerBoons(playerid, ancestorArg, modeArg) {
    StateManager.initPlayer(playerid);

    var ps = StateManager.getPlayer(playerid) || {};
    var chosenAncestor = ancestorArg && ancestorArg.trim()
      ? ancestorArg.replace(/_/g, ' ')
      : (ps.ancestor_id || (state.HoardRun && state.HoardRun.runFlow && state.HoardRun.runFlow.ancestor) || 'Azuren');

    var freeMode = true; // end-of-room default
    if (typeof modeArg === 'string') {
      var m = modeArg.toLowerCase();
      if (m === 'shop' || m === 'paid' || m === 'cost') {
        freeMode = false;
      }
    }

    var history = getPlayerHistory(playerid);
    var cards = drawBoons(playerid, chosenAncestor, history);
    if (!cards.length) {
      gmSay('⚠️ No boon cards were drawn for ' + canonAncestor(chosenAncestor) + '.');
      return;
    }

    ensureOffers()[playerid] = { ancestor: chosenAncestor, free: freeMode, cards: cards };
    renderOfferCards(getPlayerName(playerid), chosenAncestor, cards, freeMode);
  }

  /** Handles the player selecting a boon */
  function chooseBoon(playerid, choiceIdx) {
    var offers = ensureOffers();
    var offer = offers[playerid];
    var index = parseInt(choiceIdx, 10);

    if (!offer || !offer.cards || isNaN(index) || index < 0 || index >= offer.cards.length) {
      gmSay('BoonManager: No active boon offer for you, or invalid choice.');
      return;
    }

    var picked = offer.cards[index];
    var rarity = picked._rarity || 'Common';
    var cost = offer.free ? 0 : (RARITY_PRICES[rarity === 'Signature' ? 'S' : (rarity === 'Greater' ? 'G' : 'C')] || 0);

    if (cost > 0 && !StateManager.spendScrip(playerid, cost)) {
      return;
    }

    var ps = StateManager.getPlayer(playerid);
    if (!ps.boons) {
      ps.boons = [];
    }
    ps.boons.push({
      id: picked.id || picked.name,
      name: picked.name,
      rarity: rarity,
      ancestor: offer.ancestor,
      acquiredAt: new Date().toISOString(),
      cost: cost
    });

    delete offers[playerid];

    rememberHistory(playerid, [picked]);

    ensureBoonHandout(playerid, picked, offer.ancestor);

    var playerName = getPlayerName(playerid);
    var message = '🌟 You gained <b>' + _.escape(picked.name) + '</b> (' + rarityLabel(rarity) + ')';
    if (cost > 0) {
      message += ' for ' + cost + ' Scrip';
    }
    message += '!';

    if (UIManager && UIManager.whisper) {
      UIManager.whisper(playerName, 'Boon Gained', message);
    } else {
      whisperRaw(playerName, message);
    }
  }

  // --- chat commands
  /** Chat command dispatcher */
  function handleChat(msg) {
    if (msg.type !== 'api') {
      return;
    }
    var parts = msg.content.trim().split(/\s+/);
    var command = parts.shift();

    if (command === '!offerboons') {
      var ancestor = parts[0];
      var modeFlag = parts[1] || 'free';
      offerBoons(msg.playerid, ancestor, modeFlag);
    }
    if (command === '!chooseboon') {
      chooseBoon(msg.playerid, parts[0]);
    }
  }

  /** Registers chat listeners */
  function register() {
    on('chat:message', handleChat);
  }

  return {
    offerBoons: offerBoons,
    chooseBoon: chooseBoon,
    ensureDeckCache: ensureDeckCache,
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

