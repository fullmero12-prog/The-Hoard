// ------------------------------------------------------------
// Room Manager (pure helper)
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides corridor math for advancing rooms and awarding base
//   currencies. This module is UI-free and has no chat handlers.
//   RunFlowManager owns all chat/UI and boon/shop triggers.
// ------------------------------------------------------------

var RoomManager = (function () {
  // ---- constants -------------------------------------------------
  var REWARDS = {
    room:     { scrip: 20, fse: 1 },
    miniboss: { scrip: 20, fse: 2, squareChance: 0.5 },
    boss:     { scrip: 40, fse: 5, squareChance: 0.5 }
  };

  // ---- helpers ---------------------------------------------------
  function sanitizeRoomType(t) {
    return (t === 'miniboss' || t === 'boss') ? t : 'room';
  }

  /**
   * Apply post-clear extras (e.g., chance to add a Square).
   * Returns the bundle used and the updated totals.
   */
  function applyRewards(playerid, type, totals) {
    var bundle = REWARDS[sanitizeRoomType(type)] || REWARDS.room;

    if (bundle.squareChance && Math.random() < bundle.squareChance) {
      StateManager.addCurrency(playerid, 'squares', 1);
      if (typeof StateManager.getCurrencies === 'function') {
        totals = StateManager.getCurrencies(playerid);
      }
    }

    return { bundle: bundle, totals: totals };
  }

  /**
   * Advance one player by one room (or miniboss/boss).
   * PURE helper: no UI, no chat, no boon/shop prompts.
   *
   * Returns an object with:
   *   { firstEntry: bool,
   *     clearedRoom: number,
   *     totals: {scrip,fse},
   *     player: <playerState> }
   */
  function advanceRoom(playerid, roomType) {
    var safeType    = sanitizeRoomType(roomType);
    var rewardBundle = REWARDS[safeType] || REWARDS.room;

    var result = null;

    // Preferred path: delegate to StateManager if available.
    if (typeof StateManager.advanceRoom === 'function') {
      result = StateManager.advanceRoom(playerid, {
        scrip: rewardBundle.scrip,
        fse:   rewardBundle.fse
      });

    } else {
      // Fallback legacy path: keep minimal bookkeeping, no UI.
      StateManager.initPlayer(playerid);
      var p = StateManager.getPlayer(playerid);

      // First entry to Room 1 gate.
      if (!p.hasEnteredFirstRoom) {
        p.hasEnteredFirstRoom = true;
        if (typeof StateManager.setPlayer === 'function') {
          StateManager.setPlayer(playerid, p);
        }
        return { firstEntry: true, player: p };
      }

      // Normal clear.
      p.currentRoom = (p.currentRoom || 0) + 1;
      StateManager.addCurrency(playerid, 'scrip', rewardBundle.scrip);
      StateManager.addCurrency(playerid, 'fse',   rewardBundle.fse);

      result = {
        firstEntry : false,
        clearedRoom: p.currentRoom,
        totals     : (typeof StateManager.getCurrencies === 'function')
          ? StateManager.getCurrencies(playerid)
          : { scrip: p.scrip, fse: p.fse },
        player     : p
      };
    }

    // If it wasn’t just a “firstEntry” gate, apply extra rewards (Squares).
    if (!result.firstEntry) {
      var post = applyRewards(playerid, safeType, result.totals || { scrip: 0, fse: 0 });
      result.totals = post.totals;
    }

    return result;
  }

  // Intentionally no chat handlers — RunFlowManager owns commands.
  function register() { /* no-op */ }

  return {
    advanceRoom : advanceRoom,
    applyRewards: applyRewards,
    register    : register
  };
})();
