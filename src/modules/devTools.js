// ------------------------------------------------------------
// Dev Tools Module
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides quick GM-only helpers for testing Hoard Run.
//   Lets you wipe saved data, inspect a player's state,
//   or spawn a mock shop without touching the main logic.
// ------------------------------------------------------------

var DevTools = (function () {

  var isRegistered = false;

  /**
   * Whisper a message to a specific player when possible.
   * Falls back to the GM whisper if the player lookup fails.
   */
  function whisperPlayer(playerid, message) {
    if (!playerid) {
      sendChat('Hoard Run', '/w gm ' + message);
      return;
    }

    var player = getObj('player', playerid);
    if (player) {
      sendChat('Hoard Run', '/w "' + player.get('displayname') + '" ' + message);
    } else {
      sendChat('Hoard Run', '/w gm ' + message);
    }
  }

  /**
   * Reset the entire Hoard Run state.
   * Clears all progress, currencies, boons, etc.
   */
  function resetState() {
    delete state.HoardRun;
    state.HoardRun = { players: {}, version: 'dev' };
    sendChat('Hoard Run', '/w gm ⚙️ HoardRun state has been reset.');
  }

  /**
   * Display current state for inspection.
   * Optionally target a specific player by name or ID.
   * Example: !debugstate Zephyr
   */
  function debugState(arg) {
    if (!state.HoardRun) {
      sendChat('Hoard Run', '/w gm No HoardRun state found.');
      return;
    }

    if (arg) {
      var players = findObjs({ _type: 'player' }) || [];
      var lowered = arg.toLowerCase();
      var i;
      for (i = 0; i < players.length; i += 1) {
        var p = players[i];
        var name = String(p.get('displayname') || '').toLowerCase();
        if (name.indexOf(lowered) !== -1 || p.id === arg) {
          var pState = null;
          if (
            typeof StateManager !== 'undefined' &&
            typeof StateManager.getPlayer === 'function'
          ) {
            pState = StateManager.getPlayer(p.id);
          } else if (state.HoardRun && state.HoardRun.players) {
            pState = state.HoardRun.players[p.id] || null;
          }
          sendChat('Hoard Run', '/w gm <pre>' + JSON.stringify(pState, null, 2) + '</pre>');
          return;
        }
      }
      sendChat('Hoard Run', '/w gm No player found matching "' + arg + '".');
    } else {
      sendChat('Hoard Run', '/w gm <pre>' + JSON.stringify(state.HoardRun, null, 2) + '</pre>');
    }
  }

  /**
   * Spawn a mock shop for testing.
   * Uses the current active player if possible.
   * Example: !testshop
   */
  function testShop() {
    var players = (findObjs({ _type: 'player' }) || []).filter(function (p) {
      return p.get('online');
    });
    if (!players.length) {
      sendChat('Hoard Run', '/w gm No online players to test shop.');
      return;
    }

    var player = players[0];
    var playerid = player.id;
    if (typeof ShopManager !== 'undefined' && ShopManager.generateShop) {
      var cards = ShopManager.generateShop(playerid);
      ShopManager.showShop(playerid, cards);
      sendChat('Hoard Run', '/w gm 🛒 Test shop generated for ' + player.get('displayname'));
    } else {
      sendChat('Hoard Run', '/w gm ⚠️ ShopManager not loaded or invalid.');
    }
  }

  /**
   * Command router
   */
  function handleInput(msg) {
    if (msg.type !== 'api') {
      return;
    }

    var content = (msg.content || '').trim();
    if (!content) {
      return;
    }

    if (typeof playerIsGM === 'function' && !playerIsGM(msg.playerid)) {
      whisperPlayer(msg.playerid, '⚠️ DevTools commands are GM-only.');
      return;
    }

    var spaceIdx = content.indexOf(' ');
    var command = spaceIdx === -1 ? content : content.slice(0, spaceIdx);
    var argString = spaceIdx === -1 ? '' : content.slice(spaceIdx + 1).trim();

    switch (command) {
      case '!resetstate':
        resetState();
        break;
      case '!debugstate':
        debugState(argString);
        break;
      case '!testshop':
        testShop();
        break;
    }
  }

  /**
   * Register event listeners.
   */
  function register() {
    if (isRegistered) {
      return;
    }
    on('chat:message', handleInput);
    sendChat('Hoard Run', '/w gm 🧰 DevTools loaded. Commands: !resetstate, !debugstate, !testshop');
    isRegistered = true;
  }

  return {
    register: register,
    resetState: resetState,
    debugState: debugState,
    testShop: testShop
  };
})();
