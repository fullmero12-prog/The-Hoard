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
    room:     { scrip: 30, fse: 1, squareChance: 0.33 },
    miniboss: { scrip: 35, fse: 2, squareChance: 0.5 },
    boss:     { scrip: 55, fse: 5, squareChance: 0.5 }
  };

  var ROOM_SCRIP_TABLE = [
    { amount: 20, weight: 1 },
    { amount: 25, weight: 2 },
    { amount: 30, weight: 3 },
    { amount: 35, weight: 2 },
    { amount: 40, weight: 1 }
  ];

  var MINIBOSS_SCRIP_TABLE = [
    { amount: 30, weight: 2 },
    { amount: 35, weight: 3 },
    { amount: 40, weight: 3 },
    { amount: 45, weight: 2 }
  ];

  var BOSS_SCRIP_TABLE = [
    { amount: 45, weight: 2 },
    { amount: 55, weight: 3 },
    { amount: 65, weight: 2 },
    { amount: 75, weight: 1 }
  ];

  var ROOM3_TARGET = { min: 50, max: 70 };

  function ensureShopAnnouncementState() {
    if (typeof StateManager !== 'undefined' && StateManager && typeof StateManager.init === 'function') {
      StateManager.init();
    } else if (typeof state !== 'undefined') {
      if (!state.HoardRun) {
        state.HoardRun = {};
      }
    }

    if (typeof state === 'undefined') {
      return null;
    }

    if (!state.HoardRun) {
      state.HoardRun = {};
    }

    if (!state.HoardRun.shopAnnouncements) {
      state.HoardRun.shopAnnouncements = {};
    }

    return state.HoardRun.shopAnnouncements;
  }

  function getRunSessionId() {
    if (typeof state !== 'undefined' && state.HoardRun && state.HoardRun.runFlow && state.HoardRun.runFlow.sessionId) {
      return state.HoardRun.runFlow.sessionId;
    }
    return 0;
  }

  function shouldNotifyShop(roomNumber) {
    var store = ensureShopAnnouncementState();
    if (!store) {
      return true;
    }

    var sessionId = getRunSessionId();
    if (!store.sessionId || store.sessionId !== sessionId) {
      store.sessionId = sessionId;
      store.cleared = {};
    }

    if (!store.cleared) {
      store.cleared = {};
    }

    var key = String(roomNumber);
    if (store.cleared[key]) {
      return false;
    }

    store.cleared[key] = true;
    return true;
  }

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
    return '<div><strong>' + title + '</strong><br>' + body + '</div>';
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

  function cloneRewardBundle(template) {
    return {
      scrip: template && template.scrip ? template.scrip : 0,
      fse: template && template.fse ? template.fse : 0,
      squareChance: template && typeof template.squareChance !== 'undefined' ? template.squareChance : 0
    };
  }

  function weightedPick(table) {
    if (!table || !table.length) {
      return 0;
    }
    var totalWeight = 0;
    for (var i = 0; i < table.length; i++) {
      totalWeight += table[i].weight;
    }
    if (totalWeight <= 0) {
      return table[0].amount;
    }
    var roll = Math.random() * totalWeight;
    var cursor = 0;
    for (var j = 0; j < table.length; j++) {
      cursor += table[j].weight;
      if (roll <= cursor) {
        return table[j].amount;
      }
    }
    return table[table.length - 1].amount;
  }

  function determineScripReward(playerid, playerState, type, template, currentCurrencies, roomNumberOverride) {
    var table = ROOM_SCRIP_TABLE;
    if (type === 'miniboss') {
      table = MINIBOSS_SCRIP_TABLE;
    }
    if (type === 'boss') {
      table = BOSS_SCRIP_TABLE;
    }

    var reward = weightedPick(table);
    if (!reward && template && template.scrip) {
      reward = template.scrip;
    }

    if (!playerState || playerState.stage !== 'in-room') {
      return Math.max(0, Math.round(reward));
    }

    var beforeScrip = currentCurrencies && typeof currentCurrencies.scrip !== 'undefined'
      ? currentCurrencies.scrip
      : (playerState.scrip || 0);
    var roomNumber = roomNumberOverride || ((playerState.currentRoom || 0) + 1);

    if (type === 'room' && roomNumber === 3) {
      var projected = beforeScrip + reward;
      if (projected < ROOM3_TARGET.min) {
        reward += (ROOM3_TARGET.min - projected);
      } else if (projected > ROOM3_TARGET.max) {
        var overshoot = projected - ROOM3_TARGET.max;
        reward = reward - overshoot;
      }
    }

    if (reward < 0) {
      reward = 0;
    }

    return Math.max(0, Math.round(reward));
  }

  function announceShop(playerid, phase, roomNumber) {
    if (!roomNumber) {
      return;
    }
    if (phase === 'clear' && (roomNumber === 3 || roomNumber === 5)) {
      if (shouldNotifyShop(roomNumber)) {
        var buttonHtml = '[Open Shop](!openshop)';
        if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.buttons === 'function') {
          buttonHtml = UIManager.buttons([{ label: 'Open Shop', command: 'openshop' }]);
        }
        var gmContent;
        if (roomNumber === 5) {
          gmContent = 'Room 5 concluded — Final Shop is live. This is the last visit before the boss.<br>' + buttonHtml;
        } else {
          gmContent = 'Room ' + roomNumber + ' cleared — open Bing, Bang & Bongo when the party is ready.<br>' + buttonHtml;
        }
        var gmMessage = formatPanel('Shop Ready', gmContent);
        if (typeof UIManager !== 'undefined' && UIManager && typeof UIManager.gmLog === 'function') {
          UIManager.gmLog(gmMessage);
        } else {
          sendChat('Hoard Run', '/w gm ' + gmMessage);
        }
      }
    }
    if (phase === 'enter' && roomNumber === 5) {
      whisperText(playerid, '🗣️ Social Encounter — spend this scene roleplaying with the corridor NPC. No combat this round.');
    }
    if (roomNumber === 3) {
      whisperText(playerid, '🛒 Shop Available — the GM can open Bing, Bang & Bongo with <b>!openshop</b>.');
    }
    if (phase === 'clear' && roomNumber === 5) {
      whisperText(playerid, '🛒 Final Shop unlocked — let the GM know when you are ready for one last browse before the boss.');
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
        body = '👑 The final chamber awaits.<br>Run the encounter, then the GM will advance once combat ends.';
      } else if (nextRoom === 5) {
        title = 'Room 5 — Social Encounter Ready';
        body = '🗣️ Gather for the social scene with the corridor\'s NPC guide.<br>No combat here — conclude the roleplay, then the GM will advance to unlock the Final Shop.';
      } else {
        body = '⚔️ Room ' + nextRoom + ' Ready.<br>Resolve the encounter, then the GM will advance once you are victorious.';
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

    var templateBundle = getRewardBundle(type);
    var bundle = cloneRewardBundle(templateBundle);
    var baseResult;

    if (StateManager.advanceRoom) {
      var currenciesBefore = StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : { scrip: 0 };
      bundle.scrip = determineScripReward(playerid, playerState, type, templateBundle, currenciesBefore);
      baseResult = StateManager.advanceRoom(playerid, {
        scrip: bundle.scrip,
        fse: bundle.fse
      });
    }

    if (!baseResult && StateManager.getPlayer) {
      var priorRoom = playerState.currentRoom || 0;
      var currenciesSnapshot = StateManager.getCurrencies ? StateManager.getCurrencies(playerid) : { scrip: 0 };
      if (!bundle.scrip) {
        bundle.scrip = determineScripReward(playerid, playerState, type, templateBundle, currenciesSnapshot, priorRoom + 1);
      }
      playerState.currentRoom = priorRoom + 1;
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
      whisperPanel(playerid, 'Room ' + nextRoom + ' Ready', '⚔️ Proceed into the chamber and the GM will advance after the fight.');
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
    if (type === 'room' && clearedRoom === 5) {
      summaryTitle = 'Social Encounter Concluded';
    }
    var summaryBody = summarizeRewards(type, bundle, bonusFSE, squareData.squareEarned, totals);
    if (type === 'room' && clearedRoom === 5) {
      summaryBody += '<br><br>🛒 Final Shop is available — Room 6 is the boss fight when you are ready.';
    }
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
