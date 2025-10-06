// ------------------------------------------------------------
// Room Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides pure helpers for corridor progression.
//   Handles reward bundle lookups and communicates with StateManager
//   without sending UI or chat output directly.
// ------------------------------------------------------------

var RoomManager = (function () {

  // ------------------------------------------------------------
  // Constants (temporary until moved to config/constants.js)
  // ------------------------------------------------------------
  var FIRST_CLEAR_BONUS_FSE = 3;

  var REWARDS = {
    room:     { scrip: 20, fse: 1 },
    miniboss: { scrip: 20, fse: 2, squareChance: 0.5 },
    boss:     { scrip: 40, fse: 5, squareChance: 0.5 }
  };

  // ------------------------------------------------------------
  // Internal Helpers
  // ------------------------------------------------------------

  function sanitizeRoomType(type) {
    return (type === 'miniboss' || type === 'boss') ? type : 'room';
  }

  // ------------------------------------------------------------
  // Core Functions
  // ------------------------------------------------------------

  /**
   * Applies post-clear extras (Squares, totals) after the main bundle is handled by StateManager.
   * Pure helper — no UI.
   * @param {string} playerid - Roll20 player ID.
   * @param {'room'|'miniboss'|'boss'} type - Room reward type.
   * @param {Object} totals - Currency totals after the base bundle was awarded.
   * @returns {{bundle: Object, totals: Object}}
   */
  function applyRewards(playerid, type, totals) {
    var bundle = REWARDS[sanitizeRoomType(type)] || REWARDS.room;

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
   * Pure helper — no UI.
   */
  function advanceRoom(playerid, roomType) {
    var safeType = sanitizeRoomType(roomType);
    var reward = REWARDS[safeType] || REWARDS.room;

    var res;
    if (typeof StateManager.advanceRoom === 'function') {
      res = StateManager.advanceRoom(playerid, { scrip: reward.scrip, fse: reward.fse });
    } else {
      StateManager.initPlayer(playerid);
      var p = StateManager.getPlayer(playerid);
      if (!p.hasEnteredFirstRoom) {
        p.hasEnteredFirstRoom = true;
        if (StateManager.setPlayer) StateManager.setPlayer(playerid, p);
        return { firstEntry: true, player: p };
      }
      p.currentRoom = (p.currentRoom || 0) + 1;
      StateManager.addCurrency(playerid, 'scrip', reward.scrip);
      StateManager.addCurrency(playerid, 'fse', reward.fse);
      res = {
        firstEntry: false,
        clearedRoom: p.currentRoom,
        totals: (typeof StateManager.getCurrencies === 'function')
          ? StateManager.getCurrencies(playerid)
          : { scrip: p.scrip, fse: p.fse },
        player: p
      };
    }

    if (!res.firstEntry) {
      var totals = res.totals || { scrip: 0, fse: 0 };
      var r = applyRewards(playerid, safeType, totals);
      res.totals = r.totals || totals;
    }

    // --- First-clear (boss) bonus handling — engine only, no UI here ---
    try {
      // get the freshest player snapshot for flags/totals
      var p = res.player || (typeof StateManager.getPlayer === 'function' ? StateManager.getPlayer(playerid) : null);

      if (safeType === 'boss' && p && !p.firstClearAwarded) {
        // mark flag
        p.firstClearAwarded = true;
        if (typeof StateManager.setPlayer === 'function') {
          StateManager.setPlayer(playerid, p);
        }

        // award +FSE and refresh totals
        if (typeof StateManager.addCurrency === 'function') {
          StateManager.addCurrency(playerid, 'fse', FIRST_CLEAR_BONUS_FSE);
        } else {
          // legacy fallback – mutate the snapshot
          p.fse = (p.fse || 0) + FIRST_CLEAR_BONUS_FSE;
        }

        // attach info for UI layer
        res.firstClearBonusFSE = FIRST_CLEAR_BONUS_FSE;

        // ensure result.totals reflects the added FSE
        if (typeof StateManager.getCurrencies === 'function') {
          res.totals = StateManager.getCurrencies(playerid);
        } else {
          res.totals = res.totals || { scrip: p.scrip || 0, fse: p.fse || 0 };
        }
      }
    } catch (e) {
      if (typeof UIManager !== 'undefined' && UIManager.gmLog) {
        UIManager.gmLog('RoomManager first-clear bonus error: ' + e);
      }
    }

    return res;
  }

  /**
   * Starts a new corridor run (resets counters) without UI side effects.
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
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, p);
      }
    }
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
