// ------------------------------------------------------------
// Room Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Controls corridor progression in a Hoard Run.
//   Handles room sequencing, reward payouts, miniboss/boss logic,
//   and triggers shop access at the right times.
//
//   Think of it as the "dungeon crawler" engine.
// ------------------------------------------------------------

var RoomManager = (function () {

  // ------------------------------------------------------------
  // Constants (temporary until moved to config/constants.js)
  // ------------------------------------------------------------
  var REWARDS = {
    room:     { scrip: 20, fse: 1 },
    miniboss: { scrip: 20, fse: 2, squareChance: 0.5 },
    boss:     { scrip: 40, fse: 5, squareChance: 0.5 },
    firstClearBonusFSE: 3
  };

  // ------------------------------------------------------------
  // Internal Helpers
  // ------------------------------------------------------------

  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    return player ? player.get('_displayname') : 'Player';
  }

  function sanitizeRoomType(roomType) {
    if (roomType === 'miniboss' || roomType === 'boss') {
      return roomType;
    }
    return 'room';
  }

  // ------------------------------------------------------------
  // Core Functions
  // ------------------------------------------------------------

  /**
   * Applies post-clear extras (Squares, totals) after the main bundle is handled by StateManager.
   * @param {string} playerid - Roll20 player ID.
   * @param {'room'|'miniboss'|'boss'} type - Room reward type.
   * @param {Object} totals - Currency totals after the base bundle was awarded.
   * @returns {{bundle: Object, totals: Object}}
   */
  function applyRewards(playerid, type, totals) {
    var roomType = sanitizeRoomType(type);
    var bundle = REWARDS[roomType] || REWARDS.room;

    if (bundle.squareChance && Math.random() < bundle.squareChance) {
      StateManager.addCurrency(playerid, 'squares', 1);
      if (typeof StateManager.getCurrencies === 'function') {
        totals = StateManager.getCurrencies(playerid);
      }
    }

    return {
      bundle: bundle,
      totals: totals
    };
  }

  /**
   * Advances to the next room in the corridor.
   * Triggers rewards and opens shops at milestones.
   */
  function advanceRoom(playerid, roomType) {
    var safeType = sanitizeRoomType(roomType);
    var rewardBundle = REWARDS[safeType] || REWARDS.room;

    var result = null;

    if (typeof StateManager.advanceRoom === 'function') {
      // Let StateManager do first-entry and room-count logic
      result = StateManager.advanceRoom(playerid, { scrip: rewardBundle.scrip, fse: rewardBundle.fse });
    } else {
      // Fallback legacy path (kept minimal, no UI)
      StateManager.initPlayer(playerid);
      var p = StateManager.getPlayer(playerid);
      if (!p.hasEnteredFirstRoom) {
        p.hasEnteredFirstRoom = true;
        if (StateManager.setPlayer) StateManager.setPlayer(playerid, p);
        return { firstEntry: true, player: p };
      }
      p.currentRoom = (p.currentRoom || 0) + 1;
      StateManager.addCurrency(playerid, 'scrip', rewardBundle.scrip);
      StateManager.addCurrency(playerid, 'fse', rewardBundle.fse);
      result = {
        firstEntry: false,
        clearedRoom: p.currentRoom,
        totals: (StateManager.getCurrencies) ? StateManager.getCurrencies(playerid) : { scrip: p.scrip, fse: p.fse },
        player: p
      };
    }

    // Apply post-clear squares only; still no UI.
    if (!result.firstEntry) {
      var totals = result.totals || { scrip: 0, fse: 0 };
      var r = applyRewards(playerid, safeType, totals);
      result.totals = r.totals || totals;
    }

    return result;
  }

  /**
   * Starts a new corridor run (resets counters).
   * @param {string} playerid
   */
  function startRun(playerid) {
    StateManager.initPlayer(playerid);
    if (typeof StateManager.resetPlayerRun === 'function') {
      StateManager.resetPlayerRun(playerid);
    } else {
      var p = StateManager.getPlayer(playerid);
      p.currentRoom = 0;
      p.scrip = 0;
      p.fse = 0;
      p.squares = 0;
      p.boons = [];
      p.relics = [];
      p.boonOffered = false;
      p.firstClearAwarded = false;
      p.hasEnteredFirstRoom = false;
    }

    UIManager.whisper(
      getPlayerName(playerid),
      'New Hoard Run',
      '⚔️ A new Hoard Run begins. Enter Room 1 when ready!'
    );
  }

  // ------------------------------------------------------------
  // Command Registration
  // ------------------------------------------------------------
  function register() {
    // intentionally disabled: RunFlowManager owns chat commands
    // (We leave RoomManager as a pure helper.)
  }

  return {
    startRun: startRun,
    advanceRoom: advanceRoom,
    applyRewards: applyRewards,
    register: register
  };

})();
