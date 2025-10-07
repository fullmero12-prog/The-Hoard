// ------------------------------------------------------------
// Ancestor Data Loader
// ------------------------------------------------------------
// What this does (in simple terms):
//   Stores flavor information for each Ancestor inline so the
//   Roll20 sandbox can serve quick lookups without external files.
//   Provides a simple helper to fetch an Ancestor's title and
//   summary for use in chat output and UI prompts.
// ------------------------------------------------------------

var AncestorDataLoader = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('AncestorDataLoader', message);
    } else {
      log('[Hoard Run] [AncestorDataLoader] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('AncestorDataLoader', message);
    } else {
      log('[Hoard Run] [AncestorDataLoader] ⚠️ ' + message);
    }
  }

  function fromRegistry(name) {
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getSummary === 'function') {
      return AncestorRegistry.getSummary(name);
    }
    return null;
  }

  function fallbackSummary(name) {
    return {
      title: name || 'Unknown Ancestor',
      summary: ''
    };
  }

  on('ready', function () {
    var count = 0;
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.count === 'function') {
      count = AncestorRegistry.count();
    }
    if (count > 0) {
      info('Loaded ' + count + ' ancestors via registry.');
    } else {
      warn('Registry unavailable — ancestor summaries will be blank.');
    }
  });

  return {
    get: function (name) {
      var info = fromRegistry(name);
      if (info) {
        return info;
      }
      return fallbackSummary(name);
    }
  };

})();
