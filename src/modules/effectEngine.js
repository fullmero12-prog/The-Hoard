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

  function upsertAbility(characterId, name, action, isTokenAction, ability) {
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

    if (!existing) {
      existing = createObj('ability', {
        _characterid: characterId,
        name: name,
        action: payload.action,
        istokenaction: payload.hasOwnProperty('istokenaction') ? payload.istokenaction : !!isTokenAction
      });
    } else {
      existing.set(payload);
    }

    return existing || null;
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

  function applyAbilityPatch(characterId, patch) {
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

    if (explicitToken) {
      tokenAction = !!patch.token;
    } else if (ability && typeof ability.get === 'function') {
      tokenAction = !!ability.get('istokenaction');
    } else {
      tokenAction = false;
    }

    upsertAbility(characterId, name, action, tokenAction, ability);
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

  function removeTokenAbilityPatch(characterId, patch) {
    if (!patch || patch.type !== 'ability') {
      return 0;
    }

    var hasTokenFlag = Object.prototype.hasOwnProperty.call(patch, 'token');
    if (!hasTokenFlag || !patch.token) {
      return 0;
    }

    var abilityName = patch.name || patch.label;
    if (!abilityName) {
      return 0;
    }

    return removeTokenAbilityByName(characterId, abilityName);
  }

  function removeTokenAbilitiesForEffect(characterId, effect) {
    if (!characterId || !effect) {
      return 0;
    }

    var removed = 0;
    var patches = effect.patches || [];

    for (var i = 0; i < patches.length; i += 1) {
      removed += removeTokenAbilityPatch(characterId, patches[i]);
    }

    return removed;
  }

  function slugify(text) {
    if (!text) {
      return '';
    }

    return String(text)
      .toLowerCase()
      .replace(/[\u2019'`]+/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function firstSlugSegment(text) {
    var slug = slugify(text);
    if (!slug) {
      return '';
    }

    return slug.split('_')[0];
  }

  function buildEffectIdCandidates(entry) {
    var candidates = [];
    var seen = {};

    function pushCandidate(value) {
      if (!value) {
        return;
      }

      var lowered = String(value).toLowerCase();
      if (seen[lowered]) {
        return;
      }

      seen[lowered] = true;
      candidates.push(value);
    }

    if (entry) {
      pushCandidate(entry.effectId);
      pushCandidate(entry.effect_id);
      pushCandidate(entry.id);
      pushCandidate(entry.name);
    }

    var ancestor = entry && entry.ancestor ? entry.ancestor : (entry && entry.source ? entry.source : null);
    var ancestorSlug = ancestor ? firstSlugSegment(ancestor) : '';
    var entrySlug = entry ? slugify(entry.effectId || entry.id || entry.name) : '';

    if (entrySlug) {
      pushCandidate(entrySlug);
      if (ancestorSlug) {
        pushCandidate(ancestorSlug + '_' + entrySlug);
      }
    }

    return candidates;
  }

  function resolveEffectDefinition(entry) {
    var candidates = buildEffectIdCandidates(entry);

    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      var effect = getEffectDefinition(candidate);
      if (effect) {
        return effect;
      }
    }

    return null;
  }

  function collectTokenAbilities(characterId) {
    if (!characterId || typeof findObjs !== 'function') {
      return [];
    }

    var abilities = findObjs({
      _type: 'ability',
      _characterid: characterId
    }) || [];

    var results = [];

    for (var i = 0; i < abilities.length; i += 1) {
      var ability = abilities[i];
      if (!ability) {
        continue;
      }

      var isToken = false;

      try {
        if (typeof ability.get === 'function') {
          isToken = !!ability.get('istokenaction');
        }
      } catch (abilityErr) {}

      if (isToken) {
        results.push(ability);
      }
    }

    return results;
  }

  function removeTokenAbilitiesByPrefix(characterId, prefixes, abilityCache) {
    if (!characterId || !prefixes || !prefixes.length) {
      return 0;
    }

    var removed = 0;
    var normalized = [];

    for (var p = 0; p < prefixes.length; p += 1) {
      var prefix = prefixes[p];
      if (!prefix) {
        continue;
      }
      normalized.push(String(prefix).toLowerCase());
    }

    if (!normalized.length) {
      return 0;
    }

    var list = abilityCache || collectTokenAbilities(characterId);

    for (var i = 0; i < list.length; i += 1) {
      var ability = list[i];
      if (!ability) {
        continue;
      }

      var name = '';

      try {
        if (typeof ability.get === 'function') {
          name = ability.get('name') || '';
        }
      } catch (nameErr) {}

      var lowered = String(name).toLowerCase();
      if (!lowered) {
        continue;
      }

      for (var n = 0; n < normalized.length; n += 1) {
        var token = normalized[n];
        if (!token) {
          continue;
        }

        if (lowered.indexOf(token) === 0) {
          try {
            if (typeof ability.remove === 'function') {
              ability.remove();
              removed += 1;
              list[i] = null;
            }
          } catch (removeErr) {}
          break;
        }
      }
    }

    return removed;
  }

  function buildTokenPrefixes(entry) {
    var prefixes = [];
    if (!entry) {
      return prefixes;
    }

    var ancestor = entry.ancestor || entry.source;
    if (ancestor) {
      var first = firstSlugSegment(ancestor);
      if (first) {
        prefixes.push('[' + first + ']');
      }
    }

    var effectId = entry.effectId || entry.effect_id || entry.id || entry.name;
    if (effectId) {
      var seg = firstSlugSegment(effectId);
      if (seg) {
        prefixes.push('[' + seg + ']');
      }
    }

    return prefixes;
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

  function removeTokenAbilitiesForPlayer(playerState) {
    if (!playerState || !playerState.boundCharacterId) {
      return 0;
    }

    var removed = 0;
    var pools = ['boons', 'relics'];
    var abilityCache = null;

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

        var effectDef = resolveEffectDefinition(entry);
        var removedForEntry = 0;

        if (effectDef) {
          removedForEntry = removeTokenAbilitiesForEffect(playerState.boundCharacterId, effectDef);
        }

        if (!removedForEntry) {
          if (!effectDef) {
            warn('Effect definition missing for entry "' + (entry.name || entry.id || entry.effectId || 'Unknown') + '"; attempting fallback removal.');
          }
          if (!abilityCache) {
            abilityCache = collectTokenAbilities(playerState.boundCharacterId);
          }

          var prefixes = buildTokenPrefixes(entry);
          var fallbackRemoved = removeTokenAbilitiesByPrefix(playerState.boundCharacterId, prefixes, abilityCache);

          if (fallbackRemoved > 0) {
            removedForEntry += fallbackRemoved;
            info('Removed ' + fallbackRemoved + ' token abilities using prefix fallback for "' + (entry.name || entry.id || entry.effectId || 'Unknown') + '".');
          }
        } else {
          abilityCache = null;
        }

        removed += removedForEntry;
      }
    }

    return removed;
  }

  function removeTokenAbilitiesFromRunState() {
    if (typeof state === 'undefined' || !state || !state.HoardRun || !state.HoardRun.players) {
      return 0;
    }

    if (typeof EffectRegistry === 'undefined' || !EffectRegistry || typeof EffectRegistry.get !== 'function') {
      warn('EffectRegistry unavailable; cannot remove token abilities from run state.');
      return 0;
    }

    var removed = 0;
    var players = state.HoardRun.players;

    for (var pid in players) {
      if (!players.hasOwnProperty(pid)) {
        continue;
      }

      removed += removeTokenAbilitiesForPlayer(players[pid]);
    }

    if (removed > 0) {
      info('Removed ' + removed + ' token abilities from boon or relic effects.');
    }

    return removed;
  }

  function applyNotePatch(character, effect, patch) {
    appendGMNote(character, effect.name || effect.id || 'Effect', patch.text || '');
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

    if (effect.id && String(effect.id).indexOf('vladren_') === 0) {
      syncVladrenStats(characterId);
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
        applyAbilityPatch(characterId, patch);
      }
      if (patch.type === 'note') {
        applyNotePatch(character, effect, patch);
      }
      if (patch.type === 'adapter') {
        if (typeof EffectAdapters !== 'undefined' && EffectAdapters && typeof EffectAdapters.apply === 'function') {
          EffectAdapters.apply(characterId, patch, effect);
        } else {
          warn('Adapter patch skipped — EffectAdapters module unavailable.');
        }
      }
    }

    info('Applied effect "' + (effect.name || effect.id) + '" to character ' + character.get('name') + '.');
  }

  function register() {
    info('EffectEngine ready.');
  }

  // Mirrors AncestorKits' stat sync so Vladren boon buttons can pull PB/spell mod.
  function syncVladrenStats(characterId) {
    if (!characterId) {
      return;
    }

    function readNumberAttr(name) {
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
      return parsed;
    }

    function writeNumberAttr(name, value) {
      var attr = ensureAttribute(characterId, name);
      if (!attr) {
        return;
      }
      attr.set('current', value);
    }

    var pb = readNumberAttr('pb');
    var spellMod = readNumberAttr('spell_mod');

    writeNumberAttr('hr_pb', pb);
    writeNumberAttr('hr_spellmod', spellMod);
  }

  return {
    apply: apply,
    register: register,
    removeTokenAbilitiesForPlayer: removeTokenAbilitiesForPlayer,
    removeTokenAbilitiesFromRunState: removeTokenAbilitiesFromRunState
  };
})();
