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
    if (typeof log === 'function') {
      log('[AncestorKits] ' + msg);
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
    if (!characterId || !prefix) {
      return removed;
    }

    var pattern = prefix instanceof RegExp
      ? prefix
      : new RegExp('^' + escapeRegExp(prefix));

    findObjs({ _type: 'ability', _characterid: characterId }).forEach(function (ability) {
      var name = ability.get('name');
      if (pattern.test(name)) {
        ability.remove();
        removed += 1;
      }
    });

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

  /**
   * Pulls the first selected token and resolves it to a player character sheet.
   * Roll20 treats any token that "represents" a character with the sheet's PC
   * toggle enabled as a player-controlled token, which is what kit mirroring expects.
   * @param {Object} msg
   * @returns {Roll20Object|null}
   */
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

    var removed = removePrefixedAbilities(targetChar.id, def.stripPattern || def.abilityPrefix);
    var installed = 0;

    def.abilities.forEach(function (abilityDef) {
      var cfg = typeof abilityDef === 'string' ? { name: abilityDef } : (abilityDef || {});
      var sourceName = cfg.source || cfg.name;
      var action = cfg.action || '';
      var tokenAction = (typeof cfg.tokenAction === 'boolean') ? cfg.tokenAction : null;

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
      upsertAbility(targetChar.id, targetName, action, tokenAction === null ? !!cfg.defaultTokenAction : tokenAction);
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

    return mirrorAbilities(def, targetChar, opts || {});
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

    var removed = removePrefixedAbilities(targetChar.id, def.stripPattern || def.abilityPrefix);
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
    }
    return removed;
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
      onUninstall: def.onUninstall || null
    };

    if (def.includePrefix === false) {
      stored.abilityPrefix = '';
    }

    if (!stored.stripPattern && stored.abilityPrefix) {
      stored.stripPattern = new RegExp('^' + escapeRegExp(stored.abilityPrefix));
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
      gmSay('⚠️ Select a token that represents a Player Character sheet (PC toggle enabled) before running the bind command.');
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
  ns.promptBindToSelectedPC = promptBindToSelectedPC;
  ns.gmSay = gmSay;
  ns.panel = panel;
  ns.buttons = buttons;
  ns.ensureSourceCharacter = ensureSourceCharacter;
  ns.upsertAbility = upsertAbility;
  ns.removePrefixedAbilities = removePrefixedAbilities;

  return ns;

})(typeof AncestorKits !== 'undefined' ? AncestorKits : {});
