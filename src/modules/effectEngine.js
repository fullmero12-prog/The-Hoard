// ------------------------------------------------------------
// Effect Engine
// ------------------------------------------------------------
// What this does (in simple terms):
//   Applies effect definitions to characters using sheet adapters.
//   Tracks which effects are active so they can be removed or reset later.
// ------------------------------------------------------------

var EffectEngine = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;
  var INSTANCE_PREFIX = 'eff_';

  function logInfo(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ℹ️ ' + message);
    }
  }

  function logWarn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ⚠️ ' + message);
    }
  }

  function logError(message) {
    if (logger && typeof logger.error === 'function') {
      logger.error('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ❌ ' + message);
    }
  }

  function getStateRoot() {
    if (typeof state !== 'undefined') {
      return state;
    }

    if (!root.__hoardMockState) {
      root.__hoardMockState = {};
    }

    return root.__hoardMockState;
  }

  function ensureEffectsState() {
    var stateRoot = getStateRoot();
    if (!stateRoot.HoardRun) {
      stateRoot.HoardRun = { players: {}, shops: {} };
    }

    if (!stateRoot.HoardRun.effects) {
      stateRoot.HoardRun.effects = {};
    }

    var effectsState = stateRoot.HoardRun.effects;
    if (!effectsState.instances) {
      effectsState.instances = {};
    }
    if (!effectsState.index) {
      effectsState.index = {};
    }
    if (!effectsState.order) {
      effectsState.order = [];
    }

    return effectsState;
  }

  function sanitizeForState(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'function') {
      return null;
    }

    if (Object.prototype.toString.call(value) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < value.length; i += 1) {
        arr.push(sanitizeForState(value[i]));
      }
      return arr;
    }

    if (typeof value === 'object') {
      var obj = {};
      var key;
      for (key in value) {
        if (value.hasOwnProperty(key)) {
          obj[key] = sanitizeForState(value[key]);
        }
      }
      return obj;
    }

    return value;
  }

  function generateInstanceId() {
    var effectsState = ensureEffectsState();
    var attempt = 0;
    var id;
    do {
      id = INSTANCE_PREFIX + Math.random().toString(36).substr(2, 8);
      attempt += 1;
      if (attempt > 10) {
        break;
      }
    } while (effectsState.instances[id]);
    return id;
  }

  function flattenAdapterOperations(effect) {
    var patches = [];
    if (!effect) {
      return patches;
    }

    if (effect.adapterPatches && effect.adapterPatches.length) {
      for (var i = 0; i < effect.adapterPatches.length; i += 1) {
        patches.push(effect.adapterPatches[i]);
      }
    }

    if (effect.patches && effect.patches.length) {
      for (var j = 0; j < effect.patches.length; j += 1) {
        patches.push(effect.patches[j]);
      }
    }

    if (effect.operations && effect.operations.length) {
      for (var k = 0; k < effect.operations.length; k += 1) {
        var op = effect.operations[k];
        if (!op) {
          continue;
        }
        if (op.type === 'adapter' || (!op.type && op.op)) {
          patches.push(op);
        }
      }
    }

    return patches;
  }

  function resolveEffect(effectId, options) {
    if (options && options.effectDefinition) {
      return options.effectDefinition;
    }

    if (typeof EffectRegistry !== 'undefined' && EffectRegistry && typeof EffectRegistry.get === 'function') {
      return EffectRegistry.get(effectId);
    }

    return null;
  }

  function buildAdapterWrapper(adapter) {
    if (!adapter) {
      return null;
    }

    return {
      name: adapter.name || adapter.id || 'adapter',
      apply: typeof adapter.apply === 'function' ? adapter.apply : null,
      remove: typeof adapter.remove === 'function' ? adapter.remove : null
    };
  }

  function resolveAdapter(charId, options, fallbackName) {
    if (options && options.adapter && typeof options.adapter.apply === 'function') {
      return buildAdapterWrapper(options.adapter);
    }

    if (typeof EffectAdapters !== 'undefined' && EffectAdapters) {
      if (options && options.adapterName && typeof EffectAdapters.getAdapterByName === 'function') {
        var named = EffectAdapters.getAdapterByName(options.adapterName);
        if (named) {
          return buildAdapterWrapper(named);
        }
      }

      if (typeof EffectAdapters.findAdapterForCharacter === 'function') {
        var detected = EffectAdapters.findAdapterForCharacter(charId, options);
        if (detected) {
          return buildAdapterWrapper(detected);
        }
      }
    }

    if (typeof root.EffectAdaptersDnd5eRoll20 !== 'undefined' && root.EffectAdaptersDnd5eRoll20) {
      var helper = root.EffectAdaptersDnd5eRoll20;
      if (typeof helper.applyAdapterPatch === 'function') {
        return {
          name: fallbackName || 'dnd5e-roll20',
          apply: function (cid, patch, effect) {
            return helper.applyAdapterPatch(cid, patch, effect);
          },
          remove: typeof helper.removeAdapterPatch === 'function'
            ? function (cid, patch, effect) { return helper.removeAdapterPatch(cid, patch, effect); }
            : null
        };
      }
    }

    return null;
  }

  function storeInstance(record) {
    var effectsState = ensureEffectsState();
    effectsState.instances[record.id] = record;
    effectsState.order.push(record.id);

    var list = effectsState.index[record.characterId] || [];
    list.push(record.id);
    effectsState.index[record.characterId] = list;
  }

  function removeInstance(record) {
    var effectsState = ensureEffectsState();
    if (!effectsState.instances[record.id]) {
      return;
    }

    delete effectsState.instances[record.id];

    var nextOrder = [];
    for (var i = 0; i < effectsState.order.length; i += 1) {
      if (effectsState.order[i] !== record.id) {
        nextOrder.push(effectsState.order[i]);
      }
    }
    effectsState.order = nextOrder;

    var byChar = effectsState.index[record.characterId] || [];
    var nextByChar = [];
    for (var j = 0; j < byChar.length; j += 1) {
      if (byChar[j] !== record.id) {
        nextByChar.push(byChar[j]);
      }
    }
    effectsState.index[record.characterId] = nextByChar;
  }

  function apply(effectId, options) {
    options = options || {};
    var charId = options.characterId || options.charId || options.targetCharacterId;
    if (!charId) {
      logWarn('Refused to apply effect "' + effectId + '": no character id provided.');
      return { ok: false, reason: 'no-character' };
    }

    var effect = resolveEffect(effectId, options);
    if (!effect) {
      logWarn('Effect "' + effectId + '" is not registered.');
      return { ok: false, reason: 'missing-effect' };
    }

    var adapter = resolveAdapter(charId, options, effect.adapterName);
    if (!adapter || typeof adapter.apply !== 'function') {
      logWarn('No matching sheet adapter when applying effect "' + (effect.id || effectId) + '".');
      return { ok: false, reason: 'no-adapter', effect: effect };
    }

    var patches = flattenAdapterOperations(effect);
    if (!patches.length) {
      logWarn('Effect "' + (effect.id || effectId) + '" has no adapter patches to apply.');
      return { ok: false, reason: 'no-operations', effect: effect };
    }

    var applied = 0;
    var results = [];
    for (var i = 0; i < patches.length; i += 1) {
      var patch = patches[i];
      var success = false;
      try {
        success = adapter.apply(charId, patch, effect, options);
      } catch (err) {
        logError('Adapter error while applying effect "' + (effect.id || effectId) + '": ' + err.message);
        success = false;
      }
      if (success) {
        applied += 1;
      }
      results.push({ op: patch.op || 'adapter', ok: !!success });
    }

    if (!applied) {
      logWarn('Effect "' + (effect.id || effectId) + '" applied 0 patches.');
      return { ok: false, reason: 'no-success', effect: effect, results: results };
    }

    var instanceId = generateInstanceId();
    var record = {
      id: instanceId,
      effectId: effect.id || effectId,
      effectName: effect.name || effect.title || effect.id || effectId,
      characterId: charId,
      adapterName: adapter.name || adapter.id || null,
      patches: sanitizeForState(patches),
      results: sanitizeForState(results),
      source: sanitizeForState(options.source || effect.source || null),
      createdAt: (new Date()).getTime ? new Date().getTime() : 0
    };

    if (options.persist !== false) {
      storeInstance(record);
    }

    logInfo('Applied effect "' + record.effectName + '" to character ' + charId + ' (' + applied + ' patches).');
    return { ok: true, effect: effect, adapter: adapter, instanceId: instanceId, applied: applied, results: results };
  }

  function remove(instanceId, options) {
    options = options || {};
    var effectsState = ensureEffectsState();
    var record = effectsState.instances[instanceId];
    if (!record) {
      logWarn('No stored effect instance found for id ' + instanceId + '.');
      return { ok: false, reason: 'missing-instance' };
    }

    var adapter = resolveAdapter(record.characterId, { adapterName: record.adapterName });
    var effect = resolveEffect(record.effectId, options) || {
      id: record.effectId,
      name: record.effectName
    };
    if (!adapter || typeof adapter.remove !== 'function') {
      logWarn('Adapter missing remove() for effect instance ' + instanceId + '.');
      removeInstance(record);
      return { ok: false, reason: 'no-adapter-remove' };
    }

    var removed = 0;
    var patches = record.patches || [];
    for (var i = 0; i < patches.length; i += 1) {
      var patch = patches[i];
      var success = false;
      try {
        success = adapter.remove(record.characterId, patch, effect);
      } catch (err) {
        logError('Adapter error while removing effect instance ' + instanceId + ': ' + err.message);
        success = false;
      }
      if (success) {
        removed += 1;
      }
    }

    removeInstance(record);
    logInfo('Removed effect instance ' + instanceId + ' from character ' + record.characterId + ' (' + removed + ' patches).');
    return { ok: true, removed: removed };
  }

  function getActiveEffectsForCharacter(charId) {
    var effectsState = ensureEffectsState();
    var ids = effectsState.index[charId] || [];
    var list = [];
    for (var i = 0; i < ids.length; i += 1) {
      var record = effectsState.instances[ids[i]];
      if (record) {
        list.push(sanitizeForState(record));
      }
    }
    return list;
  }

  function listActiveEffects() {
    var effectsState = ensureEffectsState();
    var list = [];
    for (var i = 0; i < effectsState.order.length; i += 1) {
      var id = effectsState.order[i];
      if (effectsState.instances[id]) {
        list.push(sanitizeForState(effectsState.instances[id]));
      }
    }
    return list;
  }

  function wipeCharacter(charId) {
    var effectsState = ensureEffectsState();
    var ids = (effectsState.index[charId] || []).slice();
    var removed = 0;
    for (var i = 0; i < ids.length; i += 1) {
      var result = remove(ids[i]);
      if (result && result.ok) {
        removed += 1;
      }
    }
    return removed;
  }

  function registerModule() {
    var effectsState = ensureEffectsState();
    var activeCount = effectsState.order.length;
    logInfo('Effect engine online. Active instances: ' + activeCount + '.');
  }

  return {
    register: registerModule,
    apply: apply,
    remove: remove,
    listActiveEffects: listActiveEffects,
    getActiveEffectsForCharacter: getActiveEffectsForCharacter,
    wipeCharacter: wipeCharacter
  };
})();
