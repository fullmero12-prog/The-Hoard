// ------------------------------------------------------------
// Event Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Watches for GM actions (like switching map pages) and
//   automatically triggers Hoard Run events such as
//   starting a run, advancing rooms, or opening shops.
//
//   In other words: the GM drives the story visually,
//   and this script keeps the system logic in sync.
// ------------------------------------------------------------

var EventManager = (function () {

  // ------------------------------------------------------------
  // Settings & Conventions
  // ------------------------------------------------------------
  var PAGE_TRIGGERS = {
    start: /^Start|Corridor-1/i,
    room: /^Room-/i,
    miniboss: /^Miniboss-/i,
    boss: /^Boss-/i,
    shop: /^Shop-/i
  };

  // Optional: whisper updates only to the GM
  var VERBOSE = true;

  // ------------------------------------------------------------
  // Utility Helpers
  // ------------------------------------------------------------

  /**
   * Gets all currently online players.
   * Used to initialize multiple players at run start.
   * @returns {object[]} Array of player objects.
   */
  function getActivePlayers() {
    return findObjs({ _type: 'player' }).filter(function (p) {
      return p.get('online');
    });
  }

  /**
   * Sends a message to the GM chat if verbose mode is on.
   * @param {string} msg
   */
  function gmLog(msg) {
    if (!VERBOSE) {
      return;
    }

    var payload = '/w gm ' + msg;
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say(payload);
    } else {
      sendChat('Hoard Run', payload);
    }
  }

  // ------------------------------------------------------------
  // Core Trigger Logic
  // ------------------------------------------------------------

  /**
   * Handles what happens when the GM changes map pages.
   * Detects page name and fires the correct module event.
   * @param {string} newPageId
   */
  function handlePageChange(newPageId) {
    var page = getObj('page', newPageId);
    if (!page) return;

    var name = page.get('name');
    if (!name) return;

    gmLog('📜 Detected page change: ' + name);

    // --- Start Run Trigger ---
    if (PAGE_TRIGGERS.start.test(name)) {
      gmLog('⚔️ Start page detected. Beginning new Hoard Run.');
      getActivePlayers().forEach(function (p) {
        if (typeof RoomManager !== 'undefined') RoomManager.startRun(p.id);
      });
      return;
    }

    // --- Regular Room ---
    if (PAGE_TRIGGERS.room.test(name)) {
      gmLog('➡️ Advancing to next room.');
      getActivePlayers().forEach(function (p) {
        if (typeof RoomManager !== 'undefined') RoomManager.advanceRoom(p.id, 'room');
      });
      return;
    }

    // --- Miniboss ---
    if (PAGE_TRIGGERS.miniboss.test(name)) {
      gmLog('💥 Miniboss encounter triggered.');
      getActivePlayers().forEach(function (p) {
        if (typeof RoomManager !== 'undefined') RoomManager.advanceRoom(p.id, 'miniboss');
      });
      return;
    }

    // --- Boss ---
    if (PAGE_TRIGGERS.boss.test(name)) {
      gmLog('👑 Boss room triggered.');
      getActivePlayers().forEach(function (p) {
        if (typeof RoomManager !== 'undefined') RoomManager.advanceRoom(p.id, 'boss');
      });
      return;
    }

    // --- Shop ---
    if (PAGE_TRIGGERS.shop.test(name)) {
      gmLog('🛒 Shop detected – invoking Bing, Bang & Bongo.');
      getActivePlayers().forEach(function (p) {
        if (typeof ShopManager !== 'undefined') {
          var cards = ShopManager.generateShop(p.id);
          ShopManager.showShop(p.id, cards);
        }
      });
      return;
    }
  }

  // ------------------------------------------------------------
  // Event Registration
  // ------------------------------------------------------------

  /**
   * Hooks into Roll20’s campaign page change event.
   */
  function registerPageWatcher() {
    on('change:campaign:playerpageid', function (obj, prev) {
      var newPageId = obj.get('playerpageid');
      if (newPageId !== prev.playerpageid) {
        handlePageChange(newPageId);
      }
    });
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  function register() {
    registerPageWatcher();
  }

  return {
    registerPageWatcher: registerPageWatcher,
    handlePageChange: handlePageChange,
    register: register
  };

})();
