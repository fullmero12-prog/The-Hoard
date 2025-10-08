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
    var pools = ['boons', 'relics'];

    for (var pid in players) {
      if (!players.hasOwnProperty(pid)) {
        continue;
      }

      var player = players[pid];
      if (!player || !player.boundCharacterId) {
        continue;
      }

      for (var p = 0; p < pools.length; p += 1) {
        var poolName = pools[p];
        var list = player[poolName];
        if (!list || !list.length) {
          continue;
        }

        for (var i = 0; i < list.length; i += 1) {
          var entry = list[i];
          if (!entry) {
            continue;
          }

          var effectId = entry.effectId || entry.effect_id || entry.id || entry.name;
          if (!effectId) {
            continue;
          }

          var effectDef = EffectRegistry.get(effectId);
          if (!effectDef) {
            continue;
          }

          removed += removeTokenAbilitiesForEffect(player.boundCharacterId, effectDef);
        }
      }
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
    removeTokenAbilitiesFromRunState: removeTokenAbilitiesFromRunState
  };
})();
