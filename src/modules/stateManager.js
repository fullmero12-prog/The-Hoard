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

  var DEFAULT_PLAYER_STATE = {
    ancestor_id: null,
    scrip: 0,
    fse: 0,
    squares: 0,
    rerollTokens: 0,
    boons: [],
    relics: [],
    upgrades: [],
    focus: 'Staff',
    currentRoom: 0,
    corridorLength: 6,
    hasEnteredFirstRoom: false,
    firstClearAwarded: false
  };

  /** Initializes the global storage if it doesn't exist */
  function init() {
    if (!state.HoardRun) {
      state.HoardRun = { players: {}, shop: {} };
      log('HoardRun state initialized.');
    } else if (!state.HoardRun.shop) {
      state.HoardRun.shop = {};
    }
  }

  /** Ensures a player entry exists */
  function initPlayer(playerid) {
    init();
    if (!state.HoardRun.players[playerid]) {
      state.HoardRun.players[playerid] = JSON.parse(JSON.stringify(DEFAULT_PLAYER_STATE));
      log('Created new run data for player ' + playerid);
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
    var p = getPlayer(playerid);
    if (p[type] !== undefined) {
      var current = normalizeNumber(p[type]);
      var delta = normalizeNumber(amount);
      p[type] = current + delta;
      log(type + ' +' + delta + ' for player ' + playerid);
    }
  }

  /** Resets a player's corridor progress and currencies */
  function resetPlayerRun(playerid) {
    var p = initPlayer(playerid);
    p.ancestor_id = null;
    p.focus = DEFAULT_PLAYER_STATE.focus;
    p.currentRoom = 0;
    p.scrip = 0;
    p.fse = 0;
    p.squares = 0;
    p.rerollTokens = 0;
    p.boons = [];
    p.relics = [];
    p.upgrades = [];
    p.hasEnteredFirstRoom = false;
    p.firstClearAwarded = false;
    return p;
  }

  /** Sets the current cleared room number */
  function setCurrentRoom(playerid, value) {
    var p = getPlayer(playerid);
    var room = normalizeNumber(value);
    p.currentRoom = room < 0 ? 0 : room;
    return p.currentRoom;
  }

  /** Increments the current room counter and returns the new value */
  function incrementRoom(playerid) {
    var p = getPlayer(playerid);
    var current = normalizeNumber(p.currentRoom);
    p.currentRoom = current + 1;
    return p.currentRoom;
  }

  /** Returns the player's corridor metadata */
  function getCorridor(playerid) {
    var p = getPlayer(playerid);
    return {
      currentRoom: normalizeNumber(p.currentRoom),
      corridorLength: normalizeNumber(p.corridorLength)
    };
  }

  /** Applies a bundle of currencies in one call */
  function applyCurrencyBundle(playerid, bundle) {
    if (!bundle) {
      return getCurrencies(playerid);
    }

    if (bundle.scrip) {
      addCurrency(playerid, 'scrip', bundle.scrip);
    }
    if (bundle.fse) {
      addCurrency(playerid, 'fse', bundle.fse);
    }
    if (bundle.squares) {
      addCurrency(playerid, 'squares', bundle.squares);
    }
    if (bundle.rerollTokens) {
      addCurrency(playerid, 'rerollTokens', bundle.rerollTokens);
    }

    return getCurrencies(playerid);
  }

  /**
   * Advances the corridor counter while handling the "first room" guard.
   * Returns metadata describing whether rewards should be applied.
   *
   * @param {string} playerid - Roll20 player ID
   * @param {Object} bundle - Currency rewards to apply once a room is cleared
   * @returns {{firstEntry: boolean, clearedRoom: number, totals: Object, player: Object}}
   */
  function advanceRoom(playerid, bundle) {
    var p = initPlayer(playerid);

    if (!p.hasEnteredFirstRoom) {
      p.hasEnteredFirstRoom = true;
      return {
        firstEntry: true,
        clearedRoom: 0,
        totals: getCurrencies(playerid),
        player: p
      };
    }

    var current = normalizeNumber(p.currentRoom);
    current += 1;
    p.currentRoom = current;

    var totals = bundle ? applyCurrencyBundle(playerid, bundle) : getCurrencies(playerid);

    return {
      firstEntry: false,
      clearedRoom: p.currentRoom,
      totals: totals,
      player: p
    };
  }

  /** Returns the player's current currency totals */
  function getCurrencies(playerid) {
    var p = getPlayer(playerid);
    return {
      scrip: normalizeNumber(p.scrip),
      fse: normalizeNumber(p.fse),
      squares: normalizeNumber(p.squares),
      rerollTokens: normalizeNumber(p.rerollTokens)
    };
  }

  /** Deducts Scrip for shop purchases */
  function spendScrip(playerid, amount) {
    var p = getPlayer(playerid);
    var current = normalizeNumber(p.scrip);
    var cost = normalizeNumber(amount);
    if (current >= cost) {
      p.scrip = current - cost;
      return true;
    } else {
      var player = getObj('player', playerid);
      var name = player ? player.get('_displayname') : 'Player';
      sendChat('Hoard Run', '/w "' + name + '" Not enough Scrip!');
      return false;
    }
  }

  /** Clears all data (use with care!) */
  function resetAll() {
    state.HoardRun = { players: {}, shop: {} };
    log('All HoardRun data cleared.');
  }

  /** Dumps a readable summary for GM */
  function debugPrint(playerid) {
    var p = getPlayer(playerid);
    var summary = 'Scrip: ' + p.scrip + ', FSE: ' + p.fse + ', Squares: ' + p.squares + ', RerollTokens: ' + p.rerollTokens;
    sendChat('Hoard Run', '/w gm ' + summary);
  }

  // Public API
  return {
    init: init,
    initPlayer: initPlayer,
    getPlayer: getPlayer,
    setPlayer: setPlayer,
    addCurrency: addCurrency,
    resetPlayerRun: resetPlayerRun,
    setCurrentRoom: setCurrentRoom,
    incrementRoom: incrementRoom,
    getCorridor: getCorridor,
    applyCurrencyBundle: applyCurrencyBundle,
    advanceRoom: advanceRoom,
    getCurrencies: getCurrencies,
    spendScrip: spendScrip,
    resetAll: resetAll,
    debugPrint: debugPrint
  };

})();
