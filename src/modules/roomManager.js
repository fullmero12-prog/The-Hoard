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
// First clear bonus for defeating a boss the first time.
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
/**
 * Advances to the next room in the corridor.
 * Triggers rewards, square chance, and shop unlock hints.
 * Pure engine result; no UI side-effects except whisper helpers by the caller.
 *
 * @param {string} playerid
 * @param {'room'|'miniboss'|'boss'} roomType
 * @returns {{
 *   firstEntry?: boolean,
 *   clearedRoom?: number,
 *   totals?: {scrip:number,fse:number},
 *   player?: Object,
 *   firstClearBonusFSE?: number
 * }}
 */
function advanceRoom(playerid, roomType) {
  var safeType     = sanitizeRoomType(roomType);
  var rewardBundle = REWARDS[safeType] || REWARDS.room;
  var result;

  // --- Preferred: delegate room counting + base rewards to StateManager ---
  if (typeof StateManager.advanceRoom === 'function') {
    result = StateManager.advanceRoom(playerid, {
      scrip: rewardBundle.scrip,
      fse:   rewardBundle.fse
    });

  } else {
    // --- Legacy fallback (keep minimal; no UI formatting here) ---
    StateManager.initPlayer(playerid);
    var p = StateManager.getPlayer(playerid);

    if (!p.hasEnteredFirstRoom) {
      p.hasEnteredFirstRoom = true;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, p);
      }
      return {
        firstEntry: true,
        player:     p,
        totals:     typeof StateManager.getCurrencies === 'function'
          ? StateManager.getCurrencies(playerid)
          : { scrip: p.scrip || 0, fse: p.fse || 0 }
      };
    }

    // clear a room + base rewards
    p.currentRoom = (p.currentRoom || 0) + 1;
    StateManager.addCurrency(playerid, 'scrip', rewardBundle.scrip);
    StateManager.addCurrency(playerid, 'fse',   rewardBundle.fse);

    result = {
      firstEntry:  false,
      clearedRoom: p.currentRoom,
      player:      p,
      totals:      typeof StateManager.getCurrencies === 'function'
        ? StateManager.getCurrencies(playerid)
        : { scrip: p.scrip || 0, fse: p.fse || 0 }
    };
  }

  // If we’re just entering Room 1, return early so caller can show "Room 1 Ready".
  if (result && result.firstEntry) {
    return result;
  }

  // --- Post-clear extras: roll Squares and refresh totals ---
  var post = applyRewards(playerid, safeType, result.totals || { scrip:0, fse:0 });
  result.totals = post.totals || result.totals;

  // --- Boss first-clear: +FSE and flag; UI announcement is the caller’s job ---
  try {
    var p2 = result.player || (typeof StateManager.getPlayer === 'function' ? StateManager.getPlayer(playerid) : null);

    if (safeType === 'boss' && p2 && !p2.firstClearAwarded) {
      p2.firstClearAwarded = true;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, p2);
      }

      if (typeof StateManager.addCurrency === 'function') {
        StateManager.addCurrency(playerid, 'fse', FIRST_CLEAR_BONUS_FSE);
      } else {
        p2.fse = (p2.fse || 0) + FIRST_CLEAR_BONUS_FSE;
      }

      result.firstClearBonusFSE = FIRST_CLEAR_BONUS_FSE;

      // ensure totals reflect the bonus
      result.totals = typeof StateManager.getCurrencies === 'function'
        ? StateManager.getCurrencies(playerid)
        : { scrip: (p2.scrip || 0), fse: (p2.fse || 0) };
    }
  } catch (e) {
    if (typeof UIManager !== 'undefined' && UIManager.gmLog) {
      UIManager.gmLog('RoomManager first-clear bonus error: ' + e);
    }
  }

  return result;
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
