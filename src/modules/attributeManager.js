// ------------------------------------------------------------
// Attribute Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides a tiny facade for working with Roll20 sheet attributes.
//   Mirrors the helpful parts of the ChatSetAttr API (worker-safe
//   writes plus repeating row helpers) so Hoard modules can create
//   attributes without re-implementing the tricky bits every time.
//   Falls back gracefully if LogManager or other helpers are missing.
// ------------------------------------------------------------

var AttributeManager = (function () {
  'use strict';

  var MODULE = 'AttributeManager';
  var logger = null;
  var uuidLastTime = 0;
  var uuidRandCache = [];

  function getLogger() {
    if (!logger && typeof LogManager !== 'undefined' && LogManager && typeof LogManager.getLogger === 'function') {
      logger = LogManager.getLogger();
    }
    return logger;
  }

  function logInfo(message) {
    var logHandle = getLogger();
    if (logHandle && typeof logHandle.info === 'function') {
      logHandle.info(MODULE, message);
    } else if (typeof log === 'function') {
      log('[Hoard Run][' + MODULE + '] ' + message);
    }
  }

  function logWarn(message) {
    var logHandle = getLogger();
    if (logHandle && typeof logHandle.warn === 'function') {
      logHandle.warn(MODULE, message);
    } else if (typeof log === 'function') {
      log('[Hoard Run][' + MODULE + '] WARN ' + message);
    }
  }

  function toAttrValue(value) {
    if (typeof value === 'undefined' || value === null) {
      return '';
    }

    if (typeof value === 'number') {
      if (isNaN(value)) {
        return '';
      }
      return String(value);
    }

    return String(value);
  }

  function findAttribute(charId, name) {
    if (!charId || !name) {
      return null;
    }

    var attrs = findObjs({
      _type: 'attribute',
      _characterid: charId,
      name: name
    }) || [];

    return attrs[0] || null;
  }

  function createAttribute(charId, name) {
    try {
      return createObj('attribute', {
        _characterid: charId,
        name: name,
        current: ''
      });
    } catch (err) {
      logWarn('Failed to create attribute "' + name + '" for ' + charId + ': ' + err.message);
      return null;
    }
  }

  function applyAttribute(attr, values, options) {
    if (!attr) {
      return {};
    }

    var payload = {};
    var opts = options || {};
    if (values && values.hasOwnProperty('current')) {
      payload.current = toAttrValue(values.current);
    }
    if (values && values.hasOwnProperty('max')) {
      payload.max = toAttrValue(values.max);
    }

    if (Object.keys(payload).length === 0) {
      return payload;
    }

    try {
      if (opts.useWorkers !== false && typeof attr.setWithWorker === 'function') {
        attr.setWithWorker(payload);
      } else {
        attr.set(payload);
      }
    } catch (err) {
      logWarn('Failed to set attribute "' + attr.get('name') + '": ' + err.message);
    }

    return payload;
  }

  function normalizeSpec(spec) {
    var output = {};
    if (spec && spec.hasOwnProperty('current')) {
      output.current = spec.current;
    }
    if (spec && spec.hasOwnProperty('max')) {
      output.max = spec.max;
    }
    return output;
  }

  /**
   * Sets multiple attributes on a character, using sheet workers when available.
   * @param {string} charId
   * @param {Array<{name:string,current?:*,max?:*}>} specs
   * @param {{create?:boolean,useWorkers?:boolean}=} options
   * @returns {Array<{name:string,attribute:object|null,values:Object}>}
   */
  function setAttributes(charId, specs, options) {
    var results = [];
    var opts = options || {};

    if (!charId || !specs || !specs.length) {
      return results;
    }

    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i] || {};
      var name = spec.name;
      if (!name) {
        continue;
      }

      var attr = findAttribute(charId, name);
      if (!attr && opts.create === false) {
        continue;
      }

      if (!attr) {
        attr = createAttribute(charId, name);
      }

      if (!attr) {
        continue;
      }

      var appliedValues = applyAttribute(attr, normalizeSpec(spec), opts);
      results.push({
        name: name,
        attribute: attr,
        values: appliedValues
      });
    }

    return results;
  }

  function generateUUID() {
    var chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    var now = (new Date()).getTime();
    var duplicateTime = now === uuidLastTime;
    uuidLastTime = now;
    var uuid = '';

    for (var i = 0; i < 8; i++) {
      uuid += chars.charAt(now % 64);
      now = Math.floor(now / 64);
    }

    if (duplicateTime) {
      var incremented = false;
      for (var j = 11; j >= 0; j--) {
        if (uuidRandCache[j] === 63) {
          uuidRandCache[j] = 0;
        } else {
          uuidRandCache[j] += 1;
          incremented = true;
          break;
        }
      }
      if (!incremented) {
        uuidRandCache[11] = 1;
      }
    } else {
      for (var k = 0; k < 12; k++) {
        uuidRandCache[k] = Math.floor(64 * Math.random());
      }
    }

    for (var n = 0; n < 12; n++) {
      uuid += chars.charAt(uuidRandCache[n]);
    }

    return uuid;
  }

  /**
   * Generates a Roll20-friendly repeating row id (mirrors ChatSetAttr logic).
   * @returns {string}
   */
  function generateRowId() {
    return generateUUID().replace(/_/g, 'Z');
  }

  function normaliseSection(section) {
    if (!section) {
      return '';
    }
    return section.indexOf('repeating_') === 0 ? section.slice('repeating_'.length) : section;
  }

  function buildRepeatingName(section, rowId, field) {
    return 'repeating_' + normaliseSection(section) + '_' + rowId + '_' + field;
  }

  /**
   * Creates a new repeating row and populates the supplied fields.
   * @param {string} charId
   * @param {string} section repeating section name (with or without "repeating_")
   * @param {Object<string, *>|Object<string,{current?:*,max?:*}>} fields
   * @param {{useWorkers?:boolean}=} options
   * @returns {{rowId:string, attributes:Array}}
   */
  function createRepeatingRow(charId, section, fields, options) {
    var payloads = [];
    var rowId = generateRowId();
    var normalized = normaliseSection(section);
    var opts = options || {};

    if (!charId || !normalized) {
      return null;
    }

    for (var field in fields) {
      if (!fields.hasOwnProperty(field)) {
        continue;
      }

      var value = fields[field];
      var spec = { name: buildRepeatingName(normalized, rowId, field) };
      if (value && typeof value === 'object' && (value.hasOwnProperty('current') || value.hasOwnProperty('max'))) {
        if (value.hasOwnProperty('current')) {
          spec.current = value.current;
        }
        if (value.hasOwnProperty('max')) {
          spec.max = value.max;
        }
      } else {
        spec.current = value;
      }
      payloads.push(spec);
    }

    var results = setAttributes(charId, payloads, opts);
    return {
      rowId: rowId,
      attributes: results
    };
  }

  function register() {
    logInfo('Attribute helpers ready (sheet workers enabled by default).');
  }

  return {
    register: register,
    setAttributes: setAttributes,
    createRepeatingRow: createRepeatingRow,
    generateRowId: generateRowId,
    buildRepeatingName: buildRepeatingName
  };
})();
