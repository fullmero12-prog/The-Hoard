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

  // ------------------------------------------------------------
  // Relic helpers
  // ------------------------------------------------------------

  function deepClone(value) {
    if (value === null || typeof value === 'undefined') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeEffectId(value) {
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    if (typeof value === 'string') {
      var trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return String(value);
  }

  function normalizeRelicLookup(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getRelicCatalog() {
    if (typeof RelicData !== 'undefined' && RelicData && typeof RelicData.getAll === 'function') {
      return RelicData.getAll();
    }

    if (state && state.HoardRun && state.HoardRun.relics) {
      return deepClone(state.HoardRun.relics);
    }

    return [];
  }

  function findRelicByName(name) {
    var search = normalizeRelicLookup(name);
    if (!search) {
      return { relic: null, suggestions: [] };
    }

    var catalog = getRelicCatalog();
    var exact = null;
    var partial = [];
    var searchCompressed = search.replace(/\s+/g, '');

    for (var i = 0; i < catalog.length; i += 1) {
      var entry = catalog[i];
      if (!entry || !entry.name) {
        continue;
      }

      var key = normalizeRelicLookup(entry.name);
      var compressed = key.replace(/\s+/g, '');
      if (key === search || compressed === searchCompressed) {
        exact = entry;
        break;
      }

      if (key.indexOf(search) !== -1 || compressed.indexOf(searchCompressed) !== -1 || search.indexOf(key) !== -1) {
        partial.push(entry);
      }
    }

    if (exact) {
      return { relic: deepClone(exact), suggestions: [] };
    }

    if (partial.length === 1) {
      return { relic: deepClone(partial[0]), suggestions: [] };
    }

    var hints = [];
    for (var p = 0; p < partial.length && hints.length < 5; p += 1) {
      hints.push(partial[p].name);
    }

    return { relic: null, suggestions: hints };
  }

  function buildRelicRecord(entry) {
    if (!entry) {
      return null;
    }

    var payload = deepClone(entry);
    var effectId = payload.effectId || payload.effect_id || payload.id || null;
    effectId = normalizeEffectId(effectId);

    var record = {
      id: payload.id || effectId || payload.name,
      name: payload.name || 'Relic',
      data: payload,
      rarity: payload.rarity || null
    };

    if (effectId) {
      record.effectId = effectId;
    }

    return record;
  }

  function applyRelicEffect(record, playerState, playerid) {
    var result = { applied: false, reason: 'unknown' };

    if (!record || !playerState) {
      result.reason = 'missing_state';
      return result;
    }

    var effectId = normalizeEffectId(record.effectId);
    if (!effectId) {
      result.reason = 'no_effect';
      return result;
    }

    var characterId = playerState.boundCharacterId;
    if (!characterId) {
      result.reason = 'no_character';
      return result;
    }

    if (
      typeof EffectRegistry === 'undefined' ||
      !EffectRegistry ||
      typeof EffectRegistry.get !== 'function'
    ) {
      result.reason = 'missing_registry';
      return result;
    }

    if (
      typeof EffectEngine === 'undefined' ||
      !EffectEngine ||
      typeof EffectEngine.apply !== 'function'
    ) {
      result.reason = 'missing_engine';
      return result;
    }

    var effectDef = EffectRegistry.get(effectId);
    if (!effectDef) {
      result.reason = 'missing_effect';
      return result;
    }

    EffectEngine.apply(characterId, effectDef);
    result.applied = true;
    result.reason = null;
    return result;
  }

  function describeRelicIssue(code) {
    var map = {
      no_effect: 'effectId missing on relic',
      no_character: 'no bound character',
      missing_registry: 'EffectRegistry unavailable',
      missing_engine: 'EffectEngine unavailable',
      missing_effect: 'effect definition not found',
      missing_state: 'player state unavailable'
    };

    return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : 'unknown issue';
  }

  function grantRelicToAll(argString) {
    var raw = (argString || '').trim();
    if (!raw) {
      gmSay('Usage: !giverelic <Relic Name>');
      return;
    }

    if ((raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"') || (raw.charAt(0) === '\'' && raw.charAt(raw.length - 1) === '\'')) {
      raw = raw.slice(1, -1);
    }

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function') {
      gmSay('StateManager unavailable; cannot grant relics.');
      return;
    }

    var lookup = findRelicByName(raw);
    if (!lookup.relic) {
      if (lookup.suggestions && lookup.suggestions.length) {
        gmSay('Relic "' + raw + '" not found. Suggestions: ' + lookup.suggestions.join(', ') + '.');
      } else {
        gmSay('Relic "' + raw + '" not found.');
      }
      return;
    }

    var targets = resolvePlayerTargets('all');
    if (!targets.length) {
      gmSay('No Hoard Run players found. Have players start a run first.');
      return;
    }

    var templateRecord = buildRelicRecord(lookup.relic);
    if (!templateRecord) {
      gmSay('Could not build a relic record for "' + raw + '".');
      return;
    }

    var granted = [];
    var issues = [];
    for (var i = 0; i < targets.length; i += 1) {
      var pid = targets[i];
      var playerState = StateManager.getPlayer(pid);
      if (!playerState) {
        issues.push({ player: pid, reason: 'missing_state' });
        continue;
      }

      if (!playerState.relics || !Array.isArray(playerState.relics)) {
        playerState.relics = [];
      }

      var record = deepClone(templateRecord);
      playerState.relics.push(record);

      var player = typeof getObj === 'function' ? getObj('player', pid) : null;
      var displayName = null;
      try {
        displayName = player ? player.get('_displayname') : null;
      } catch (err) {
        displayName = null;
      }
      var label = displayName || pid;
      granted.push(label);

      var rarityNote = record.rarity ? ' (' + record.rarity + ')' : '';
      whisperPlayer(pid, 'Relic Granted', record.name + rarityNote);

      var effectResult = applyRelicEffect(record, playerState, pid);
      if (!effectResult.applied && effectResult.reason) {
        issues.push({ player: label, reason: effectResult.reason });
      }
    }

    if (granted.length) {
      gmSay('Granted relic "' + templateRecord.name + '" to ' + granted.join(', ') + '.');
    }

    if (issues.length) {
      var parts = [];
      for (var j = 0; j < issues.length; j += 1) {
        var entry = issues[j];
        var name = entry.player || 'Unknown Player';
        var reasonText = describeRelicIssue(entry.reason);
        parts.push(name + ' (' + reasonText + ')');
      }
      gmSay('⚠️ Relic effects not applied for: ' + parts.join('; '));
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
    var effectCleanup = { abilitiesRemoved: 0, macrosRemoved: 0 };
    if (
      typeof EffectEngine !== 'undefined' &&
      EffectEngine &&
      typeof EffectEngine.removeTokenAbilitiesFromRunState === 'function'
    ) {
      effectCleanup = EffectEngine.removeTokenAbilitiesFromRunState();
    }
    var apCleanup = { abilitiesRemoved: 0, attributesRemoved: 0 };
    if (
      typeof SpellbookHelper !== 'undefined' &&
      SpellbookHelper &&
      typeof SpellbookHelper.clearAlwaysPreparedFromRunState === 'function'
    ) {
      // Run this before AncestorKits clears bound character tracking so we still know
      // which sheets need their Always Prepared repeating spell markers cleared.
      apCleanup = SpellbookHelper.clearAlwaysPreparedFromRunState(state.HoardRun);
    }
    if (typeof AncestorKits !== 'undefined' && AncestorKits && typeof AncestorKits.clearAllMirroredAbilities === 'function') {
      AncestorKits.clearAllMirroredAbilities();
    }
    resetHandouts();
    var removedAttrs = purgeHelperAttributes();
    delete state.HoardRun;
    state.HoardRun = { players: {}, version: 'dev' };
    if (typeof RunFlowManager !== 'undefined' && typeof RunFlowManager.resetRunState === 'function') {
      RunFlowManager.resetRunState();
    }
    var suffix = removedAttrs === 1 ? '' : 's';
    var tagSuffix = apCleanup.attributesRemoved === 1 ? '' : 's';
    var effectAbilitySuffix = effectCleanup.abilitiesRemoved === 1 ? '' : 's';
    var macroSuffix = effectCleanup.macrosRemoved === 1 ? '' : 's';
    gmSay(
      '⚙️ HoardRun state has been reset. Removed ' +
        removedAttrs +
        ' hr_* attribute' +
        suffix +
        ', cleaned ' +
        effectCleanup.abilitiesRemoved +
        ' boon/relic ability record' +
        effectAbilitySuffix +
        ', removed ' +
        effectCleanup.macrosRemoved +
        ' boon/relic macro' +
        macroSuffix +
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
      case '!giverelic':
        if (typeof isGM === 'function' && !isGM(msg.playerid)) {
          gmSay('⚠️ Only the GM can grant relics.');
          return;
        }
        grantRelicToAll(argString);
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
    gmSay('🧰 DevTools loaded. Commands: !resetstate, !debugstate, !testshop, !testrelic, !resethandouts, !givecurrency, !giverelic');
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
