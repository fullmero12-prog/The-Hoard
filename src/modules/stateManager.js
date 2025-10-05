// ------------------------------------------------------------
// State Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Keeps track of everything that lasts through a run —
//   each player's currencies (Scrip, FSE, RerollTokens, Squares),
//   what Ancestor they picked, their boons and relics,
//   and the current room or floor they're on.
//
//   Think of it as the save-file for each player inside Roll20.
//
//   All data is stored inside Roll20's built-in `state` object,
//   which automatically saves between sessions.
// ------------------------------------------------------------

var StateManager = (function () {

  const DEFAULT_PLAYER_STATE = {
    ancestor_id: null,
    scrip: 0,
    fse: 0,
    squares: 0,
    rerollTokens: 0,
    boons: [],
    relics: [],
    currentRoom: 1,
    corridorLength: 6
  };

  /** Initializes the global storage if it doesn't exist */
  function init() {
    if (!state.HoardRun) {
      state.HoardRun = { players: {} };
      log("HoardRun state initialized.");
    }
  }

  /** Ensures a player entry exists */
  function initPlayer(playerid) {
    init();
    if (!state.HoardRun.players[playerid]) {
      state.HoardRun.players[playerid] = JSON.parse(JSON.stringify(DEFAULT_PLAYER_STATE));
      log(`Created new run data for player ${playerid}`);
    }
    return state.HoardRun.players[playerid];
  }

  /** Retrieves a player's saved data */
  function getPlayer(playerid) {
    initPlayer(playerid);
    return state.HoardRun.players[playerid];
  }

  /** Adds currency (Scrip, FSE, Squares, etc.) */
  function addCurrency(playerid, type, amount) {
    const p = getPlayer(playerid);
    if (p[type] !== undefined) {
      p[type] += amount;
      log(`${type} +${amount} for player ${playerid}`);
    }
  }

  /** Deducts Scrip for shop purchases */
  function spendScrip(playerid, amount) {
    const p = getPlayer(playerid);
    if (p.scrip >= amount) {
      p.scrip -= amount;
      return true;
    } else {
      sendChat("Hoard Run", `/w "${getObj('player', playerid).get('_displayname')}" Not enough Scrip!`);
      return false;
    }
  }

  /** Clears all data (use with care!) */
  function resetAll() {
    state.HoardRun = { players: {} };
    log("All HoardRun data cleared.");
  }

  /** Dumps a readable summary for GM */
  function debugPrint(playerid) {
    const p = getPlayer(playerid);
    let summary = `Scrip: ${p.scrip}, FSE: ${p.fse}, Squares: ${p.squares}, RerollTokens: ${p.rerollTokens}`;
    sendChat("Hoard Run", `/w gm ${summary}`);
  }

  // Public API
  return {
    init,
    initPlayer,
    getPlayer,
    addCurrency,
    spendScrip,
    resetAll,
    debugPrint
  };

})();
