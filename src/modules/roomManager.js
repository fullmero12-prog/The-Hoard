// ------------------------------------------------------------
// Room Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Coordinates room readiness and rewards for each player.
//   Talks to StateManager to update currencies/stages and whispers
//   the correct UI prompts for rooms, shops, boons, and boss clears.
// ------------------------------------------------------------

var RoomManager = (function () {

  var REWARDS = {
    room:     { scrip: 20, fse: 1 },
    miniboss: { scrip: 20, fse: 2, squareChance: 0.5 },
    boss:     { scrip: 40, fse: 5, squareChance: 0.5 }
  };

  function sanitizeRoomType(type) {
    return (type === 'miniboss' || type === 'boss') ? type : 'room';
  }

  function escapeHTML(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    if (player && player.get) {
      return player.get('_displayname');
    }
    return 'Player';
  }

  function formatPanel(title, body) {
    if (typeof UIManager !== 'undefined' && UIManager.panel) {
      return UIManager.panel(title, body);
    }
    return '**' + title + '**\n' + body;
  }

  function whisperPanel(playerid, title, body) {
    var name = String(getPlayerName(playerid) || 'Player').replace(/"/g, '\\"');
    var payload = formatPanel(title, body);
    sendChat('Hoard Run', '/w "' + name + '" ' + payload);
  }

  function whisperText(playerid, text) {
    var name = String(getPlayerName(playerid) || 'Player').replace(/"/g, '\\"');
    sendChat('Hoard Run', '/w "' + name + '" ' + text);
  }

  function getRewardBundle(type) {
    return REWARDS[sanitizeRoomType(type)] || REWARDS.room;
  }

  function announceShop(playerid, phase, roomNumber) {
    if (!roomNumber) {
      return;
    }
    if (roomNumber === 3) {
      whisperText(playerid, '🛒 Shop Available — the GM can open Bing, Bang & Bongo with <b>!openshop</b>.');
    }
    if (roomNumber === 5) {
      whisperText(playerid, '🛒 Optional Shop unlocked — ask the GM when you would like to browse.');
    }
  }

  function summarizeRewards(type, bundle, bonusFSE, squareEarned, totals) {
    var lines = [];
    lines.push('Rewards: +' + bundle.scrip + ' Scrip, +' + bundle.fse + ' FSE.');
    if (bonusFSE > 0) {
      lines.push('First Clear Bonus: +' + bonusFSE + ' FSE.');
    }
    if (squareEarned) {
      lines.push('✨ You found a Square!');
    }
    var totalsLine = 'Totals — Scrip: <b>' + (totals.scrip || 0) + '</b> | FSE: <b>' + (totals.fse || 0) + '</b> | Squares: <b>' + (totals.squares || 0) + '</b>';
    lines.push(totalsLine);
    return lines.join('<br>');
  }

  function rollForSquare(playerid, bundle, totals) {
    var earned = false;
    if (bundle.squareChance && Math.random() < bundle.squareChance) {
      StateManager.addCurrency(playerid, 'squares', 1);
      totals = StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : totals;
      earned = true;
    }
    return {
      totals: totals,
      squareEarned: earned
    };
  }

  function applyFirstClearBonus(playerid, playerState, type, bonus, totals) {
    var awarded = 0;
    if (type === 'boss' && playerState && !playerState.firstClearAwarded) {
      awarded = bonus || 0;
      if (awarded > 0) {
        StateManager.addCurrency(playerid, 'fse', awarded);
        totals = StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : totals;
      }
      playerState.firstClearAwarded = true;
    }
    return {
      totals: totals,
      bonus: awarded,
      player: playerState
    };
  }

  function advance(playerid, opts) {
    opts = opts || {};
    var type = sanitizeRoomType(opts.type);
    var playerState = StateManager.getPlayer ? StateManager.getPlayer(playerid) : null;
    if (!playerState && StateManager.initPlayer) {
      StateManager.initPlayer(playerid);
      playerState = StateManager.getPlayer ? StateManager.getPlayer(playerid) : null;
    }
    if (!playerState) {
      return null;
    }

    if (playerState.stage === 'awaiting-ancestor' && playerState.ancestor_id) {
      playerState.stage = 'pre-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }
    }

    var stage = playerState.stage || 'pre-room';
    var currentRoom = playerState.currentRoom || 0;
    var nextRoom = currentRoom + 1;

    if (stage === 'pre-room') {
      playerState.stage = 'in-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }

      var title = type === 'boss' ? 'Boss Room Ready' : 'Room ' + nextRoom + ' Ready';
      var body;
      if (type === 'boss') {
        body = '👑 The final chamber awaits.<br>Run the encounter, then the GM will use <b>!nextroom</b> to deliver rewards.';
      } else {
        body = '⚔️ Room ' + nextRoom + ' Ready.<br>Resolve the encounter, then the GM will advance with <b>!nextroom</b>.';
      }
      whisperPanel(playerid, title, body);
      announceShop(playerid, 'enter', nextRoom);
      return {
        status: 'ready',
        type: type,
        room: nextRoom,
        player: playerState
      };
    }

    if (stage !== 'in-room') {
      playerState.stage = 'pre-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }
      return {
        status: 'idle',
        type: type,
        room: currentRoom,
        player: playerState
      };
    }

    var bundle = getRewardBundle(type);
    var baseResult;

    if (StateManager.advanceRoom) {
      baseResult = StateManager.advanceRoom(playerid, {
        scrip: bundle.scrip,
        fse: bundle.fse
      });
    }

    if (!baseResult && StateManager.getPlayer) {
      playerState.currentRoom = (playerState.currentRoom || 0) + 1;
      StateManager.addCurrency(playerid, 'scrip', bundle.scrip);
      StateManager.addCurrency(playerid, 'fse', bundle.fse);
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }
      baseResult = {
        firstEntry: false,
        clearedRoom: playerState.currentRoom,
        player: playerState,
        totals: StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : {}
      };
    }

    if (!baseResult || baseResult.firstEntry) {
      // Safety: treat it as entering the room if state was out of sync.
      playerState.stage = 'in-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }
      whisperPanel(playerid, 'Room ' + nextRoom + ' Ready', '⚔️ Proceed into the chamber and the GM will use <b>!nextroom</b> after the fight.');
      announceShop(playerid, 'enter', nextRoom);
      return {
        status: 'ready',
        type: type,
        room: nextRoom,
        player: playerState
      };
    }

    playerState = baseResult.player || (StateManager.getPlayer ? StateManager.getPlayer(playerid) : playerState);
    var clearedRoom = baseResult.clearedRoom || (playerState.currentRoom || currentRoom + 1);
    var totals = baseResult.totals || (StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : {});

    var squareData = rollForSquare(playerid, bundle, totals);
    totals = squareData.totals;
    var bonusData = applyFirstClearBonus(playerid, playerState, type, opts.firstClearBonusFSE || 0, totals);
    totals = bonusData.totals;
    var bonusFSE = bonusData.bonus;

    playerState = bonusData.player || playerState;
    playerState.stage = 'pre-room';
    if (StateManager.setPlayer) {
      StateManager.setPlayer(playerid, playerState);
    }

    var summaryTitle = type === 'boss' ? 'Boss Defeated!' : 'Room ' + clearedRoom + ' Cleared';
    var summaryBody = summarizeRewards(type, bundle, bonusFSE, squareData.squareEarned, totals);
    whisperPanel(playerid, summaryTitle, summaryBody);

    if (opts.freeBoon && playerState.ancestor_id && typeof BoonManager !== 'undefined' && BoonManager.offerBoons) {
      BoonManager.offerBoons(playerid, playerState.ancestor_id, 'free');
    }

    announceShop(playerid, 'clear', clearedRoom);

    return {
      status: 'cleared',
      type: type,
      room: clearedRoom,
      totals: totals,
      squareEarned: squareData.squareEarned,
      firstClearBonusFSE: bonusFSE,
      player: playerState
    };
  }

  function startRun(playerid) {
    if (StateManager && StateManager.resetPlayerRun) {
      StateManager.resetPlayerRun(playerid);
    }
  }

  function advanceRoom(playerid, roomType) {
    var type = sanitizeRoomType(roomType);
    return advance(playerid, {
      type: type,
      freeBoon: true,
      firstClearBonusFSE: type === 'boss' ? 3 : 0
    });
  }

  function register() {
    // RunFlowManager owns chat commands; RoomManager stays as an engine helper.
  }

  return {
    startRun: startRun,
    advance: advance,
    advanceRoom: advanceRoom,
    register: register
  };

})();
