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
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('StateManager', message);
    } else {
      log('[Hoard Run] [StateManager] ℹ️ ' + message);
    }
  }

  var DEFAULT_PLAYER_STATE = {
    focus: null,
    ancestor_id: null,
    boundCharacterId: null,
    currentRoom: 0,
    stage: 'pre-room',
    scrip: 0,
    fse: 0,
    squares: 0,
    rerollTokens: 0,
    firstClearAwarded: false,
    boons: [],
    relics: [],
    upgrades: []
  };

  function cloneDefaultPlayerState() {
    return JSON.parse(JSON.stringify(DEFAULT_PLAYER_STATE));
  }

  function normalizeRelicList(entries) {
    var normalized = [];
    var seen = {};

    if (!entries || !Array.isArray(entries)) {
      return normalized;
    }

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var id = null;

      if (typeof entry === 'string' || typeof entry === 'number') {
        id = String(entry);
      } else if (entry && typeof entry === 'object' && entry.id) {
        id = String(entry.id);
      }

      if (!id || seen[id]) {
        continue;
      }

      seen[id] = true;
      normalized.push(id);
    }

    return normalized;
  }

  function applyDefaultStateShape(playerState) {
    var defaults = cloneDefaultPlayerState();
    var result = playerState || {};
    var key;

    for (key in defaults) {
      if (defaults.hasOwnProperty(key) && typeof result[key] === 'undefined') {
        result[key] = defaults[key];
      }
    }

    result.relics = normalizeRelicList(result.relics);

    return result;
  }

  /** Initializes the global storage if it doesn't exist */
  function init() {
    if (!state.HoardRun) {
      state.HoardRun = { players: {}, shops: {} };
      info('Created HoardRun state container.');
    } else {
      if (!state.HoardRun.players) {
        state.HoardRun.players = {};
      }
      if (!state.HoardRun.shops) {
        state.HoardRun.shops = {};
      }
    }
  }

  /** Ensures a player entry exists */
  function initPlayer(playerid) {
    init();
    if (!state.HoardRun.players[playerid]) {
      state.HoardRun.players[playerid] = cloneDefaultPlayerState();
      info('Created new run data for player ' + playerid + '.');
    } else {
      state.HoardRun.players[playerid] = applyDefaultStateShape(state.HoardRun.players[playerid]);
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
    var existing = state.HoardRun.players[playerid] || cloneDefaultPlayerState();
    var merged = {};
    var key;

    for (key in existing) {
      if (existing.hasOwnProperty(key)) {
        merged[key] = existing[key];
      }
    }

    if (payload) {
      for (key in payload) {
        if (payload.hasOwnProperty(key)) {
          merged[key] = payload[key];
        }
      }
    }

    state.HoardRun.players[playerid] = applyDefaultStateShape(merged);
    return state.HoardRun.players[playerid];
  }

  function getRelicIds(playerid) {
    var p = getPlayer(playerid);
    return normalizeRelicList(p.relics);
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
      info('Currency ' + type + ' +' + delta + ' for player ' + playerid + '.');
    }
  }

  /** Resets a player's corridor progress and currencies */
  function resetPlayerRun(playerid) {
    init();

    var existing = state.HoardRun.players[playerid] || null;
    if (
      existing &&
      existing.boundCharacterId &&
      typeof SpellbookHelper !== 'undefined' &&
      SpellbookHelper &&
      typeof SpellbookHelper.removeAlwaysPreparedForCharacter === 'function'
    ) {
      SpellbookHelper.removeAlwaysPreparedForCharacter(existing.boundCharacterId);
    }

    if (
      existing &&
      existing.boundCharacterId &&
      typeof EffectEngine !== 'undefined' &&
      EffectEngine &&
      typeof EffectEngine.wipeCharacter === 'function'
    ) {
      EffectEngine.wipeCharacter(existing.boundCharacterId);
    }

    var fresh = cloneDefaultPlayerState();
    state.HoardRun.players[playerid] = fresh;
    return state.HoardRun.players[playerid];
  }

  /**
   * Returns a list of players currently bound to a given character.
   * @param {string} characterId
   * @return {Array<{id: string, state: object}>}
   */
  function findPlayersByCharacter(characterId) {
    init();

    var matches = [];
    if (!characterId) {
      return matches;
    }

    var players = state.HoardRun.players || {};
    for (var pid in players) {
      if (!players.hasOwnProperty(pid)) {
        continue;
      }

      var ps = applyDefaultStateShape(players[pid]);
      if (ps && ps.boundCharacterId === characterId) {
        matches.push({ id: pid, state: ps });
      }
    }

    return matches;
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
      stage: p.stage || 'pre-room'
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

    var stage = p.stage || 'pre-room';
    if (stage === 'pre-room') {
      p.stage = 'in-room';
      setPlayer(playerid, p);
      return {
        firstEntry: true,
        clearedRoom: p.currentRoom,
        totals: getCurrencies(playerid),
        player: p
      };
    }

    var current = normalizeNumber(p.currentRoom);
    current += 1;
    p.currentRoom = current;

    if (bundle) {
      applyCurrencyBundle(playerid, bundle);
    }

    setPlayer(playerid, p);

    return {
      firstEntry: false,
      clearedRoom: p.currentRoom,
      totals: getCurrencies(playerid),
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
    state.HoardRun = { players: {}, shops: {} };
    info('All HoardRun data cleared.');
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
    findPlayersByCharacter: findPlayersByCharacter,
    resetPlayerRun: resetPlayerRun,
    setCurrentRoom: setCurrentRoom,
    incrementRoom: incrementRoom,
    getCorridor: getCorridor,
    applyCurrencyBundle: applyCurrencyBundle,
    advanceRoom: advanceRoom,
    getCurrencies: getCurrencies,
    getRelicIds: getRelicIds,
    spendScrip: spendScrip,
    resetAll: resetAll,
    debugPrint: debugPrint
  };

})();
