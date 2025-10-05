// ------------------------------------------------------------
// Hoard Run – Main Entry Point
// ------------------------------------------------------------
// What this does (in simple terms):
//   Loads and initializes all Hoard Run modules when the Roll20
//   sandbox is ready. Sets up the state object, registers commands,
//   and confirms successful initialization in chat.
//
//   This is the "glue" that connects all managers.
// ------------------------------------------------------------

var HoardRun = HoardRun || {};

on('ready', function () {
  // ----------------------------------------------------------
  // Version & Environment
  // ----------------------------------------------------------
  HoardRun.VERSION = '1.0.0';
  HoardRun.BUILD_DATE = '2025-10-04';
  log('=== Hoard Run v' + HoardRun.VERSION + ' initialized ===');

  // ----------------------------------------------------------
  // Safety: Ensure global state exists
  // ----------------------------------------------------------
  if (!state.HoardRun) {
    state.HoardRun = {
      players: {},
      shop: {},
      corridor: {},
      meta: { runs: 0 }
    };
    log('HoardRun state initialized.');
  }

  // ----------------------------------------------------------
  // Module Initialization Order
  // ----------------------------------------------------------
  try {
    if (
      typeof StateManager !== 'undefined' &&
      typeof StateManager.registerCommands === 'function'
    ) {
      StateManager.registerCommands();
    }
    if (
      typeof DeckManager !== 'undefined' &&
      typeof DeckManager.registerCommands === 'function'
    ) {
      DeckManager.registerCommands();
    }
    if (typeof UIManager !== 'undefined') log('UIManager loaded.');
    if (
      typeof RoomManager !== 'undefined' &&
      typeof RoomManager.registerCommands === 'function'
    ) {
      RoomManager.registerCommands();
    }
    if (
      typeof BoonManager !== 'undefined' &&
      typeof BoonManager.registerCommands === 'function'
    ) {
      BoonManager.registerCommands();
    }
    if (
      typeof ShopManager !== 'undefined' &&
      typeof ShopManager.registerCommands === 'function'
    ) {
      ShopManager.registerCommands();
    }
    if (
      typeof DevTools !== 'undefined' &&
      typeof DevTools.register === 'function'
    ) {
      DevTools.register();
    }
  } catch (err) {
    log('\u26a0\ufe0f HoardRun init error: ' + err);
  }

  // ----------------------------------------------------------
  // Welcome Message for GM & Players
  // ----------------------------------------------------------
  var msg =
    '<div style="border:1px solid #555;background:#111;padding:6px;color:#eee;">' +
    '<b style="color:#c2a347;">Hoard Run v' + HoardRun.VERSION + '</b><br>' +
    'Modules loaded: State, Deck, UI, Room, Shop, Boon.<br><br>' +
    'Commands:<br>' +
    '\u2022 <b>!startrun</b> – Begin a new Hoard Run<br>' +
    '\u2022 <b>!nextr room|miniboss|boss</b> – Advance to next room<br>' +
    '\u2022 <b>!openshop</b> – Open Bing, Bang & Bongo shop<br>' +
    '\u2022 <b>!offerboons [Ancestor]</b> – Offer boon choices<br>' +
    '\u2022 <b>!chooseboon [CardID]</b> – Choose a boon<br>' +
    '\u2022 <b>!tradeSquares scrip|fse</b> – Trade Squares<br><br>' +
    '<span style="color:#888;">Roll20 API sandbox ready.</span>' +
    '</div>';

  sendChat('Hoard Run', '/w gm ' + msg);
});
