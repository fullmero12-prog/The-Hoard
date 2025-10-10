// ------------------------------------------------------------
// Effect Engine
// ------------------------------------------------------------
// What this does (in simple terms):
//   Applies EffectRegistry definitions to Roll20 characters.
//   Handles attribute tweaks, ability mirroring, and GM note
//   annotations when boons or relics are gained in a run.
// ------------------------------------------------------------

var EffectEngine = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ⚠️ ' + message);
    }
  }

  var ancestorStatMirrorMap = {
    'hr_pb': { source: 'pb' },
    'hr_spellmod': { source: 'spell_mod' }
  };

  function escapeHTML(text) {
    if (!text) {
      return '';
    }
    if (typeof _ !== 'undefined' && _.escape) {
      return _.escape(String(text));
    }
    return String(text).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function ensureAttribute(characterId, name) {
    if (!characterId || !name) {
      return null;
    }

    var attr = findObjs({
      _type: 'attribute',
      _characterid: characterId,
      name: name
    })[0];

    if (!attr) {
      attr = createObj('attribute', {
        _characterid: characterId,
        name: name,
        current: ''
      });
    }

    return attr || null;
  }

  function applyAdapterFallback(characterId, patch) {
    if (!patch || !patch.op) {
      return false;
    }

    if (patch.op === 'add_resource_counter') {
      var baseName = 'hr_res_' + String(patch.name || 'resource').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      var maxValue = patch.max || 1;
      var cadenceValue = patch.cadence || 'per_room';

      var maxAttr = ensureAttribute(characterId, baseName + '_max');
      if (maxAttr) {
        maxAttr.set('current', maxValue);
      }

      var curAttr = ensureAttribute(characterId, baseName + '_cur');
      if (curAttr) {
        curAttr.set('current', maxValue);
      }

      var cadenceAttr = ensureAttribute(characterId, baseName + '_cadence');
      if (cadenceAttr) {
        cadenceAttr.set('current', cadenceValue);
      }

      return true;
    }

    return false;
  }

  function applyAttrPatch(characterId, patch) {
    var attr = ensureAttribute(characterId, patch.name);
    if (!attr) {
      return;
    }

    var op = (patch.op || 'set').toLowerCase();
    var value = patch.value;

    if (op === 'add' || op === 'increment') {
      var current = parseFloat(attr.get('current') || 0);
      var delta = parseFloat(value || 0);
      if (!isNaN(current) && !isNaN(delta)) {
        attr.set('current', current + delta);
      } else {
        attr.set('current', value);
      }
      return;
    }

    attr.set('current', value);
  }

  /**
   * Normalizes Roll20 ability macro bar flags into booleans.
   * @param {*} value
   * @returns {boolean}
   */
  function normalizeMacroBarValue(value) {
    if (value === 'show' || value === true || value === 'true' || value === '1') {
      return true;
    }
    return false;
  }

  /**
   * Reads whether an ability already shows in the macro bar.
   * @param {object} ability
   * @returns {boolean}
   */
  function readAbilityMacroBarFlag(ability) {
    if (!ability || typeof ability.get !== 'function') {
      return false;
    }

    var flag;

    try {
      flag = ability.get('showmacrobar');
      if (typeof flag !== 'undefined' && flag !== null) {
        return normalizeMacroBarValue(flag);
      }
    } catch (err1) {}

    try {
      flag = ability.get('inbar');
      if (typeof flag !== 'undefined' && flag !== null) {
        return normalizeMacroBarValue(flag);
      }
    } catch (err2) {}

    try {
      flag = ability.get('macro');
      if (typeof flag !== 'undefined' && flag !== null) {
        return normalizeMacroBarValue(flag);
      }
    } catch (err3) {}

    return false;
  }

  /**
   * Applies macro bar fields to the ability payload when requested.
   * @param {object} payload
   * @param {boolean} showInMacroBar
   */
  function applyMacroBarPayload(payload, showInMacroBar) {
    if (!payload || showInMacroBar !== true) {
      return;
    }

    payload.showmacrobar = 'show';
    payload.inbar = true;
    payload.macro = 'show';
  }

  function upsertAbility(characterId, name, action, isTokenAction, ability, showInMacroBar) {
    if (!characterId || !name) {
      return null;
    }

    var existing = ability || findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: name
    })[0];

    var payload = {
      action: action || ''
    };

    if (typeof isTokenAction === 'boolean') {
      payload.istokenaction = !!isTokenAction;
    }

    applyMacroBarPayload(payload, showInMacroBar === true);

    if (!existing) {
      existing = createObj('ability', {
        _characterid: characterId,
        name: name,
        action: payload.action,
        istokenaction: payload.hasOwnProperty('istokenaction') ? payload.istokenaction : !!isTokenAction,
        showmacrobar: payload.showmacrobar,
        inbar: payload.inbar,
        macro: payload.macro
      });
    } else {
      existing.set(payload);
    }

    return existing || null;
  }

  function shouldMacroizePatch(effect, patch) {
    if (!patch || patch.type !== 'ability') {
      return false;
    }

    if (patch.macro === true) {
      return true;
    }

    if (effect && effect.meta && effect.meta.abilitiesAsMacros) {
      return true;
    }

    return false;
  }

  function getBoundPlayers(characterId) {
    var results = [];

    if (!characterId) {
      return results;
    }

    if (typeof StateManager !== 'undefined' && StateManager && typeof StateManager.findPlayersByCharacter === 'function') {
      try {
        var bound = StateManager.findPlayersByCharacter(characterId) || [];
        for (var b = 0; b < bound.length; b += 1) {
          var entry = bound[b];
          if (!entry) {
            continue;
          }
          var pid = entry.id || entry.playerId || entry.playerid || null;
          if (pid) {
            results.push({ id: pid, state: entry.state || null });
          }
        }
      } catch (err) {}
    }

    if (!results.length && typeof state !== 'undefined' && state && state.HoardRun && state.HoardRun.players) {
      var players = state.HoardRun.players;
      for (var pid in players) {
        if (!players.hasOwnProperty(pid)) {
          continue;
        }
        try {
          var ps = players[pid];
          if (ps && ps.boundCharacterId === characterId) {
            results.push({ id: pid, state: ps });
          }
        } catch (e) {}
      }
    }

    return results;
  }

  function ensureMacroForPlayer(playerId, macroName, action) {
    if (!playerId || !macroName) {
      return;
    }

    if (typeof findObjs !== 'function' || typeof createObj !== 'function') {
      return;
    }

    var criteria = {
      _type: 'macro',
      playerid: playerId,
      name: macroName
    };

    var existing = null;
    try {
      var matches = findObjs(criteria) || [];
      existing = matches[0] || null;
    } catch (err) {}

    var sanitizedAction = action || '';

    if (!existing) {
      try {
        createObj('macro', {
          name: macroName,
          action: sanitizedAction,
          playerid: playerId,
          istokenaction: false,
          visibleto: playerId
        });
      } catch (createErr) {}
      return;
    }

    var updates = {
      action: sanitizedAction,
      istokenaction: false
    };

    try {
      if (typeof existing.get === 'function') {
        var currentVisible = existing.get('visibleto') || '';
        if (currentVisible !== playerId) {
          updates.visibleto = playerId;
        }
      }
      if (typeof existing.set === 'function') {
        existing.set(updates);
      }
    } catch (updateErr) {}
  }

  function ensureAbilityMacros(characterId, patch) {
    var macroName = patch && (patch.name || patch.label);
    if (!macroName) {
      return;
    }

    var action = patch.action || '';
    var owners = getBoundPlayers(characterId);
    for (var i = 0; i < owners.length; i += 1) {
      var owner = owners[i];
      if (!owner || !owner.id) {
        continue;
      }
      ensureMacroForPlayer(owner.id, macroName, action);
    }
  }

  function removeMacroForPlayer(playerId, macroName) {
    if (!playerId || !macroName) {
      return 0;
    }

    if (typeof findObjs !== 'function') {
      return 0;
    }

    var removed = 0;
    try {
      var matches = findObjs({ _type: 'macro', playerid: playerId, name: macroName }) || [];
      for (var i = 0; i < matches.length; i += 1) {
        var macro = matches[i];
        if (!macro) {
          continue;
        }
        try {
          if (typeof macro.remove === 'function') {
            macro.remove();
            removed += 1;
          }
        } catch (removeErr) {}
      }
    } catch (err) {}

    return removed;
  }

  function appendGMNote(character, effectName, text) {
    if (!character || !text) {
      return;
    }

    var existing = character.get('gmnotes') || '';
    var decoded;

    try {
      decoded = decodeURIComponent(existing);
    } catch (err) {
      decoded = existing;
    }

    var noteBlock = '<div><b>' + escapeHTML(effectName) + ':</b> ' + escapeHTML(text) + '</div>';
    var updated = decoded;

    if (updated.indexOf(noteBlock) === -1) {
      updated += noteBlock;
    }

    character.set('gmnotes', encodeURIComponent(updated));
  }

  function applyAbilityPatch(characterId, patch, effect) {
    var name = patch.name || patch.label;
    if (!name) {
      return;
    }

    var action = patch.action || '';
    var explicitToken = patch.hasOwnProperty('token');
    var ability = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: name
    })[0];
    var tokenAction;

    var macroMode = shouldMacroizePatch(effect, patch);

    if (macroMode) {
      tokenAction = false;
    } else if (explicitToken) {
      tokenAction = !!patch.token;
    } else if (ability && typeof ability.get === 'function') {
      tokenAction = !!ability.get('istokenaction');
    } else {
      tokenAction = false;
    }

    var showInMacroBar = null;

    if (patch && patch.hasOwnProperty('macroBar')) {
      showInMacroBar = !!patch.macroBar;
    } else if (patch && patch.hasOwnProperty('showMacroBar')) {
      showInMacroBar = !!patch.showMacroBar;
    } else if (macroMode) {
      showInMacroBar = true;
    } else if (ability) {
      showInMacroBar = readAbilityMacroBarFlag(ability);
    }

    upsertAbility(characterId, name, action, tokenAction, ability, showInMacroBar === true);

    if (macroMode) {
      ensureAbilityMacros(characterId, patch);
    }
  }

  function removeTokenAbilityByName(characterId, abilityName) {
    if (!characterId || !abilityName) {
      return 0;
    }
    if (typeof findObjs !== 'function') {
      return 0;
    }

    var removed = 0;
    var matches = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: abilityName
    }) || [];

    for (var i = 0; i < matches.length; i += 1) {
      var ability = matches[i];
      if (!ability) {
        continue;
      }

      var isTokenAction = false;
      try {
        if (typeof ability.get === 'function') {
          isTokenAction = !!ability.get('istokenaction');
        }
      } catch (abilityErr) {}

      if (!isTokenAction) {
        continue;
      }

      try {
        if (typeof ability.remove === 'function') {
          ability.remove();
          removed += 1;
        }
      } catch (removeErr) {}
    }

    return removed;
  }

  function removeAbilityByName(characterId, abilityName) {
    if (!characterId || !abilityName) {
      return 0;
    }
    if (typeof findObjs !== 'function') {
      return 0;
    }

    var removed = 0;
    var matches = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: abilityName
    }) || [];

    for (var i = 0; i < matches.length; i += 1) {
      var ability = matches[i];
      if (!ability) {
        continue;
      }
      try {
        if (typeof ability.remove === 'function') {
          ability.remove();
          removed += 1;
        }
      } catch (err) {}
    }

    return removed;
  }

  function removeTokenAbilityPatch(characterId, patch) {
    if (!patch || patch.type !== 'ability') {
      return 0;
    }

    var abilityName = patch.name || patch.label;
    if (!abilityName) {
      return 0;
    }

    if (patch.macro === true) {
      return removeAbilityByName(characterId, abilityName);
    }

    var hasTokenFlag = Object.prototype.hasOwnProperty.call(patch, 'token');
    if (!hasTokenFlag || !patch.token) {
      return 0;
    }

    return removeTokenAbilityByName(characterId, abilityName);
  }

  function removeTokenAbilitiesForEffect(characterId, effect, playerId) {
    if (!characterId || !effect) {
      return { abilitiesRemoved: 0, macrosRemoved: 0 };
    }

    var removed = { abilitiesRemoved: 0, macrosRemoved: 0 };
    var patches = effect.patches || [];

    for (var i = 0; i < patches.length; i += 1) {
      var patch = patches[i];
      if (!patch || patch.type !== 'ability') {
        continue;
      }

      removed.abilitiesRemoved += removeTokenAbilityPatch(characterId, patch);

      if (playerId && shouldMacroizePatch(effect, patch)) {
        removed.macrosRemoved += removeMacroForPlayer(playerId, patch.name || patch.label || '');
      }
    }

    return removed;
  }

  function getEffectDefinition(effectId) {
    if (!effectId) {
      return null;
    }

    if (typeof EffectRegistry === 'undefined' || !EffectRegistry || typeof EffectRegistry.get !== 'function') {
      return null;
    }

    return EffectRegistry.get(effectId);
  }

  function removeTokenAbilitiesForPlayer(playerState, playerId) {
    if (!playerState || !playerState.boundCharacterId) {
      return { abilitiesRemoved: 0, macrosRemoved: 0 };
    }

    var removed = { abilitiesRemoved: 0, macrosRemoved: 0 };
    var pools = ['boons', 'relics'];

    for (var p = 0; p < pools.length; p += 1) {
      var poolName = pools[p];
      var list = playerState[poolName];
      if (!list || !list.length) {
        continue;
      }

      for (var i = 0; i < list.length; i += 1) {
        var entry = list[i];
        if (!entry) {
          continue;
        }

        var effectId = entry.effectId || entry.effect_id || entry.id || entry.name;
        var effectDef = getEffectDefinition(effectId);
        if (!effectDef) {
          continue;
        }

        var effectRemoval = removeTokenAbilitiesForEffect(playerState.boundCharacterId, effectDef, playerId);
        removed.abilitiesRemoved += effectRemoval.abilitiesRemoved;
        removed.macrosRemoved += effectRemoval.macrosRemoved;
      }
    }

    return removed;
  }

  function removeTokenAbilitiesFromRunState() {
    if (typeof state === 'undefined' || !state || !state.HoardRun || !state.HoardRun.players) {
      return { abilitiesRemoved: 0, macrosRemoved: 0 };
    }

    if (typeof EffectRegistry === 'undefined' || !EffectRegistry || typeof EffectRegistry.get !== 'function') {
      warn('EffectRegistry unavailable; cannot remove token abilities from run state.');
      return { abilitiesRemoved: 0, macrosRemoved: 0 };
    }

    var removed = { abilitiesRemoved: 0, macrosRemoved: 0 };
    var players = state.HoardRun.players;

    for (var pid in players) {
      if (!players.hasOwnProperty(pid)) {
        continue;
      }

      var playerRemoval = removeTokenAbilitiesForPlayer(players[pid], pid);
      removed.abilitiesRemoved += playerRemoval.abilitiesRemoved;
      removed.macrosRemoved += playerRemoval.macrosRemoved;
    }

    if (removed.abilitiesRemoved > 0 || removed.macrosRemoved > 0) {
      info('Removed ' + removed.abilitiesRemoved + ' ability records and ' + removed.macrosRemoved + ' macros from boon or relic effects.');
    }

    return removed;
  }

  function applyNotePatch(character, effect, patch) {
    appendGMNote(character, effect.name || effect.id || 'Effect', patch.text || '');
  }

  function getRequestedAncestorStatMirrors(effect) {
    if (!effect || !effect.meta) {
      return [];
    }

    var raw = effect.meta.syncStats;
    var list = [];

    if (typeof raw === 'undefined' || raw === null) {
      return list;
    }

    if (Object.prototype.toString.call(raw) === '[object Array]') {
      for (var i = 0; i < raw.length; i++) {
        list.push(raw[i]);
      }
    } else if (typeof raw === 'string') {
      list.push(raw);
    }

    var normalized = [];
    for (var n = 0; n < list.length; n++) {
      var entry = list[n];
      if (typeof entry === 'string' && entry) {
        normalized.push(entry);
      }
    }

    return normalized;
  }

  function apply(characterId, effect) {
    if (!characterId || !effect) {
      return;
    }

    var character = getObj('character', characterId);
    if (!character) {
      warn('Character ' + characterId + ' not found for effect ' + (effect.id || effect.name || '?') + '.');
      return;
    }

    var statMirrors = getRequestedAncestorStatMirrors(effect);
    if (statMirrors.length) {
      syncAncestorStats(characterId, statMirrors);
    }

    var patches = effect.patches || [];
    for (var i = 0; i < patches.length; i++) {
      var patch = patches[i];
      if (!patch || !patch.type) {
        continue;
      }

      if (patch.type === 'attr') {
        applyAttrPatch(characterId, patch);
      }
      if (patch.type === 'ability') {
        applyAbilityPatch(characterId, patch, effect);
      }
      if (patch.type === 'note') {
        applyNotePatch(character, effect, patch);
      }
      if (patch.type === 'adapter') {
        if (typeof EffectAdapters !== 'undefined' && EffectAdapters && typeof EffectAdapters.apply === 'function') {
          EffectAdapters.apply(characterId, patch, effect);
        } else {
          if (!applyAdapterFallback(characterId, patch)) {
            warn('Adapter patch skipped — EffectAdapters module unavailable.');
          }
        }
      }
    }

    info('Applied effect "' + (effect.name || effect.id) + '" to character ' + character.get('name') + '.');
  }

  function register() {
    info('EffectEngine ready.');
  }

  // Mirrors sheet stats into Hoard Run attributes for ancestors requesting them via metadata.
  function syncAncestorStats(characterId, requestedStats) {
    if (!characterId || !requestedStats || !requestedStats.length) {
      return;
    }

    var cache = {};

    function readNumberAttr(name) {
      if (Object.prototype.hasOwnProperty.call(cache, name)) {
        return cache[name];
      }

      var attr = findObjs({
        _type: 'attribute',
        _characterid: characterId,
        name: name
      })[0];

      var value = attr ? attr.get('current') : 0;
      var parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        parsed = 0;
      }

      cache[name] = parsed;
      return parsed;
    }

    function writeNumberAttr(name, value) {
      var attr = ensureAttribute(characterId, name);
      if (!attr) {
        return;
      }
      attr.set('current', value);
    }

    for (var i = 0; i < requestedStats.length; i++) {
      var targetName = requestedStats[i];
      if (!Object.prototype.hasOwnProperty.call(ancestorStatMirrorMap, targetName)) {
        continue;
      }

      var mapping = ancestorStatMirrorMap[targetName] || {};
      var sourceName = mapping.source;
      if (!sourceName) {
        continue;
      }

      var mirroredValue = readNumberAttr(sourceName);
      writeNumberAttr(targetName, mirroredValue);
    }
  }

  return {
    apply: apply,
    register: register,
    removeTokenAbilitiesForPlayer: removeTokenAbilitiesForPlayer,
    removeTokenAbilitiesFromRunState: removeTokenAbilitiesFromRunState
  };
})();
