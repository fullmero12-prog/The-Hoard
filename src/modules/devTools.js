// ------------------------------------------------------------
// Dev Tools Module
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides quick GM-only helpers for testing Hoard Run.
//   Lets you wipe saved data, inspect a player's state,
//   or spawn a mock shop without touching the main logic.
// ------------------------------------------------------------

var DevTools = (function () {

  var isRegistered = false;

  function gmSay(msg) {
    var payload = '/w gm ' + msg;
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say(payload);
    } else {
      sendChat('Hoard Run', payload);
    }
  }

  /**
   * Splits a command argument string into tokens while honoring quoted names.
   * @param {string} argString
   * @returns {string[]}
   */
  function tokenizeArgs(argString) {
    var tokens = [];
    if (!argString) {
      return tokens;
    }

    var pattern = /"([^"]+)"|(\S+)/g;
    var match;
    while ((match = pattern.exec(argString)) !== null) {
      tokens.push(match[1] || match[2]);
    }

    return tokens;
  }

  /**
   * Returns all player IDs that currently have Hoard Run state entries.
   * @returns {string[]}
   */
  function getKnownPlayerIds() {
    if (!state.HoardRun || !state.HoardRun.players) {
      return [];
    }

    var roster = [];
    for (var pid in state.HoardRun.players) {
      if (!state.HoardRun.players.hasOwnProperty(pid)) {
        continue;
      }
      roster.push(pid);
    }
    return roster;
  }

  /**
   * Returns the IDs for players currently marked as online in Roll20.
   * @returns {string[]}
   */
  function getOnlinePlayerIds() {
    var online = [];
    if (typeof findObjs !== 'function') {
      return online;
    }

    var players = findObjs({ _type: 'player' }) || [];
    for (var i = 0; i < players.length; i += 1) {
      var player = players[i];
      try {
        if (player.get('online')) {
          online.push(player.id);
        }
      } catch (err) {
        // Ignore sandbox errors when fetching display name / status.
      }
    }
    return online;
  }

  /**
   * Resolves a single target specifier (player name, ID, all, online) into IDs.
   * @param {string} token
   * @returns {string[]}
   */
  function resolvePlayerTargets(token) {
    var resolved = [];
    var seen = {};

    function push(id) {
      if (id && !seen[id]) {
        resolved.push(id);
        seen[id] = true;
      }
    }

    if (!token) {
      return resolved;
    }

    var lowered = token.toLowerCase();
    if (lowered === 'all') {
      var known = getKnownPlayerIds();
      if (!known.length) {
        known = getOnlinePlayerIds();
      }
      for (var k = 0; k < known.length; k += 1) {
        push(known[k]);
      }
      return resolved;
    }

    if (lowered === 'online') {
      var online = getOnlinePlayerIds();
      for (var o = 0; o < online.length; o += 1) {
        push(online[o]);
      }
      return resolved;
    }

    if (state.HoardRun && state.HoardRun.players && state.HoardRun.players[token]) {
      push(token);
      return resolved;
    }

    if (typeof getObj === 'function') {
      var directPlayer = getObj('player', token);
      if (directPlayer) {
        push(token);
        return resolved;
      }
    }

    if (typeof findObjs === 'function') {
      var candidates = findObjs({ _type: 'player' }) || [];
      var normalized = token.replace(/_/g, ' ').toLowerCase();
      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        try {
          var name = String(candidate.get('_displayname') || '').toLowerCase();
          if (name === normalized) {
            push(candidate.id);
            return resolved;
          }
        } catch (err) {
          // continue searching when sandbox properties are unavailable
        }
      }
    }

    return resolved;
  }

  /**
   * Produces a readable label for a currency key.
   * @param {string} key
   * @returns {string}
   */
  function formatCurrencyLabel(key) {
    if (!key) {
      return '';
    }

    if (key === 'fse') {
      return 'FSE';
    }

    if (key === 'rerollTokens') {
      return 'Reroll Tokens';
    }

    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Sends a styled whisper to the targeted player when currencies are granted.
   * @param {string} playerid
   * @param {string} title
   * @param {string} body
   */
  function whisperPlayer(playerid, title, body) {
    if (!playerid) {
      return;
    }

    var player = typeof getObj === 'function' ? getObj('player', playerid) : null;
    var name = player ? player.get('_displayname') : null;
    if (!name) {
      return;
    }

    if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.whisper === 'function') {
      UIManager.whisper(name, title, body);
    } else {
      var payload = '/w "' + name + '" ' + title + ': ' + body;
      sendChat('Hoard Run', payload);
    }
  }

  /**
   * Core implementation for !givecurrency.
   * Parses arguments, resolves targets, updates StateManager, and whispers results.
   * @param {string} argString
   */
  function grantCurrency(argString) {
    var tokens = tokenizeArgs(argString);
    if (tokens.length < 3) {
      gmSay('Usage: !givecurrency <player|"Player Name"|all|online> <scrip|fse|squares|reroll> <amount>');
      return;
    }

    var targetSpec = tokens[0];
    var currencyToken = tokens[1].toLowerCase();
    var amountToken = tokens[2];

    var currencyMap = {
      scrip: 'scrip',
      fse: 'fse',
      square: 'squares',
      squares: 'squares',
      reroll: 'rerollTokens',
      rerolls: 'rerollTokens',
      rerolltoken: 'rerollTokens',
      rerolltokens: 'rerollTokens'
    };

    var currencyKey = currencyMap[currencyToken];
    if (!currencyKey) {
      gmSay('Unknown currency "' + currencyToken + '". Use scrip, fse, squares, or reroll.');
      return;
    }

    var amount = parseInt(amountToken, 10);
    if (isNaN(amount) || amount === 0) {
      gmSay('Provide a non-zero whole number amount to grant.');
      return;
    }

    var specs = targetSpec.split(',');
    var targets = [];
    var seenTargets = {};
    for (var i = 0; i < specs.length; i += 1) {
      var spec = specs[i].trim();
      if (!spec) {
        continue;
      }
      var resolved = resolvePlayerTargets(spec);
      for (var r = 0; r < resolved.length; r += 1) {
        var pid = resolved[r];
        if (!seenTargets[pid]) {
          targets.push(pid);
          seenTargets[pid] = true;
        }
      }
    }

    if (!targets.length) {
      gmSay('No players matched "' + targetSpec + '". Use the Roll20 display name, player ID, all, or online.');
      return;
    }

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.addCurrency !== 'function') {
      gmSay('StateManager unavailable; cannot grant currency.');
      return;
    }

    var summaries = [];
    var currencyLabel = formatCurrencyLabel(currencyKey);
    for (var t = 0; t < targets.length; t += 1) {
      var pid = targets[t];
      StateManager.addCurrency(pid, currencyKey, amount);
      var player = typeof getObj === 'function' ? getObj('player', pid) : null;
      var display = player ? player.get('_displayname') : pid;
      summaries.push(display);

      var body = (amount > 0 ? '+' : '') + amount + ' ' + currencyLabel;
      whisperPlayer(pid, 'GM Gift', body);
    }

    var summary = 'Granted ' + (amount > 0 ? '+' : '') + amount + ' ' + currencyLabel + ' to ' + summaries.join(', ') + '.';
    gmSay(summary);
  }

  /**
   * Remove helper attributes created during Hoard Run sessions.
   * These are namespaced as hr_* and can linger across resets.
   * @return {number} Count of removed attributes.
   */
  function purgeHelperAttributes() {
    if (typeof findObjs !== 'function') {
      gmSay('⚠️ Roll20 object search unavailable; cannot prune helper attributes.');
      return 0;
    }

    var removed = 0;
    var attrs = findObjs({ _type: 'attribute' }) || [];
    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      try {
        var name = (attr && typeof attr.get === 'function') ? attr.get('name') : '';
        if (!name) {
          continue;
        }
        if (String(name).toLowerCase().indexOf('hr_') === 0) {
          attr.remove();
          removed += 1;
        }
      } catch (err) {
        // Swallow errors so a bad attribute does not interrupt the purge.
      }
    }

    return removed;
  }

  /**
   * Reset the entire Hoard Run state.
   * Clears all progress, currencies, boons, etc.
   */
  function resetState() {
    if (
      typeof EffectEngine !== 'undefined' &&
      EffectEngine &&
      typeof EffectEngine.removeTokenAbilitiesFromRunState === 'function'
    ) {
      EffectEngine.removeTokenAbilitiesFromRunState();
    }
    if (typeof AncestorKits !== 'undefined' && AncestorKits && typeof AncestorKits.clearAllMirroredAbilities === 'function') {
      AncestorKits.clearAllMirroredAbilities();
    }
    var apCleanup = { abilitiesRemoved: 0, attributesRemoved: 0 };
    if (
      typeof SpellbookHelper !== 'undefined' &&
      SpellbookHelper &&
      typeof SpellbookHelper.clearAlwaysPreparedFromRunState === 'function'
    ) {
      apCleanup = SpellbookHelper.clearAlwaysPreparedFromRunState(state.HoardRun);
    }
    resetHandouts();
    var removedAttrs = purgeHelperAttributes();
    delete state.HoardRun;
    state.HoardRun = { players: {}, version: 'dev' };
    if (typeof RunFlowManager !== 'undefined' && typeof RunFlowManager.resetRunState === 'function') {
      RunFlowManager.resetRunState();
    }
    var suffix = removedAttrs === 1 ? '' : 's';
    var abilitySuffix = apCleanup.abilitiesRemoved === 1 ? '' : 's';
    var tagSuffix = apCleanup.attributesRemoved === 1 ? '' : 's';
    gmSay(
      '⚙️ HoardRun state has been reset. Removed ' +
        removedAttrs +
        ' hr_* attribute' +
        suffix +
        ', cleared ' +
        apCleanup.abilitiesRemoved +
        ' AP token action' +
        abilitySuffix +
        ' and ' +
        apCleanup.attributesRemoved +
        ' AP spell helper attribute' +
        tagSuffix +
        '.'
    );
  }

  /**
   * Display current state for inspection.
   * Optionally target a specific player by name or ID.
   * Example: !debugstate Zephyr
   */
  function debugState(arg) {
    if (!state.HoardRun) {
      gmSay('No HoardRun state found.');
      return;
    }

    if (arg) {
      var players = findObjs({ _type: 'player' }) || [];
      var lowered = arg.toLowerCase();
      var i;
      for (i = 0; i < players.length; i += 1) {
        var p = players[i];
        var name = String(p.get('displayname') || '').toLowerCase();
        if (name.indexOf(lowered) !== -1 || p.id === arg) {
          var pState = null;
          if (
            typeof StateManager !== 'undefined' &&
            typeof StateManager.getPlayer === 'function'
          ) {
            pState = StateManager.getPlayer(p.id);
          } else if (state.HoardRun && state.HoardRun.players) {
            pState = state.HoardRun.players[p.id] || null;
          }
          gmSay('<pre>' + JSON.stringify(pState, null, 2) + '</pre>');
          return;
        }
      }
      gmSay('No player found matching "' + arg + '".');
    } else {
      gmSay('<pre>' + JSON.stringify(state.HoardRun, null, 2) + '</pre>');
    }
  }

  /**
   * Spawn a mock shop for testing.
   * Uses the current active player if possible.
   * Example: !testshop
   */
  function testShop() {
    var players = (findObjs({ _type: 'player' }) || []).filter(function (p) {
      return p.get('online');
    });
    if (!players.length) {
      gmSay('No online players to test shop.');
      return;
    }

    var player = players[0];
    var playerid = player.id;
    if (typeof ShopManager !== 'undefined' && ShopManager.generateShop) {
      var cards = ShopManager.generateShop(playerid);
      ShopManager.showShop(playerid, cards);
      gmSay('🛒 Test shop generated for ' + player.get('displayname'));
    } else {
      gmSay('⚠️ ShopManager not loaded or invalid.');
    }
  }

  /**
   * Draw a random relic using the current deck plumbing.
   * Helpful for verifying that the DeckManager fallback data
   * lines up with the Roll20 card decks.
   */
  function testRelicDraw() {
    if (typeof DeckManager === 'undefined' || typeof DeckManager.drawByRarity !== 'function') {
      gmSay('⚠️ DeckManager not available for relic draw test.');
      return;
    }

    var rarities = ['Common', 'Greater', 'Signature'];
    var index = randomInteger(rarities.length) - 1;
    var rarity = rarities[index];
    var relic = DeckManager.drawByRarity('Relics', rarity);

    if (!relic) {
      gmSay('⚠️ No relic available for rarity ' + rarity + '.');
      return;
    }

    var name = typeof relic.get === 'function' ? relic.get('name') : relic.name;
    gmSay('Drew a ' + rarity + ' relic: ' + name);
  }

  /**
   * Remove Hoard Run generated handouts.
   * Cleans out relic/boon entries and kit packets so resets start fresh.
   */
  function resetHandouts() {
    if (typeof findObjs !== 'function') {
      gmSay('⚠️ Roll20 object search unavailable; cannot reset handouts.');
      return;
    }

    var tracked = {};
    var players = state.HoardRun && state.HoardRun.players ? state.HoardRun.players : null;
    var pools = ['relics', 'boons', 'upgrades'];

    if (players) {
      for (var pid in players) {
        if (!players.hasOwnProperty(pid)) {
          continue;
        }
        var player = players[pid] || {};
        for (var p = 0; p < pools.length; p += 1) {
          var key = pools[p];
          var list = player[key];
          if (!list || !list.length) {
            continue;
          }
          for (var i = 0; i < list.length; i += 1) {
            var entry = list[i];
            if (entry && entry.handoutId) {
              tracked[entry.handoutId] = true;
              delete entry.handoutId;
            }
          }
        }
      }
    }

    function normalizeForSearch(text) {
      if (!text) {
        return '';
      }
      var normalized = String(text).toLowerCase();
      normalized = normalized.replace(/&#\d+;/g, ' ');
      normalized = normalized.replace(/&[a-z]+;/g, ' ');
      normalized = normalized.replace(/[\u2013\u2014]/g, '-');
      normalized = normalized.replace(/[^a-z0-9\s\.-]+/g, ' ');
      normalized = normalized.replace(/\s+/g, ' ');
      return normalized.trim();
    }

    function hasAutoFooter(text) {
      var normalized = normalizeForSearch(text);
      if (!normalized) {
        return false;
      }

      // Roll20 exports hyphenate "Auto-generated" depending on formatting,
      // so strip hyphens to catch either spelling.
      var normalizedNoHyphen = normalized.replace(/-/g, ' ');

      if (
        normalized.indexOf('auto-generated by hoard run') !== -1 ||
        normalizedNoHyphen.indexOf('auto generated by hoard run') !== -1
      ) {
        return true;
      }
      if (
        normalized.indexOf('auto-generated by the hoard') !== -1 ||
        normalizedNoHyphen.indexOf('auto generated by the hoard') !== -1
      ) {
        return true;
      }
      if (
        normalized.indexOf('auto-generated hoard run') !== -1 ||
        normalizedNoHyphen.indexOf('auto generated hoard run') !== -1
      ) {
        return true;
      }
      return false;
    }

    function isAncestorKitHandout(nameText, notesText) {
      var normalizedName = normalizeForSearch(nameText);
      var normalizedNotes = normalizeForSearch(notesText);
      if (!normalizedName || normalizedName.indexOf(' kit ') === -1) {
        return false;
      }
      if (normalizedNotes.indexOf('crimson pact') !== -1) {
        return true;
      }
      if (normalizedNotes.indexOf('ancestor') !== -1) {
        return true;
      }
      return false;
    }

    function decodeHandoutField(text) {
      if (!text) {
        return '';
      }

      var decoded = String(text);

      // gmnotes often return base64 blobs; try to decode but fall back if invalid.
      if (
        typeof atob === 'function' &&
        decoded.length % 4 === 0 &&
        /^[A-Za-z0-9+/=]+$/.test(decoded)
      ) {
        try {
          decoded = atob(decoded);
        } catch (err) {}
      }

      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {}

      return decoded;
    }

    var removed = 0;
    var handouts = findObjs({ _type: 'handout' }) || [];

    function processHandout(index) {
      if (index >= handouts.length) {
        var suffix = removed === 1 ? '' : 's';
        gmSay('🗑️ Removed ' + removed + ' Hoard Run handout' + suffix + '.');
        return;
      }

      var handout = handouts[index];
      if (!handout) {
        processHandout(index + 1);
        return;
      }

      var id = handout.id;
      var name = handout.get('name') || '';
      var notesLoaded = false;
      var gmNotesLoaded = false;
      var notesText = '';
      var gmnotesText = '';

      function finalize() {
        if (!notesLoaded || !gmNotesLoaded) {
          return;
        }

        var shouldRemove = false;

        if (tracked[id]) {
          shouldRemove = true;
        }

        if (!shouldRemove && (hasAutoFooter(notesText) || hasAutoFooter(gmnotesText))) {
          shouldRemove = true;
        }

        if (!shouldRemove && isAncestorKitHandout(name, notesText)) {
          shouldRemove = true;
        }

        if (shouldRemove) {
          handout.remove();
          removed += 1;
        }

        processHandout(index + 1);
      }

      function safeGet(prop, done) {
        if (!handout || typeof handout.get !== 'function') {
          done('');
          return;
        }

        if (prop === 'notes' || prop === 'gmnotes') {
          try {
            var didCallback = false;
            var direct = handout.get(prop, function (value) {
              didCallback = true;
              done(value || '');
            });

            if (didCallback) {
              return;
            }

            if (typeof direct !== 'undefined' && direct !== null) {
              done(direct || '');
              return;
            }
          } catch (err) {}

          try {
            done(handout.get(prop) || '');
            return;
          } catch (syncErr) {}

          done('');
          return;
        }

        try {
          done(handout.get(prop) || '');
        } catch (e) {
          done('');
        }
      }

      safeGet('notes', function (value) {
        notesText = decodeHandoutField(value);
        notesLoaded = true;
        finalize();
      });

      safeGet('gmnotes', function (value) {
        gmnotesText = decodeHandoutField(value);
        gmNotesLoaded = true;
        finalize();
      });
    }

    processHandout(0);
  }

  /**
   * Command router
   */
  function handleInput(msg) {
    if (msg.type !== 'api') {
      return;
    }

    var content = (msg.content || '').trim();
    if (!content) {
      return;
    }

    var spaceIdx = content.indexOf(' ');
    var command = spaceIdx === -1 ? content : content.slice(0, spaceIdx);
    var argString = spaceIdx === -1 ? '' : content.slice(spaceIdx + 1).trim();

    switch (command) {
      case '!resetstate':
        resetState();
        break;
      case '!debugstate':
        debugState(argString);
        break;
      case '!testshop':
        testShop();
        break;
      case '!testrelic':
        testRelicDraw();
        break;
      case '!resethandouts':
        resetHandouts();
        break;
      case '!givecurrency':
        if (typeof isGM === 'function' && !isGM(msg.playerid)) {
          gmSay('⚠️ Only the GM can grant currencies.');
          return;
        }
        grantCurrency(argString);
        break;
    }
  }

  /**
   * Register event listeners.
   */
  function register() {
    if (isRegistered) {
      return;
    }
    on('chat:message', handleInput);
    gmSay('🧰 DevTools loaded. Commands: !resetstate, !debugstate, !testshop, !testrelic, !resethandouts, !givecurrency');
    isRegistered = true;
  }

  return {
    register: register,
    resetState: resetState,
    debugState: debugState,
    testShop: testShop,
    testRelicDraw: testRelicDraw,
    resetHandouts: resetHandouts
  };
})();
