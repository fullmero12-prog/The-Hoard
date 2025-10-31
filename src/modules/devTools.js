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
   * Escapes text for safe inclusion in Roll20 chat HTML snippets.
   * @param {string} text
   * @returns {string}
   */
  function htmlEscape(text) {
    if (text === null || typeof text === 'undefined') {
      return '';
    }

    var str = String(text);
    if (typeof _ !== 'undefined' && _.escape) {
      return _.escape(str);
    }

    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
   * Dumps repeating inventory rows (name, RowID, equipped flag, modifiers) for the selected token.
   * @param {object} msg
   */
  function dumpInventoryModifiers(msg) {
    if (!msg || !msg.selected || !msg.selected.length) {
      gmSay('⚠️ Select a token linked to the character before running <b>!mods-dump</b>.');
      return;
    }

    var sel = msg.selected[0];
    var token = sel && typeof getObj === 'function' ? getObj('graphic', sel._id) : null;
    if (!token) {
      gmSay('⚠️ Select a token linked to the character before running <b>!mods-dump</b>.');
      return;
    }

    var characterId = token.get('represents');
    if (!characterId) {
      gmSay('⚠️ The selected token is not linked to a character.');
      return;
    }

    var attrs = typeof findObjs === 'function' ? findObjs({ _type: 'attribute', _characterid: characterId }) || [] : [];
    var rows = {};
    var order = [];

    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var name = attr.get('name');
      var match = /^repeating_inventory_([-A-Za-z0-9]+)_(itemname|equipped|itemmodifiers)$/.exec(name);
      if (!match) {
        continue;
      }

      var rowId = match[1];
      var field = match[2];
      if (!rows[rowId]) {
        rows[rowId] = { name: '', eq: '', mods: '' };
        order.push(rowId);
      }

      var current = attr.get('current') || '';
      if (field === 'itemname') {
        rows[rowId].name = current;
      } else if (field === 'equipped') {
        rows[rowId].eq = current;
      } else if (field === 'itemmodifiers') {
        rows[rowId].mods = current;
      }
    }

    if (!order.length) {
      gmSay('ℹ️ No repeating inventory rows found on the linked character.');
      return;
    }

    var lines = ['<b>Inventory rows</b>'];
    for (var r = 0; r < order.length; r += 1) {
      var id = order[r];
      var row = rows[id];
      var equipped = row.eq === '1' ? '[E] ' : '[ ] ';
      lines.push(
        equipped +
          htmlEscape(row.name) +
          ' — RowID:' +
          id +
          ' — MODS: ' +
          htmlEscape(row.mods)
      );
    }

    gmSay(lines.join('<br>'));
  }

  /**
   * Determines whether a Roll20 checkbox style field is considered enabled.
   * Accepts values such as "on", "1", "yes", or "true".
   * @param {string} value
   * @returns {boolean}
   */
  function isChecked(value) {
    if (value === null || typeof value === 'undefined') {
      return false;
    }

    var lowered = String(value).toLowerCase();
    return lowered === 'on' || lowered === '1' || lowered === 'true' || lowered === 'yes';
  }

  /**
   * Produces a readable label for a spell repeating section.
   * @param {string} section
   * @param {string} levelField
   * @returns {{label:string, order:number}}
   */
  function describeSpellSection(section, levelField) {
    var label = section || 'spells';
    var order = 100;

    if (!section) {
      return { label: label, order: order };
    }

    if (section === 'spell-cantrip') {
      return { label: 'Cantrips', order: -1 };
    }

    var matchLevel = /^spell-(\d+)$/.exec(section);
    if (matchLevel) {
      var parsed = parseInt(matchLevel[1], 10);
      if (!isNaN(parsed)) {
        return { label: 'Level ' + parsed, order: parsed };
      }
    }

    if (levelField) {
      var parsedLevel = parseInt(levelField, 10);
      if (!isNaN(parsedLevel)) {
        label = 'Level ' + parsedLevel;
        order = parsedLevel;
      }
    }

    if (section.indexOf('npc') !== -1) {
      return { label: 'NPC ' + section.replace('spell', '').replace(/[-_]+/g, ' ').trim(), order: 75 };
    }

    return { label: label, order: order };
  }

  /**
   * Gathers repeating spell rows for a character.
   * @param {string} characterId
   * @returns {Array}
   */
  function collectSpellRows(characterId) {
    if (!characterId || typeof findObjs !== 'function') {
      return [];
    }

    var attrs = findObjs({ _type: 'attribute', _characterid: characterId }) || [];
    var rowsById = {};
    var seenOrder = [];
    var apTags = {};
    var i;

    for (i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var attrName = '';
      try {
        attrName = attr && typeof attr.get === 'function' ? attr.get('name') : '';
      } catch (attrErr) {
        attrName = '';
      }

      if (!attrName) {
        continue;
      }

      if (attrName.indexOf('hr_apspell_') === 0) {
        try {
          var link = attr.get('current') || attr.get('max') || '';
          if (link) {
            apTags[link] = attrName;
          }
        } catch (linkErr) {
          // Ignore lookup issues for malformed helper attributes.
        }
      }
    }

    for (i = 0; i < attrs.length; i += 1) {
      var attribute = attrs[i];
      var name = '';
      try {
        name = attribute && typeof attribute.get === 'function' ? attribute.get('name') : '';
      } catch (nameErr) {
        name = '';
      }

      if (!name) {
        continue;
      }

      var match = /^repeating_([A-Za-z0-9\-]+)_([-A-Za-z0-9]+)_(spellname|spelllevel|spellprepared|spellalwaysprepared)$/.exec(name);
      if (!match) {
        continue;
      }

      var section = match[1];
      if (section.indexOf('spell') !== 0) {
        continue;
      }

      var rowId = match[2];
      var field = match[3];

      if (!rowsById[rowId]) {
        rowsById[rowId] = {
          section: section,
          rowId: rowId,
          name: '',
          level: '',
          prepared: '',
          always: ''
        };
        seenOrder.push(rowId);
      }

      var current = '';
      try {
        current = attribute.get('current') || '';
      } catch (curErr) {
        current = '';
      }

      if (field === 'spellname') {
        rowsById[rowId].name = current;
      } else if (field === 'spelllevel') {
        rowsById[rowId].level = current;
      } else if (field === 'spellprepared') {
        rowsById[rowId].prepared = current;
      } else if (field === 'spellalwaysprepared') {
        rowsById[rowId].always = current;
      }
    }

    var rows = [];
    for (var r = 0; r < seenOrder.length; r += 1) {
      var id = seenOrder[r];
      var row = rowsById[id];
      if (!row) {
        continue;
      }

      var descriptor = describeSpellSection(row.section, row.level);
      row.sectionLabel = descriptor.label;
      row.sectionOrder = descriptor.order;

      var prefix = 'repeating_' + row.section + '_' + row.rowId + '_';
      if (apTags[prefix]) {
        row.apTag = apTags[prefix];
      }

      rows.push(row);
    }

    rows.sort(function (a, b) {
      if (a.sectionOrder !== b.sectionOrder) {
        return a.sectionOrder - b.sectionOrder;
      }

      var nameA = (a.name || '').toLowerCase();
      var nameB = (b.name || '').toLowerCase();
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }

      if (a.rowId < b.rowId) {
        return -1;
      }
      if (a.rowId > b.rowId) {
        return 1;
      }

      return 0;
    });

    return rows;
  }

  /**
   * Whisper repeating spell rows for targeted players or the selected character.
   * Accepts comma-separated player specifiers (name, ID, all, online) similar to !givecurrency.
   * Falls back to the currently selected token when no specifiers are provided.
   * @param {object} msg
   * @param {string} argString
   */
  function dumpSpellbook(msg, argString) {
    if (typeof findObjs !== 'function') {
      gmSay('⚠️ Roll20 object search unavailable; cannot inspect spellbook rows.');
      return;
    }

    var trimmed = (argString || '').trim();
    var characterTargets = [];
    var seenCharacters = {};
    var missingBindings = [];

    function pushCharacter(charId, label) {
      if (!charId || seenCharacters[charId]) {
        return;
      }
      seenCharacters[charId] = true;
      characterTargets.push({ id: charId, label: label });
    }

    function getCharacterLabel(charId) {
      if (!charId) {
        return 'Unknown Character';
      }
      if (typeof getObj !== 'function') {
        return charId;
      }
      var character = getObj('character', charId);
      try {
        return character ? character.get('name') || charId : charId;
      } catch (labelErr) {
        return charId;
      }
    }

    function getPlayerLabel(playerId) {
      if (!playerId || typeof getObj !== 'function') {
        return playerId || 'Unknown Player';
      }
      var playerObj = getObj('player', playerId);
      try {
        var display = playerObj ? playerObj.get('_displayname') : '';
        return display || playerId;
      } catch (displayErr) {
        return playerId;
      }
    }

    if (trimmed) {
      if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function') {
        gmSay('⚠️ StateManager unavailable; cannot resolve player spellbooks.');
      } else {
        var playerSpecs = trimmed.split(',');
        var seenPlayers = {};
        for (var s = 0; s < playerSpecs.length; s += 1) {
          var spec = playerSpecs[s].trim();
          if (!spec) {
            continue;
          }

          var resolvedPlayers = resolvePlayerTargets(spec);
          for (var rp = 0; rp < resolvedPlayers.length; rp += 1) {
            var pid = resolvedPlayers[rp];
            if (seenPlayers[pid]) {
              continue;
            }
            seenPlayers[pid] = true;

            var playerState = StateManager.getPlayer(pid);
            var charId = playerState && playerState.boundCharacterId ? playerState.boundCharacterId : null;
            if (charId) {
              var label = getCharacterLabel(charId) + ' (' + getPlayerLabel(pid) + ')';
              pushCharacter(charId, label);
            } else {
              missingBindings.push(getPlayerLabel(pid));
            }
          }
        }
      }
    }

    if (!characterTargets.length && msg && msg.selected && msg.selected.length) {
      for (var selIndex = 0; selIndex < msg.selected.length; selIndex += 1) {
        var selection = msg.selected[selIndex];
        if (!selection || selection._type !== 'graphic') {
          continue;
        }
        if (typeof getObj !== 'function') {
          continue;
        }
        var token = getObj('graphic', selection._id);
        if (!token) {
          continue;
        }
        var charIdFromToken = token.get('represents');
        if (!charIdFromToken) {
          continue;
        }
        pushCharacter(charIdFromToken, getCharacterLabel(charIdFromToken));
      }
    }

    if (!characterTargets.length) {
      gmSay('Usage: !spells-dump <player|"Player Name"|all|online> — or select a token linked to the character first.');
      return;
    }

    if (missingBindings.length) {
      gmSay('ℹ️ No bound character for: ' + missingBindings.join(', ') + '.');
    }

    for (var t = 0; t < characterTargets.length; t += 1) {
      var target = characterTargets[t];
      var spellRows = collectSpellRows(target.id);
      var headerLabel = target.label || getCharacterLabel(target.id);

      if (!spellRows.length) {
        gmSay('ℹ️ No repeating spell rows found for ' + htmlEscape(headerLabel) + '.');
        continue;
      }

      var lines = ['<b>Spell rows — ' + htmlEscape(headerLabel) + '</b>'];
      for (var rowIndex = 0; rowIndex < spellRows.length; rowIndex += 1) {
        var row = spellRows[rowIndex];
        var flags = [];
        if (isChecked(row.prepared)) {
          flags.push('Prep');
        }
        if (isChecked(row.always)) {
          flags.push('Always');
        }

        var labelParts = [row.sectionLabel || 'Spells'];
        var flagText = flags.length ? ' | ' + flags.join(', ') : '';
        var prefixText = '[' + labelParts.join('') + flagText + '] ';
        var line = prefixText + htmlEscape(row.name || '(Unnamed Spell)') + ' — RowID: ' + row.rowId;
        if (row.apTag) {
          line += ' — Tag: ' + htmlEscape(row.apTag);
        }
        lines.push(line);
      }

      gmSay(lines.join('<br>'));
    }
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

  function describeRelicIssue(code) {
    var map = {
      missing_payload: 'adapter payload unavailable',
      adapter_unavailable: 'effect adapter helper missing',
      adapter_failed: 'adapter could not apply inventory or ability',
      inventory_failed: 'inventory row failed to sync',
      ability_failed: 'token action failed to create',
      no_character: 'no bound character',
      missing_state: 'player state unavailable',
      relic_pipeline_pending: 'relic-item pipeline offline (apply manually)',
      missing_character: 'no bound character',
      binder_failed: 'relic binder could not sync the sheet',
      binder_unavailable: 'relic binder unavailable',
      state_unavailable: 'state manager unavailable',
      manager_unavailable: 'relic manager unavailable',
      missing_relic: 'relic id missing',
      missing_target: 'no target specified',
      no_effect: 'no state or sheet change recorded',
      not_found: 'relic not found',
      already_owned: 'already owned',
      unknown_issue: 'unknown issue'
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

    var granted = [];
    var alreadyOwned = [];
    var issues = [];
    var warnings = [];
    var relicName = lookup.relic && lookup.relic.name ? lookup.relic.name : raw;
    var relicId = lookup.relic && (lookup.relic.id || lookup.relic.name) ? (lookup.relic.id || lookup.relic.name) : raw;
    var relicRarity = lookup.relic && lookup.relic.rarity ? lookup.relic.rarity : null;

    for (var i = 0; i < targets.length; i += 1) {
      var pid = targets[i];
      var playerState = StateManager.getPlayer(pid);
      if (!playerState) {
        issues.push({ player: pid, reason: 'missing_state' });
        continue;
      }

      var player = typeof getObj === 'function' ? getObj('player', pid) : null;
      var displayName = null;
      try {
        displayName = player ? player.get('_displayname') : null;
      } catch (err) {
        displayName = null;
      }
      var label = displayName || pid;

      var characterId = playerState.boundCharacterId || null;
      var grantResult = null;

      if (typeof RelicItemManager !== 'undefined' && RelicItemManager && typeof RelicItemManager.grantRelic === 'function') {
        grantResult = RelicItemManager.grantRelic({
          playerId: pid,
          characterId: characterId,
          relicId: relicId,
          displayName: relicName
        });
      } else {
        if (!playerState.relics || !Array.isArray(playerState.relics)) {
          playerState.relics = [];
        }
        var normalizedId = relicId ? String(relicId) : null;
        var exists = false;
        if (normalizedId) {
          for (var r = 0; r < playerState.relics.length; r += 1) {
            if (playerState.relics[r] === normalizedId) {
              exists = true;
              break;
            }
          }
        }
        if (!exists && normalizedId) {
          playerState.relics.push(normalizedId);
          StateManager.setPlayer(pid, playerState);
        }
        grantResult = { ok: !!normalizedId, alreadyOwned: exists, warnings: ['manager_unavailable'], reason: normalizedId ? null : 'missing_relic' };
      }

      if (!grantResult || !grantResult.ok) {
        issues.push({ player: label, reason: grantResult && grantResult.reason ? grantResult.reason : 'unknown_issue' });
        continue;
      }

      if (grantResult.alreadyOwned) {
        alreadyOwned.push(label);
      } else {
        granted.push(label);
      }

      var rarityNote = relicRarity ? ' (' + relicRarity + ')' : '';
      whisperPlayer(pid, 'Relic Granted', relicName + rarityNote);

      var resultWarnings = grantResult.warnings || [];
      for (var w = 0; w < resultWarnings.length; w += 1) {
        warnings.push({ player: label, reason: resultWarnings[w] });
      }
    }

    if (granted.length) {
      gmSay('Granted relic "' + relicName + '" to ' + granted.join(', ') + '.');
    }

    if (alreadyOwned.length) {
      gmSay('ℹ️ Already owned: ' + alreadyOwned.join(', ') + '.');
    }

    if (issues.length) {
      var parts = [];
      for (var j = 0; j < issues.length; j += 1) {
        var entry = issues[j];
        var name = entry.player || 'Unknown Player';
        var reasonText = describeRelicIssue(entry.reason);
        parts.push(name + ' (' + reasonText + ')');
      }
      gmSay('⚠️ Relic grant issues: ' + parts.join('; ') + '.');
    }

    if (warnings.length) {
      var warningParts = [];
      for (var k = 0; k < warnings.length; k += 1) {
        var warn = warnings[k];
        var warnName = warn.player || 'Unknown Player';
        var warnText = describeRelicIssue(warn.reason);
        warningParts.push(warnName + ' (' + warnText + ')');
      }
      gmSay('⚠️ Relic grant warnings: ' + warningParts.join('; ') + '.');
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
   * Capture how many relics and reroll token trackers are about to be cleared.
   * Helps the GM confirm that manual adjustments match the reset scope.
   * @returns {{relics:number, rerollTokens:number}}
   */
  function summarizeRelicAndTokenState() {
    var snapshot = { relics: 0, rerollTokens: 0 };
    if (!state.HoardRun || !state.HoardRun.players) {
      return snapshot;
    }

    for (var pid in state.HoardRun.players) {
      if (!state.HoardRun.players.hasOwnProperty(pid)) {
        continue;
      }
      var playerState = state.HoardRun.players[pid];
      if (!playerState) {
        continue;
      }

      if (playerState.relics && playerState.relics.length) {
        snapshot.relics += playerState.relics.length;
      }

      var reroll = parseInt(playerState.rerollTokens, 10);
      if (!isNaN(reroll) && reroll > 0) {
        snapshot.rerollTokens += reroll;
      }
    }

    return snapshot;
  }

  /**
   * Removes token actions generated by Hoard Run (relics/boons) from every character.
   * @returns {{removed:number}}
   */
  function removeHoardTokenAbilities() {
    var result = { removed: 0 };
    if (typeof findObjs !== 'function') {
      return result;
    }

    var prefixes = ['hoard:', 'hr boon:', 'hr relic:'];
    var abilities = findObjs({ _type: 'ability' }) || [];

    for (var i = 0; i < abilities.length; i += 1) {
      var ability = abilities[i];
      if (!ability || typeof ability.get !== 'function') {
        continue;
      }

      var name = '';
      try {
        name = ability.get('name') || '';
      } catch (err) {
        name = '';
      }

      if (!name) {
        continue;
      }

      var lowered = String(name).toLowerCase();
      var matchesPrefix = false;
      for (var p = 0; p < prefixes.length; p += 1) {
        if (lowered.indexOf(prefixes[p]) === 0) {
          matchesPrefix = true;
          break;
        }
      }

      if (!matchesPrefix) {
        continue;
      }

      var isTokenAction = false;
      try {
        isTokenAction = !!ability.get('istokenaction');
      } catch (checkErr) {
        isTokenAction = false;
      }

      if (!isTokenAction) {
        continue;
      }

      try {
        ability.remove();
        result.removed += 1;
      } catch (removeErr) {
        // Ignore failures – sandbox permissions might block removal.
      }
    }

    return result;
  }

  /**
   * Reset the entire Hoard Run state.
   * Clears all progress, currencies, boons, etc.
   */
  function resetState() {
    var inventorySnapshot = summarizeRelicAndTokenState();
    var apCleanup = { abilitiesRemoved: 0, attributesRemoved: 0 };
    var tokenAbilityCleanup = removeHoardTokenAbilities();
    var relicRowCleanup = { rowsRemoved: 0, relicsProcessed: 0 };
    var effectCleanup = { trackedRemoved: 0, wipeRemoved: 0, orphanRemoved: 0, charactersCleared: 0 };
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
    if (
      state &&
      state.HoardRun &&
      state.HoardRun.players &&
      typeof RelicItemManager !== 'undefined' &&
      RelicItemManager &&
      typeof RelicItemManager.removeAllForCharacter === 'function' &&
      typeof RelicItemManager.removeRelic === 'function'
    ) {
      var charactersToClear = {};
      var orphanRemovals = [];

      for (var pid in state.HoardRun.players) {
        if (!state.HoardRun.players.hasOwnProperty(pid)) {
          continue;
        }

        var snapshot = state.HoardRun.players[pid];
        if (!snapshot || !snapshot.relics || !snapshot.relics.length) {
          continue;
        }

        var charId = snapshot.boundCharacterId || null;
        if (charId) {
          charactersToClear[charId] = true;
        } else {
          for (var r = 0; r < snapshot.relics.length; r += 1) {
            var relicEntry = snapshot.relics[r];
            if (!relicEntry) {
              continue;
            }
            orphanRemovals.push({ playerId: pid, relicId: relicEntry });
          }
        }
      }

      for (var charKey in charactersToClear) {
        if (charactersToClear.hasOwnProperty(charKey)) {
          RelicItemManager.removeAllForCharacter(charKey);
        }
      }

      for (var o = 0; o < orphanRemovals.length; o += 1) {
        var removal = orphanRemovals[o];
        RelicItemManager.removeRelic({
          playerId: removal.playerId,
          relicId: removal.relicId,
          suppressCharacterWarning: true
        });
      }
    }

    if (
      typeof RelicBinder !== 'undefined' &&
      RelicBinder &&
      typeof RelicBinder.purgeAllRelicInventory === 'function'
    ) {
      try {
        relicRowCleanup = RelicBinder.purgeAllRelicInventory();
      } catch (purgeErr) {
        relicRowCleanup = { rowsRemoved: 0, relicsProcessed: 0 };
      }
    }

    if (state && state.HoardRun && state.HoardRun.players) {
      var playerMap = state.HoardRun.players;
      for (var effectPid in playerMap) {
        if (!playerMap.hasOwnProperty(effectPid)) {
          continue;
        }

        var effectState = playerMap[effectPid] || {};

        if (
          typeof StateManager !== 'undefined' &&
          StateManager &&
          typeof StateManager.releaseTrackedEffects === 'function'
        ) {
          effectCleanup.trackedRemoved += StateManager.releaseTrackedEffects(effectPid, { silent: true });
        } else if (
          effectState.effectHandles &&
          effectState.effectHandles.length &&
          typeof EffectEngine !== 'undefined' &&
          EffectEngine &&
          typeof EffectEngine.remove === 'function'
        ) {
          for (var eh = 0; eh < effectState.effectHandles.length; eh += 1) {
            try {
              var handleId = effectState.effectHandles[eh];
              if (!handleId) {
                continue;
              }
              var removeResult = EffectEngine.remove(handleId);
              if (removeResult && removeResult.ok) {
                effectCleanup.trackedRemoved += 1;
              }
            } catch (effectErr) {
              // Ignore; handled via wipe below.
            }
          }
          effectState.effectHandles = [];
        }

        if (
          effectState.boundCharacterId &&
          typeof EffectEngine !== 'undefined' &&
          EffectEngine &&
          typeof EffectEngine.wipeCharacter === 'function'
        ) {
          var removedInstances = EffectEngine.wipeCharacter(effectState.boundCharacterId) || 0;
          if (removedInstances && removedInstances > 0) {
            effectCleanup.wipeRemoved += removedInstances;
          }
          effectCleanup.charactersCleared += 1;
        }
      }
    }

    if (
      typeof EffectEngine !== 'undefined' &&
      EffectEngine &&
      typeof EffectEngine.listActiveEffects === 'function' &&
      typeof EffectEngine.remove === 'function'
    ) {
      var lingering = EffectEngine.listActiveEffects();
      for (var li = 0; li < lingering.length; li += 1) {
        var record = lingering[li];
        if (!record || !record.id) {
          continue;
        }
        try {
          var removal = EffectEngine.remove(record.id);
          if (removal && removal.ok) {
            effectCleanup.orphanRemoved += 1;
          }
        } catch (lingerErr) {
          // Suppress — manual cleanup may be required.
        }
      }
    }

    resetHandouts();
    var removedAttrs = purgeHelperAttributes();
    delete state.HoardRun;
    state.HoardRun = { players: {}, version: 'dev' };
    if (typeof RunFlowManager !== 'undefined' && typeof RunFlowManager.resetRunState === 'function') {
      RunFlowManager.resetRunState();
    }
    var suffix = removedAttrs === 1 ? '' : 's';
    var apSpellsRemoved = apCleanup && apCleanup.spellsRemoved ? apCleanup.spellsRemoved : 0;
    var apSpellSuffix = apSpellsRemoved === 1 ? '' : 's';
    var apHelperAttrsRemoved = apCleanup && apCleanup.attributesRemoved ? apCleanup.attributesRemoved : 0;
    var tagSuffix = apHelperAttrsRemoved === 1 ? '' : 's';
    var apSpellAttrsRemoved = apCleanup && apCleanup.spellAttributesRemoved ? apCleanup.spellAttributesRemoved : 0;
    var apSpellAttrSuffix = apSpellAttrsRemoved === 1 ? '' : 's';
    var relicRecordsCleared = inventorySnapshot && inventorySnapshot.relics ? inventorySnapshot.relics : 0;
    var relicSuffix = relicRecordsCleared === 1 ? '' : 's';
    var rerollTrackersCleared = inventorySnapshot && inventorySnapshot.rerollTokens ? inventorySnapshot.rerollTokens : 0;
    var rerollSuffix = rerollTrackersCleared === 1 ? '' : 's';
    var hoardTokenActionsRemoved = tokenAbilityCleanup && tokenAbilityCleanup.removed ? tokenAbilityCleanup.removed : 0;
    var hoardTokenSuffix = hoardTokenActionsRemoved === 1 ? '' : 's';
    var hoardInventoryRowsRemoved = relicRowCleanup && relicRowCleanup.rowsRemoved ? relicRowCleanup.rowsRemoved : 0;
    var hoardInventorySuffix = hoardInventoryRowsRemoved === 1 ? '' : 's';
    var totalEffectsRemoved = effectCleanup.trackedRemoved + effectCleanup.wipeRemoved + effectCleanup.orphanRemoved;
    var effectSuffix = totalEffectsRemoved === 1 ? '' : 's';
    var effectCharSuffix = effectCleanup.charactersCleared === 1 ? '' : 's';
    var effectSummary = '';
    if (totalEffectsRemoved > 0 || effectCleanup.charactersCleared > 0) {
      effectSummary =
        ' Cleared ' +
        totalEffectsRemoved +
        ' stored effect instance' +
        effectSuffix +
        (effectCleanup.charactersCleared > 0
          ? ' across ' + effectCleanup.charactersCleared + ' character' + effectCharSuffix
          : '') +
        '.';
    }

    gmSay(
      '⚙️ HoardRun state has been reset. Removed ' +
        removedAttrs +
        ' hr_* attribute' +
        suffix +
        ', deleted ' +
        apSpellsRemoved +
        ' Always Prepared spell' +
        apSpellSuffix +
        ' (' +
        apSpellAttrsRemoved +
        ' field' +
        apSpellAttrSuffix +
        ')' +
        ' and ' +
        apHelperAttrsRemoved +
        ' AP spell helper attribute' +
        tagSuffix +
        '. Cleared ' +
        relicRecordsCleared +
        ' relic record' +
        relicSuffix +
        ' and ' +
        rerollTrackersCleared +
        ' reroll token tracker' +
        rerollSuffix +
        ', ' +
        hoardTokenActionsRemoved +
        ' Hoard token action' +
        hoardTokenSuffix +
        ', and ' +
        hoardInventoryRowsRemoved +
        ' Hoard inventory row' +
        hoardInventorySuffix +
        '.' +
        effectSummary +
        ' Relic-item pipeline automation is offline; apply sheet adjustments manually until it returns.'
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
      case '!mods-dump':
        if (typeof isGM === 'function' && !isGM(msg.playerid)) {
          gmSay('⚠️ Only the GM can inspect inventory modifiers.');
          return;
        }
        dumpInventoryModifiers(msg);
        break;
      case '!spells-dump':
        if (typeof isGM === 'function' && !isGM(msg.playerid)) {
          gmSay('⚠️ Only the GM can inspect spellbooks.');
          return;
        }
        dumpSpellbook(msg, argString);
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
    gmSay('🧰 DevTools loaded. Commands: !resetstate, !debugstate, !testshop, !testrelic, !resethandouts, !mods-dump, !spells-dump, !givecurrency, !giverelic');
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
