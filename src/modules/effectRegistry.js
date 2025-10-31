// ------------------------------------------------------------
// Effect Registry
// ------------------------------------------------------------
// What this does (in simple terms):
//   Stores reusable effect definitions so other systems
//   (boons, relics, upgrades) can look them up by id.
//   Also provides helper methods to register and list effects.
// ------------------------------------------------------------

var EffectRegistry = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;
  var catalog = {};
  var order = [];

  function logInfo(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('EffectRegistry', message);
    } else {
      log('[Hoard Run] [EffectRegistry] ℹ️ ' + message);
    }
  }

  function logWarn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('EffectRegistry', message);
    } else {
      log('[Hoard Run] [EffectRegistry] ⚠️ ' + message);
    }
  }

  function normalizeId(effectId) {
    if (!effectId && effectId !== 0) {
      return '';
    }
    return String(effectId).toLowerCase();
  }

  function cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'function') {
      return value;
    }

    if (Object.prototype.toString.call(value) === '[object Date]') {
      return new Date(value.getTime());
    }

    if (Object.prototype.toString.call(value) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < value.length; i += 1) {
        arr.push(cloneValue(value[i]));
      }
      return arr;
    }

    if (typeof value === 'object') {
      var obj = {};
      var key;
      for (key in value) {
        if (value.hasOwnProperty(key)) {
          obj[key] = cloneValue(value[key]);
        }
      }
      return obj;
    }

    return value;
  }

  function register(effectId, definition) {
    var normalizedId = normalizeId(effectId);
    if (!normalizedId) {
      logWarn('Attempted to register an effect without an id.');
      return { ok: false };
    }

    if (!definition || typeof definition !== 'object') {
      logWarn('Effect "' + effectId + '" registration failed: invalid definition.');
      return { ok: false };
    }

    var entry = cloneValue(definition);
    entry.id = definition.id || effectId;
    catalog[normalizedId] = entry;

    var exists = false;
    for (var i = 0; i < order.length; i += 1) {
      if (order[i] === normalizedId) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      order.push(normalizedId);
    }

    return { ok: true, id: entry.id };
  }

  function registerMany(payload) {
    if (!payload) {
      return 0;
    }

    var count = 0;

    if (Object.prototype.toString.call(payload) === '[object Array]') {
      for (var i = 0; i < payload.length; i += 1) {
        var item = payload[i];
        if (!item) {
          continue;
        }
        var id = item.id || item.effectId || item.key;
        if (register(id, item).ok) {
          count += 1;
        }
      }
      return count;
    }

    if (typeof payload === 'object') {
      var key;
      for (key in payload) {
        if (!payload.hasOwnProperty(key)) {
          continue;
        }
        if (register(key, payload[key]).ok) {
          count += 1;
        }
      }
    }

    return count;
  }

  function get(effectId) {
    var normalizedId = normalizeId(effectId);
    if (!normalizedId || !catalog[normalizedId]) {
      return null;
    }
    return cloneValue(catalog[normalizedId]);
  }

  function has(effectId) {
    var normalizedId = normalizeId(effectId);
    if (!normalizedId) {
      return false;
    }
    return !!catalog[normalizedId];
  }

  function list() {
    var results = [];
    for (var i = 0; i < order.length; i += 1) {
      var key = order[i];
      if (catalog[key]) {
        results.push(cloneValue(catalog[key]));
      }
    }
    return results;
  }

  function count() {
    return order.length;
  }

  function clear() {
    catalog = {};
    order = [];
  }

  function registerModule() {
    logInfo('Effect registry initialized with ' + count() + ' effects.');
  }

  return {
    register: registerModule,
    registerEffect: register,
    registerMany: registerMany,
    get: get,
    has: has,
    list: list,
    count: count,
    clear: clear
  };
})();
