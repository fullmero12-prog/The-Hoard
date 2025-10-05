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

  function gmSay(msg) {
    var payload = '/w gm ' + msg;
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say(payload);
    } else {
      sendChat('Hoard Run', payload);
    }
  }

  /**
   * Reset the entire Hoard Run state.
   * Clears all progress, currencies, boons, etc.
   */
  function resetState() {
    delete state.HoardRun;
    state.HoardRun = { players: {}, version: 'dev' };
    if (typeof RunFlowManager !== 'undefined' && typeof RunFlowManager.resetRunState === 'function') {
      RunFlowManager.resetRunState();
    }
    gmSay('⚙️ HoardRun state has been reset.');
  }

  /**
   * Display current state for inspection.
   * Optionally target a specific player by name or ID.
   * Example: !debugstate Zephyr
   */
  function debugState(arg) {
    if (!state.HoardRun) {
      gmSay('No HoardRun state found.');
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
          gmSay('<pre>' + JSON.stringify(pState, null, 2) + '</pre>');
          return;
        }
      }
      gmSay('No player found matching "' + arg + '".');
    } else {
      gmSay('<pre>' + JSON.stringify(state.HoardRun, null, 2) + '</pre>');
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
      gmSay('No online players to test shop.');
      return;
    }

    var player = players[0];
    var playerid = player.id;
    if (typeof ShopManager !== 'undefined' && ShopManager.generateShop) {
      var cards = ShopManager.generateShop(playerid);
      ShopManager.showShop(playerid, cards);
      gmSay('🛒 Test shop generated for ' + player.get('displayname'));
    } else {
      gmSay('⚠️ ShopManager not loaded or invalid.');
    }
  }

  /**
   * Draw a random relic using the current deck plumbing.
   * Helpful for verifying that the DeckManager fallback data
   * lines up with the Roll20 card decks.
   */
  function testRelicDraw() {
    if (typeof DeckManager === 'undefined' || typeof DeckManager.drawByRarity !== 'function') {
      gmSay('⚠️ DeckManager not available for relic draw test.');
      return;
    }

    var rarities = ['Common', 'Greater', 'Signature'];
    var index = randomInteger(rarities.length) - 1;
    var rarity = rarities[index];
    var relic = DeckManager.drawByRarity('Relics', rarity);

    if (!relic) {
      gmSay('⚠️ No relic available for rarity ' + rarity + '.');
      return;
    }

    var name = typeof relic.get === 'function' ? relic.get('name') : relic.name;
    gmSay('Drew a ' + rarity + ' relic: ' + name);
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
      case '!testrelic':
        testRelicDraw();
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
    gmSay('🧰 DevTools loaded. Commands: !resetstate, !debugstate, !testshop, !testrelic');
    isRegistered = true;
  }

  return {
    register: register,
    resetState: resetState,
    debugState: debugState,
    testShop: testShop,
    testRelicDraw: testRelicDraw
  };
})();
