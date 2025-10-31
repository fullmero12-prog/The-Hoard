// ------------------------------------------------------------
// Effect Adapters Registry
// ------------------------------------------------------------
// What this does (in simple terms):
//   Keeps track of sheet-specific adapter helpers (like Roll20 5e).
//   Lets the EffectEngine find the right adapter for a character
//   before applying automation patches or cleaning them up later.
// ------------------------------------------------------------

var EffectAdapters = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;
  var adapters = [];
  var adapterMap = {};
  var pendingKey = '__HoardPendingAdapters';
  if (!root[pendingKey]) {
    root[pendingKey] = [];
  }
  var pendingQueue = root[pendingKey];

  function logInfo(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('EffectAdapters', message);
    } else {
      log('[Hoard Run] [EffectAdapters] ℹ️ ' + message);
    }
  }

  function logWarn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('EffectAdapters', message);
    } else {
      log('[Hoard Run] [EffectAdapters] ⚠️ ' + message);
    }
  }

  function isFunction(value) {
    return typeof value === 'function';
  }

  function normalizeName(name) {
    if (!name && name !== 0) {
      return '';
    }
    return String(name).toLowerCase();
  }

  function shallowCloneAdapter(adapter) {
    var clone = {};
    var key;
    for (key in adapter) {
      if (adapter.hasOwnProperty(key)) {
        clone[key] = adapter[key];
      }
    }
    return clone;
  }

  function registerAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') {
      logWarn('Attempted to register an invalid adapter payload.');
      return { ok: false };
    }

    var name = adapter.name || adapter.id || adapter.label || '';
    var normalizedName = normalizeName(name);
    if (!normalizedName) {
      logWarn('An adapter was registered without a name.');
      return { ok: false };
    }

    if (adapterMap[normalizedName]) {
      logWarn('Adapter "' + name + '" is already registered.');
      return { ok: false, duplicate: true };
    }

    var record = {
      name: name,
      detect: isFunction(adapter.detect) ? adapter.detect : null,
      apply: isFunction(adapter.apply) ? adapter.apply : null,
      remove: isFunction(adapter.remove) ? adapter.remove : null,
      purgeHoardInventory: isFunction(adapter.purgeHoardInventory) ? adapter.purgeHoardInventory : null,
      raw: shallowCloneAdapter(adapter)
    };

    adapters.push(record);
    adapterMap[normalizedName] = record;
    logInfo('Registered adapter "' + name + '". Total adapters: ' + adapters.length + '.');
    return { ok: true, name: name };
  }

  function processPendingQueue() {
    if (!pendingQueue || !pendingQueue.length) {
      return;
    }

    var queueCopy = pendingQueue.slice();
    pendingQueue.length = 0;

    for (var i = 0; i < queueCopy.length; i += 1) {
      registerAdapter(queueCopy[i]);
    }
  }

  function getRegisteredAdapters() {
    var list = [];
    for (var i = 0; i < adapters.length; i += 1) {
      list.push(shallowCloneAdapter(adapters[i]));
    }
    return list;
  }

  function getAdapterByName(name) {
    var normalized = normalizeName(name);
    if (!normalized) {
      return null;
    }
    return adapterMap[normalized] || null;
  }

  function findAdapterForCharacter(charId, context) {
    if (!adapters.length) {
      return null;
    }

    var character = null;
    if (typeof getObj === 'function' && charId) {
      try {
        character = getObj('character', charId);
      } catch (err) {
        logWarn('Failed to fetch character ' + charId + ' while resolving adapter: ' + err.message);
      }
    }

    for (var i = 0; i < adapters.length; i += 1) {
      var adapter = adapters[i];
      if (!adapter.detect) {
        return adapter;
      }

      var detected = false;
      try {
        detected = adapter.detect(character, context);
      } catch (err) {
        logWarn('Adapter "' + adapter.name + '" detect() threw an error: ' + err.message);
      }

      if (detected) {
        return adapter;
      }
    }

    return adapters[0];
  }

  function register() {
    logInfo('Effect adapter registry ready. Registered adapters: ' + adapters.length + '.');
  }

  processPendingQueue();

  return {
    register: register,
    registerAdapter: registerAdapter,
    getRegisteredAdapters: getRegisteredAdapters,
    getAdapterByName: getAdapterByName,
    findAdapterForCharacter: findAdapterForCharacter
  };
})();
