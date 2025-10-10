// ------------------------------------------------------------
// Ancestor Kits Core
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides a shared toolkit for Ancestor kit scripts.
//   Lets kit modules register their source abilities and mirror them to PCs.
//   Exposes chat helpers so the GM can bind kits to selected tokens.
//   Keeps all chat output styled like the rest of Hoard Run.
// ------------------------------------------------------------

var AncestorKits = (function (ns) {
  'use strict';

  ns = ns || {};

  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  // ------------------------------------------------------------
  // Internal Registries
  // ------------------------------------------------------------
  var _defs = ns._defs || {};
  var _aliasIndex = ns._aliasIndex || {};
  var _chatBound = ns._chatBound || false;

  // ------------------------------------------------------------
  // Utility Helpers
  // ------------------------------------------------------------

  function canonName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function logInfo(msg) {
    if (logger && logger.info) {
      logger.info('AncestorKits', msg);
      return;
    }
    if (typeof log === 'function') {
      log('[Hoard Run] [AncestorKits] ℹ️ ' + msg);
    }
  }

  function characterId(character) {
    if (!character) {
      return null;
    }
    if (character.id) {
      return character.id;
    }
    if (typeof character.get === 'function') {
      return character.get('_id') || character.get('id') || null;
    }
    return null;
  }

  function controllerIdsForCharacter(character) {
    if (!character || typeof character.get !== 'function') {
      return [];
    }

    var controlledBy = character.get('controlledby') || '';
    if (!controlledBy || controlledBy === 'all') {
      return [];
    }

    var parts = controlledBy.split(',');
    var ids = [];
    for (var i = 0; i < parts.length; i += 1) {
      var id = (parts[i] || '').trim();
      if (!id || id === 'all') {
        continue;
      }
      ids.push(id);
    }
    return ids;
  }

  function uniqueIds(list) {
    var seen = {};
    var result = [];
    for (var i = 0; i < list.length; i += 1) {
      var id = list[i];
      if (!id || seen[id]) {
        continue;
      }
      seen[id] = true;
      result.push(id);
    }
    return result;
  }

  function applyBoundCharacterToPlayers(playerIds, charId) {
    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function' || typeof StateManager.setPlayer !== 'function') {
      return;
    }

    var ids = uniqueIds(playerIds || []);
    if (!ids.length || !charId) {
      return;
    }

    for (var i = 0; i < ids.length; i += 1) {
      var pid = ids[i];
      if (!pid) {
        continue;
      }
      var ps = StateManager.getPlayer(pid);
      if (!ps) {
        continue;
      }
      ps.boundCharacterId = charId;
      StateManager.setPlayer(pid, ps);
    }
  }

  function clearBoundCharacterFromPlayers(playerIds, charId) {
    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.setPlayer !== 'function') {
      return;
    }

    if (!charId) {
      return;
    }

    var ids = uniqueIds(playerIds || []);
    if (!ids.length) {
      return;
    }

    for (var i = 0; i < ids.length; i += 1) {
      var pid = ids[i];
      if (!pid) {
        continue;
      }

      if (typeof state === 'undefined' || !state.HoardRun || !state.HoardRun.players || !state.HoardRun.players[pid]) {
        continue;
      }

      var ps = StateManager.getPlayer ? StateManager.getPlayer(pid) : state.HoardRun.players[pid];
      if (ps && ps.boundCharacterId === charId) {
        ps.boundCharacterId = null;
        StateManager.setPlayer(pid, ps);
      }
    }
  }

  /**
   * Sends a styled whisper to the GM.
   * Falls back to raw sendChat if UIManager is unavailable.
   * @param {string} html
   */
  function gmSay(html) {
    if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.gmLog === 'function') {
      UIManager.gmLog(html);
      return;
    }
    if (typeof sendChat === 'function') {
      sendChat('Hoard Run', '/w gm ' + html);
    }
  }

  /**
   * Wraps body content in a Hoard Run styled panel.
   * @param {string} title
   * @param {string} body
   * @returns {string}
   */
  function panel(title, body) {
    if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.panel === 'function') {
      return UIManager.panel(title, body);
    }
    return '<div style=\'border:1px solid #444;background:#111;color:#eee;padding:8px;\'>'
      + '<div style=\'font-weight:bold;margin-bottom:6px;\'>' + escapeHTML(title) + '</div>'
      + body
      + '</div>';
  }

  /**
   * Generates Roll20 chat buttons with consistent styling.
   * @param {Array<{label:string,command:string}>} list
   * @returns {string}
   */
  function buttons(list) {
    if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.buttons === 'function') {
      return UIManager.buttons(list);
    }
    return list.map(function (entry) {
      var command = (entry.command || '').replace(/^!/, '');
      return '[' + escapeHTML(entry.label || command) + '](!' + command + ')';
    }).join('<br>');
  }

  /**
   * Resolves or creates the source Character used for mirroring abilities.
   * @param {object} def
   * @returns {object|null}
   */
  function ensureSourceCharacter(def) {
    if (!def) {
      return null;
    }

    var ch = null;

    if (def.sourceId) {
      ch = getObj('character', def.sourceId);
    }

    if (!ch && def.sourceName) {
      ch = findObjs({ _type: 'character', name: def.sourceName })[0];
    }

    if (!ch && typeof def.ensureSource === 'function') {
      ch = def.ensureSource(def) || null;
    }

    if (!ch && typeof def.getSource === 'function') {
      ch = def.getSource(def) || null;
    }

    return ch || null;
  }

  /**
   * Creates or updates an Ability on a Character.
   * @param {string} characterId
   * @param {string} abilityName
   * @param {string} action
   * @param {boolean} isTokenAction
   * @returns {object|null}
   */
  function upsertAbility(characterId, abilityName, action, isTokenAction) {
    var ability = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: abilityName
    })[0];

    if (!ability) {
      ability = createObj('ability', {
        _characterid: characterId,
        name: abilityName,
        action: action,
        istokenaction: !!isTokenAction
      });
    } else {
      ability.set({
        action: action,
        istokenaction: !!isTokenAction
      });
    }

    return ability || null;
  }

  function escapeRegExp(str) {
    return String(str || '').replace(/[-/\^$*+?.()|[\]{}]/g, '\$&');
  }

  /**
   * Removes abilities from a Character that share the provided prefix.
   * @param {string} characterId
   * @param {string|RegExp} prefix
   * @returns {number} Count removed
   */
  function removePrefixedAbilities(characterId, prefix) {
    var removed = 0;
    if (!characterId || !prefix || typeof findObjs !== 'function') {
      return removed;
    }

    var pattern = prefix instanceof RegExp
      ? prefix
      : new RegExp('^' + escapeRegExp(prefix), 'i');

    findObjs({ _type: 'ability', _characterid: characterId }).forEach(function (ability) {
      var name = ability.get('name');
      if (pattern.test(name)) {
        ability.remove();
        removed += 1;
      }
    });

    return removed;
  }

  /**
   * Removes abilities from a Character that match the provided name exactly.
   * @param {string} characterId
   * @param {string} abilityName
   * @returns {number} Count removed
   */
  function removeAbilityByName(characterId, abilityName) {
    var removed = 0;
    if (!characterId || !abilityName || typeof findObjs !== 'function') {
      return removed;
    }

    var matches = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: abilityName
    }) || [];

    for (var i = 0; i < matches.length; i += 1) {
      var ability = matches[i];
      if (!ability || typeof ability.remove !== 'function') {
        continue;
      }
      ability.remove();
      removed += 1;
    }

    return removed;
  }

  /**
   * Removes mirrored abilities for a specific kit definition from a Character.
   * Attempts to match by prefix first, then falls back to explicit ability names.
   * @param {string} characterId
   * @param {object} def
   * @param {object=} seenPatterns Optional cache so a prefix is only processed once per character.
   * @returns {number}
   */
  function removeMirroredAbilitiesForDefinition(characterId, def, seenPatterns) {
    var removed = 0;
    if (!characterId || !def) {
      return removed;
    }

    var prefix = def.stripPattern || def.abilityPrefix;
    if (prefix) {
      var label = prefix instanceof RegExp ? prefix.toString() : String(prefix);
      if (!seenPatterns || !seenPatterns[label]) {
        removed += removePrefixedAbilities(characterId, prefix);
        if (seenPatterns) {
          seenPatterns[label] = true;
        }
      }
    }

    var abilityList = def.abilities || [];
    for (var i = 0; i < abilityList.length; i += 1) {
      var abilityDef = abilityList[i];
      if (!abilityDef) {
        continue;
      }

      var cfg = typeof abilityDef === 'string' ? { name: abilityDef } : abilityDef;
      var abilityName = deriveAbilityName(def, cfg);
      if (abilityName) {
        removed += removeAbilityByName(characterId, abilityName);
      }

      if (cfg.alternateNames && cfg.alternateNames.length) {
        for (var a = 0; a < cfg.alternateNames.length; a += 1) {
          removed += removeAbilityByName(characterId, cfg.alternateNames[a]);
        }
      }
    }

    return removed;
  }

  function resolveCharacter(target) {
    if (!target) {
      return null;
    }
    if (typeof target === 'string') {
      return getObj('character', target);
    }
    if (target.get && typeof target.get === 'function') {
      if (target.get('type') === 'character' || target.get('_type') === 'character') {
        return target;
      }
    }
    return null;
  }

  function resolveDefinition(name) {
    var key = canonName(name);
    if (!key) {
      return null;
    }
    var canonical = _aliasIndex[key] || key;
    return _defs[canonical] || null;
  }

  function selectedCharacterFromMessage(msg) {
    if (!msg || !msg.selected || !msg.selected.length) {
      return null;
    }
    var selection = msg.selected[0];
    var graphic = getObj('graphic', selection._id);
    if (!graphic) {
      return null;
    }
    var charId = graphic.get('represents');
    if (!charId) {
      return null;
    }
    return getObj('character', charId);
  }

  // ------------------------------------------------------------
  // Core Install Logic
  // ------------------------------------------------------------

  function deriveAbilityName(def, abilityDef) {
    var baseName = abilityDef.label || abilityDef.name || abilityDef.displayName || abilityDef.source || abilityDef;
    var prefix = abilityDef.prefix || def.abilityPrefix;
    if (abilityDef.includePrefix === false) {
      return baseName;
    }
    if (!prefix) {
      prefix = def.abilityPrefix;
    }
    if (!prefix) {
      return baseName;
    }
    return prefix + baseName;
  }

  function readSourceAbility(sourceChar, abilityName) {
    return findObjs({
      _type: 'ability',
      _characterid: sourceChar.id,
      name: abilityName
    })[0];
  }

  function mirrorAbilities(def, targetChar, opts) {
    // Do we actually need a source character?
    var needsSource = false;
    (def.abilities || []).forEach(function (abilityDef) {
      if (!abilityDef) return;
      var hasAction = typeof abilityDef === 'string'
        ? false // a string means "copy from source" by name
        : !!abilityDef.action; // explicit action provided
      if (!hasAction) needsSource = true;
    });

    var source = null;
    if (needsSource) {
      source = ensureSourceCharacter(def);
      if (!source) {
        gmSay('⚠️ Could not find source character for <b>' + escapeHTML(def.ancestor) + '</b>.');
        return false;
      }
    }

    if (!def.abilities || !def.abilities.length) {
      gmSay('⚠️ No abilities registered for <b>' + escapeHTML(def.ancestor) + '</b>.');
      return false;
    }

    var removed = removeMirroredAbilitiesForDefinition(targetChar.id, def);
    var installed = 0;
    var fallbackTokenAction = (typeof def.defaultTokenAction === 'boolean')
      ? def.defaultTokenAction
      : true;

    def.abilities.forEach(function (abilityDef) {
      var cfg = typeof abilityDef === 'string' ? { name: abilityDef } : (abilityDef || {});
      var sourceName = cfg.source || cfg.name;
      var action = cfg.action || '';
      var tokenAction = (typeof cfg.tokenAction === 'boolean') ? cfg.tokenAction : null;
      var defaultTokenAction = (typeof cfg.defaultTokenAction === 'boolean') ? cfg.defaultTokenAction : null;

      if (!action) {
        if (!source) { return; } // should not occur due to needsSource gate
        var srcAbility = readSourceAbility(source, sourceName);
        if (!srcAbility) {
          gmSay('⚠️ Missing ability <b>' + escapeHTML(sourceName) + '</b> on <b>' + escapeHTML(source.get('name')) + '</b>.');
          return;
        }
        action = srcAbility.get('action');
        if (tokenAction === null) tokenAction = !!srcAbility.get('istokenaction');
      }

      var targetName = deriveAbilityName(def, cfg);
      if (tokenAction === null) {
        tokenAction = (defaultTokenAction !== null) ? defaultTokenAction : fallbackTokenAction;
      }
      upsertAbility(targetChar.id, targetName, action, !!tokenAction);
      installed += 1;
    });

    if (!installed) {
      gmSay('⚠️ No abilities were mirrored for <b>' + escapeHTML(def.ancestor) + '</b>.');
      return false;
    }

    if (def.onInstall && typeof def.onInstall === 'function') {
      try { def.onInstall(targetChar, opts || {}); } catch (err) { gmSay('⚠️ Kit hook error: ' + escapeHTML(err.message || err)); }
    }

    gmSay('✅ Mirrored <b>' + installed + '</b> ability' + (installed === 1 ? '' : 'ies')
          + ' from <b>' + escapeHTML(def.ancestor) + '</b> onto <b>' + escapeHTML(targetChar.get('name')) + '</b>.'
          + (removed ? ' (Replaced ' + removed + ' previous entries.)' : ''));
    return true;
  }

  /**
   * Installs a registered kit onto a Character.
   * @param {string|object} name
   * @param {string|object} target
   * @param {object} opts
   * @returns {boolean}
   */
  function install(name, target, opts) {
    var def = typeof name === 'object' && name.ancestor ? name : resolveDefinition(name);
    var targetChar = resolveCharacter(target);

    if (!def) {
      gmSay('⚠️ Unknown ancestor kit <b>' + escapeHTML(name) + '</b>.');
      return false;
    }
    if (!targetChar) {
      gmSay('⚠️ Could not resolve the target character for binding.');
      return false;
    }

    var controllers = controllerIdsForCharacter(targetChar);
    var options = opts || {};
    if (options.by) {
      var invokerIsGM = false;
      if (typeof playerIsGM === 'function') {
        invokerIsGM = playerIsGM(options.by);
      } else if (typeof isGM === 'function') {
        invokerIsGM = isGM(options.by);
      }
      if (!invokerIsGM) {
        controllers.push(options.by);
      }
    }

    var didInstall = mirrorAbilities(def, targetChar, options);

    if (didInstall) {
      applyBoundCharacterToPlayers(controllers, characterId(targetChar));
    }

    return didInstall;
  }

  /**
   * Removes mirrored abilities from a target Character.
   * @param {string|object} name
   * @param {string|object} target
   * @returns {number}
   */
  function uninstallFrom(name, target) {
    var def = typeof name === 'object' && name.ancestor ? name : resolveDefinition(name);
    var targetChar = resolveCharacter(target);
    if (!def || !targetChar) {
      return 0;
    }

    var removed = removeMirroredAbilitiesForDefinition(targetChar.id, def);
    if (def.onUninstall && typeof def.onUninstall === 'function') {
      try {
        def.onUninstall(targetChar);
      } catch (err) {
        gmSay('⚠️ Kit hook error: ' + escapeHTML(err.message || err));
      }
    }
    if (removed) {
      gmSay('♻️ Removed <b>' + removed + '</b> mirrored ability' + (removed === 1 ? '' : 'ies')
        + ' from <b>' + escapeHTML(targetChar.get('name')) + '</b>.');
      clearBoundCharacterFromPlayers(controllerIdsForCharacter(targetChar), characterId(targetChar));
    }
    return removed;
  }

  /**
   * Clears mirrored abilities for all registered kits across every character.
   * Useful when wiping the campaign state or reimporting player sheets.
   * @param {object=} options
   * @returns {{removed:number, characters:number, summary:string}}
   */
  function clearAllMirroredAbilities(options) {
    var opts = options || {};
    var quiet = !!opts.quiet;
    var result = { removed: 0, characters: 0, summary: '' };

    if (typeof findObjs !== 'function') {
      result.summary = 'Cannot clear mirrored abilities; Roll20 object search unavailable.';
      if (!quiet) {
        gmSay('⚠️ ' + result.summary);
      }
      return result;
    }

    var defs = _defs || {};
    var keys = Object.keys(defs);
    if (!keys.length) {
      result.summary = 'No ancestor kits registered; nothing to clear.';
      if (!quiet) {
        gmSay('ℹ️ ' + result.summary);
      }
      return result;
    }

    var defsList = [];
    var hasRemovalStrategy = false;
    for (var i = 0; i < keys.length; i += 1) {
      var entry = defs[keys[i]] || {};
      defsList.push(entry);
      if (!hasRemovalStrategy) {
        if ((entry.stripPattern || entry.abilityPrefix) || (entry.abilities && entry.abilities.length)) {
          hasRemovalStrategy = true;
        }
      }
    }

    if (!defsList.length || !hasRemovalStrategy) {
      result.summary = 'Registered kits do not define prefixes or ability names to clear.';
      if (!quiet) {
        gmSay('ℹ️ ' + result.summary);
      }
      return result;
    }

    var characters = findObjs({ _type: 'character' }) || [];
    if (!characters.length) {
      result.summary = 'No characters found while clearing mirrored abilities.';
      if (!quiet) {
        gmSay('ℹ️ ' + result.summary);
      }
      return result;
    }

    for (var c = 0; c < characters.length; c += 1) {
      var character = characters[c];
      if (!character) {
        continue;
      }
      var charId = character.id || (character.get && character.get('_id'));
      if (!charId) {
        continue;
      }
      var removedForChar = 0;
      var seenPatterns = {};
      for (var d = 0; d < defsList.length; d += 1) {
        removedForChar += removeMirroredAbilitiesForDefinition(charId, defsList[d], seenPatterns);
      }
      if (removedForChar > 0) {
        result.removed += removedForChar;
        result.characters += 1;
        clearBoundCharacterFromPlayers(controllerIdsForCharacter(character), charId);
      }
    }

    if (result.removed > 0) {
      result.summary = 'Cleared <b>' + result.removed + '</b> mirrored ability' + (result.removed === 1 ? '' : 'ies')
        + ' from <b>' + result.characters + '</b> character' + (result.characters === 1 ? '' : 's') + '.';
      if (!quiet) {
        gmSay('♻️ ' + result.summary);
      }
    } else {
      result.summary = 'No mirrored abilities matched the registered kit prefixes or names.';
      if (!quiet) {
        gmSay('ℹ️ ' + result.summary);
      }
    }

    return result;
  }

  /**
   * Registers a kit definition for later binding.
   * @param {string|object} name
   * @param {object=} config
   * @returns {object|null}
   */
  function register(name, config) {
    var def = config || {};
    var baseName = name;

    if (typeof name === 'object') {
      def = name;
      baseName = name.name || name.ancestor;
    }

    var ancestorName = def.ancestor || baseName;
    var key = canonName(def.key || ancestorName);

    if (!key) {
      gmSay('⚠️ Cannot register ancestor kit without a name.');
      return null;
    }

    var stored = {
      key: key,
      ancestor: ancestorName || 'Unknown Ancestor',
      abilityPrefix: def.abilityPrefix || ('[' + (def.prefix || ancestorName || key) + '] '),
      stripPattern: def.stripPattern || null,
      sourceName: def.sourceName || def.sourceCharacterName || null,
      sourceId: def.sourceId || null,
      ensureSource: def.ensureSource || def.ensureSourceCharacter || null,
      getSource: def.getSource || null,
      abilities: def.abilities || [],
      buttonLabel: def.buttonLabel || ancestorName || key,
      onInstall: def.onInstall || null,
      onUninstall: def.onUninstall || null,
      defaultTokenAction: def.hasOwnProperty('defaultTokenAction')
        ? !!def.defaultTokenAction
        : true
    };

    if (def.includePrefix === false) {
      stored.abilityPrefix = '';
    }

    if (!stored.stripPattern && stored.abilityPrefix) {
      stored.stripPattern = new RegExp('^' + escapeRegExp(stored.abilityPrefix), 'i');
    }

    _defs[key] = stored;
    _aliasIndex[key] = key;

    var ancestorKey = canonName(ancestorName);
    if (ancestorKey) {
      _aliasIndex[ancestorKey] = key;
    }

    var buttonKey = canonName(stored.buttonLabel);
    if (buttonKey) {
      _aliasIndex[buttonKey] = key;
    }

    if (def.aliases && def.aliases.length) {
      def.aliases.forEach(function (alias) {
        var aliasKey = canonName(alias);
        if (aliasKey) {
          _aliasIndex[aliasKey] = key;
        }
      });
    }

    logInfo('Registered ancestor kit: ' + stored.ancestor + ' (' + key + ')');
    return stored;
  }

  /**
   * Prompts the GM with kit binding buttons.
   */
  function promptBindToSelectedPC() {
    var keys = Object.keys(_defs);
    if (!keys.length) {
      gmSay('⚠️ No ancestor kits have been registered yet.');
      return;
    }

    var sorted = keys.sort();
    var btns = buttons(sorted.map(function (key) {
      var def = _defs[key];
      return {
        label: def.buttonLabel,
        command: '!bindkit ' + def.key
      };
    }));

    var body = [
      '<div style=\'margin-bottom:6px;\'>Select a player token, then click a kit to mirror its token actions onto their sheet.</div>',
      '<div style=\'margin-bottom:6px;font-size:11px;opacity:0.8;\'>Only the GM can run these commands.</div>',
      '<div>' + btns + '</div>'
    ].join('');

    gmSay(panel('Bind Ancestor Kit', body));
  }

  function handleBindCommand(msg, args) {
    if (!playerIsGM(msg.playerid)) {
      gmSay('⚠️ Only the GM can mirror ancestor kits.');
      return;
    }

    if (!args) {
      promptBindToSelectedPC();
      return;
    }

    var def = resolveDefinition(args);
    if (!def) {
      gmSay('⚠️ No registered kit matches "' + escapeHTML(args) + '".');
      return;
    }

    var target = selectedCharacterFromMessage(msg);
    if (!target) {
      gmSay('⚠️ No token selected. On the same page, single-click the PC token (must represent a Character), then click the bind button again.');
      return;
    }

    install(def, target, { by: msg.playerid, viaCommand: true });
  }

  function handleChat(msg) {
    if (!msg || msg.type !== 'api') {
      return;
    }

    var content = (msg.content || '').trim();
    if (!content) {
      return;
    }

    var match = content.match(/^!bindkit\s*(.*)$/i);
    if (!match) {
      return;
    }

    var args = match[1] ? match[1].trim() : '';
    handleBindCommand(msg, args);
  }

  function registerChatHandler() {
    if (_chatBound) {
      return;
    }
    on('chat:message', handleChat);
    _chatBound = true;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  registerChatHandler();

  ns._defs = _defs;
  ns._aliasIndex = _aliasIndex;
  ns._chatBound = _chatBound;
  ns.register = register;
  ns.install = install;
  ns.uninstallFrom = uninstallFrom;
  ns.clearAllMirroredAbilities = clearAllMirroredAbilities;
  ns.promptBindToSelectedPC = promptBindToSelectedPC;
  ns.gmSay = gmSay;
  ns.panel = panel;
  ns.buttons = buttons;
  ns.ensureSourceCharacter = ensureSourceCharacter;
  ns.upsertAbility = upsertAbility;
  ns.removePrefixedAbilities = removePrefixedAbilities;

  return ns;

})(typeof AncestorKits !== 'undefined' ? AncestorKits : {});
