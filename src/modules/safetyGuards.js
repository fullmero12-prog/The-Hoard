// ------------------------------------------------------------
// Safety Guards Module
// ------------------------------------------------------------
// What this does (in simple terms):
//   Installs global helpers that keep Roll20 chat output safe.
//   Provides a GM-only check, plus a rate-limited chat wrapper
//   so bursty modules do not flood the API sandbox.
// ------------------------------------------------------------

var SafetyGuards = (function () {
  var VERSION = '1.0.0';
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;

  /**
   * Installs a global GM helper that falls back gracefully when the
   * Roll20-provided playerIsGM utility is unavailable (such as in the
   * one-click install sandbox).
   */
  function installGMGuard() {
    root.isGM = function (playerid) {
      return typeof playerIsGM === 'function' ? playerIsGM(playerid) : true;
    };
  }

  /**
   * Installs a global Hoard Run chat wrapper that throttles chat bursts.
   * Ensures all modules queue messages instead of blasting sendChat
   * repeatedly within the same tick (a common cause of sandbox freezes).
   */
  function installChatLimiter() {
    if (root.HRChat && root.HRChat.__isLimiter) {
      return;
    }

    root.HRChat = (function () {
      var q = [];
      var t = null;
      var RATE_MS = 350; // ~3 messages per second

      function pump() {
        if (!q.length) {
          clearInterval(t);
          t = null;
          return;
        }
        var m = q.shift();
        sendChat('Hoard Run', m);
      }

      function ensurePump() {
        if (!t) {
          t = setInterval(pump, RATE_MS);
        }
      }

      return {
        say: function (msg) {
          q.push(msg);
          ensurePump();
        },
        direct: function (html) {
          q.push('/direct ' + html);
          ensurePump();
        },
        __isLimiter: true
      };
    })();
  }

  function register() {
    installGMGuard();
    installChatLimiter();
    log('=== Safety Guards ' + VERSION + ' active ===');
  }

  return {
    register: register
  };
})();
