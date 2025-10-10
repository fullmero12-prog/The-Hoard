// ------------------------------------------------------------
// Effect Adapters
// ------------------------------------------------------------
// What this does (in simple terms):
//   Maintains a registry of Roll20 sheet adapters.
//   Adapters abstract sheet-specific logic for applying Hoard
//   patches so the effect engine can stay sheet-agnostic.
// ------------------------------------------------------------

var EffectAdapters = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;
  var adapters = [];
  var adapterCache = {};

  function normalizeId(id) {
    return id ? String(id) : '';
  }

  function getCharacterId(character) {
    if (!character) {
      return '';
    }

    if (character.id) {
      return normalizeId(character.id);
    }

    if (typeof character.get === 'function') {
      try {
        var fetched = character.get('_id');
        if (fetched) {
          return normalizeId(fetched);
        }
      } catch (err) {}
    }

    return '';
  }

  function resetAdapterCache() {
    adapterCache = {};
  }

  function rememberAdapter(characterId, adapter) {
    var cacheId = normalizeId(characterId);
    if (!cacheId || !adapter) {
      return;
    }

    adapterCache[cacheId] = adapter;
  }

  function getCachedAdapter(characterId) {
    var cacheId = normalizeId(characterId);
    if (!cacheId) {
      return null;
    }

    var cached = adapterCache[cacheId];
    if (!cached) {
      return null;
    }

    for (var i = 0; i < adapters.length; i++) {
      if (adapters[i] === cached) {
        return cached;
      }
    }

    return null;
  }

  function info(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('EffectAdapters', message);
    } else {
      log('[Hoard Run] [EffectAdapters] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('EffectAdapters', message);
    } else {
      log('[Hoard Run] [EffectAdapters] ⚠️ ' + message);
    }
  }

  function error(message) {
    if (logger && typeof logger.error === 'function') {
      logger.error('EffectAdapters', message);
    } else {
      log('[Hoard Run] [EffectAdapters] ❌ ' + message);
    }
  }

  function findCharacter(characterId) {
    if (!characterId) {
      return null;
    }
    var character = getObj('character', characterId);
    if (!character) {
      warn('Character ' + characterId + ' not found while resolving adapters.');
      return null;
    }
    return character;
  }

  function pickAdapter(character) {
    if (!character) {
      return null;
    }

    var cacheId = getCharacterId(character);
    var cached = getCachedAdapter(cacheId);
    if (cached) {
      return cached;
    }

    for (var i = 0; i < adapters.length; i++) {
      var adapter = adapters[i];
      try {
        if (!adapter.detect || adapter.detect(character)) {
          rememberAdapter(cacheId, adapter);
          return adapter;
        }
      } catch (err) {
        error('Adapter "' + (adapter.name || ('#' + i)) + '" detect failed: ' + err);
      }
    }

    return null;
  }

  function registerAdapter(adapter) {
    if (!adapter || typeof adapter.apply !== 'function') {
      warn('Attempted to register invalid adapter.');
      return;
    }

    adapters.push(adapter);
    resetAdapterCache();
    info('Registered adapter "' + (adapter.name || 'unnamed') + '".');
  }

  function apply(characterId, patch, effect) {
    var character = findCharacter(characterId);
    if (!character) {
      return false;
    }

    var adapter = pickAdapter(character);
    if (!adapter) {
      warn('No adapter available for character ' + character.get('name') + '.');
      return false;
    }

    try {
      return adapter.apply(characterId, patch, effect) === true;
    } catch (err) {
      error('Adapter "' + (adapter.name || 'unnamed') + '" apply error: ' + err);
      return false;
    }
  }

  function remove(characterId, patch, effect) {
    var character = findCharacter(characterId);
    if (!character) {
      return false;
    }

    var adapter = pickAdapter(character);
    if (!adapter || typeof adapter.remove !== 'function') {
      warn('No removable adapter available for character ' + character.get('name') + '.');
      return false;
    }

    try {
      return adapter.remove(characterId, patch, effect) === true;
    } catch (err) {
      error('Adapter "' + (adapter.name || 'unnamed') + '" remove error: ' + err);
      return false;
    }
  }

  function registerModule() {
    resetAdapterCache();
    info('EffectAdapters ready. Registered ' + adapters.length + ' adapters.');
  }

  return {
    registerAdapter: registerAdapter,
    apply: apply,
    remove: remove,
    register: registerModule
  };
})();
