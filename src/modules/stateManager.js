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
    upgrades: [],
    focus: "Staff",
    currentRoom: 1,
    corridorLength: 6
  };

  /** Initializes the global storage if it doesn't exist */
  function init() {
    if (!state.HoardRun) {
      state.HoardRun = { players: {}, shop: {} };
      log("HoardRun state initialized.");
    } else if (!state.HoardRun.shop) {
      state.HoardRun.shop = {};
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

  /** Persists a player's data back into state */
  function setPlayer(playerid, payload) {
    init();
    if (!state.HoardRun.players) {
      state.HoardRun.players = {};
    }
    state.HoardRun.players[playerid] = payload;
    return state.HoardRun.players[playerid];
  }

  /** Ensures currency math always uses whole numbers */
  function normalizeNumber(value) {
    var num = parseInt(value, 10);
    if (isNaN(num)) {
      num = 0;
    }
    return num;
  }

  /** Adds currency (Scrip, FSE, Squares, etc.) */
  function addCurrency(playerid, type, amount) {
    const p = getPlayer(playerid);
    if (p[type] !== undefined) {
      const current = normalizeNumber(p[type]);
      const delta = normalizeNumber(amount);
      p[type] = current + delta;
      log(`${type} +${delta} for player ${playerid}`);
    }
  }

  /** Deducts Scrip for shop purchases */
  function spendScrip(playerid, amount) {
    const p = getPlayer(playerid);
    const current = normalizeNumber(p.scrip);
    const cost = normalizeNumber(amount);
    if (current >= cost) {
      p.scrip = current - cost;
      return true;
    } else {
      const player = getObj('player', playerid);
      const name = player ? player.get('_displayname') : 'Player';
      sendChat("Hoard Run", `/w "${name}" Not enough Scrip!`);
      return false;
    }
  }

  /** Clears all data (use with care!) */
  function resetAll() {
    state.HoardRun = { players: {}, shop: {} };
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
    setPlayer,
    addCurrency,
    spendScrip,
    resetAll,
    debugPrint
  };

})();
