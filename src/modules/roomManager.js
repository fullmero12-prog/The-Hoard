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
   * Applies reward bundle based on room type.
   * @param {string} playerid - Roll20 player ID.
   * @param {'room'|'miniboss'|'boss'} type - Room reward type.
   */
  function applyRewards(playerid, type) {
    var roomType = sanitizeRoomType(type);
    var bundle = REWARDS[roomType] || REWARDS.room;

    StateManager.addCurrency(playerid, 'scrip', bundle.scrip);
    StateManager.addCurrency(playerid, 'fse', bundle.fse);

    if (bundle.squareChance && Math.random() < bundle.squareChance) {
      StateManager.addCurrency(playerid, 'squares', 1);
      UIManager.whisper(getPlayerName(playerid), 'Treasure', '✦ You found a Square!');
    }
  }

  /**
   * Advances to the next room in the corridor.
   * Triggers rewards and opens shops at milestones.
   */
  function advanceRoom(playerid, roomType) {
    var safeType = sanitizeRoomType(roomType);
    var bundle = REWARDS[safeType] || REWARDS.room;
    var playerName = getPlayerName(playerid);

    StateManager.initPlayer(playerid);

    var playerState = StateManager.getPlayer(playerid);
    if (!playerState.hasEnteredFirstRoom) {
      playerState.hasEnteredFirstRoom = true;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, playerState);
      }
      UIManager.whisper(
        playerName,
        'Room 1 Ready',
        '⚔️ The first chamber opens. Clear it, then use !nextr again to claim rewards.'
      );
      return;
    }

    var clearedRoom = 0;
    if (typeof StateManager.incrementRoom === 'function') {
      clearedRoom = StateManager.incrementRoom(playerid);
    } else {
      playerState.currentRoom = (playerState.currentRoom || 0) + 1;
      clearedRoom = playerState.currentRoom;
    }

    applyRewards(playerid, safeType);

    var p = StateManager.getPlayer(playerid);

    var totals = typeof StateManager.getCurrencies === 'function'
      ? StateManager.getCurrencies(playerid)
      : { scrip: p.scrip, fse: p.fse };

    UIManager.whisper(
      playerName,
      'Room ' + clearedRoom + ' Cleared',
      '➤ +' + bundle.scrip + ' Scrip, +' + bundle.fse + ' FSE.<br>' +
      'Total — Scrip: <b>' + totals.scrip + '</b> | FSE: <b>' + totals.fse + '</b>'
    );

    try {
      if (typeof BoonManager !== 'undefined' && typeof BoonManager.offerBoons === 'function') {
        if (safeType === 'room' || safeType === 'miniboss') {
          BoonManager.offerBoons(playerid);
          UIManager.whisper(
            playerName,
            'Boon Offer',
            '🪄 A mysterious force offers you a new Boon...'
          );
        }
      } else {
        UIManager.gmLog('BoonManager not available or missing offerBoons().');
      }
    } catch (err) {
      UIManager.gmLog('Error offering Boons: ' + err);
    }

    if (p.currentRoom === 3) {
      UIManager.whisper(
        playerName,
        'Shop Available',
        '🛒 Bing, Bang & Bongo await! Use !openshop.'
      );
      UIManager.gmLog('Shop available after Room 3. Move to Shop page to open.');
    }

    if (p.currentRoom === 5) {
      UIManager.whisper(
        playerName,
        'Optional Shop',
        '🛒 Optional shop unlocked. Use !openshop if desired.'
      );
      UIManager.gmLog('Optional shop available after Room 5. Move to Shop page to open.');
    }

    if (safeType === 'boss' && !p.firstClearAwarded) {
      StateManager.addCurrency(playerid, 'fse', REWARDS.firstClearBonusFSE);
      p.firstClearAwarded = true;
      UIManager.whisper(
        getPlayerName(playerid),
        'First Clear Bonus',
        '✪ +' + REWARDS.firstClearBonusFSE + ' FSE.'
      );
    }
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
    on('chat:message', function (msg) {
      if (msg.type !== 'api') {
        return;
      }
      var args = msg.content.split(' ');
      var cmd = args[0];

      if (cmd === '!nextr') {
        var type = args[1] || 'room';
        advanceRoom(msg.playerid, type);
      }
    });
  }

  return {
    startRun: startRun,
    advanceRoom: advanceRoom,
    applyRewards: applyRewards,
    register: register
  };

})();
