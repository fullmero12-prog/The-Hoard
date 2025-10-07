// ------------------------------------------------------------
// Log Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides a unified logging helper for every Hoard Run module.
//   Each log is stamped with the game name, module name, and an icon
//   that highlights the severity so the Mod Output Console stays clean.
//   Modules can call HRLog.info/warn/error/ready without repeating
//   formatting logic or emojis.
// ------------------------------------------------------------

var LogManager = (function () {
  var VERSION = '1.0.0';
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var ICONS = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    ready: '✅',
    success: '✅'
  };

  function ensureLogger() {
    if (!root.HRLog) {
      root.HRLog = createLogger();
    }
    return root.HRLog;
  }

  function createLogger() {
    function output(level, moduleName, message) {
      var icon = ICONS[level] || ICONS.info;
      var prefix = '[Hoard Run]';
      var moduleTag = moduleName ? ' [' + moduleName + ']' : '';
      var finalMessage = prefix + moduleTag + ' ' + icon + ' ' + message;
      log(finalMessage);
    }

    return {
      info: function (moduleName, message) {
        output('info', moduleName, message);
      },
      warn: function (moduleName, message) {
        output('warn', moduleName, message);
      },
      error: function (moduleName, message) {
        output('error', moduleName, message);
      },
      ready: function (moduleName, message) {
        output('ready', moduleName, message);
      },
      success: function (moduleName, message) {
        output('success', moduleName, message);
      }
    };
  }

  function register() {
    var logger = ensureLogger();
    logger.ready('LogManager', 'Log pipeline initialized (v' + VERSION + ').');
  }

  ensureLogger();

  return {
    register: register,
    getLogger: function () {
      return ensureLogger();
    }
  };

})();
