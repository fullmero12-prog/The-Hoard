// ------------------------------------------------------------
// main.js — Hoard Run Unified Bootstrap
// ------------------------------------------------------------
// Purpose:
//   Centralized system startup for all Hoard Run modules.
//   Ensures consistent load order, prevents duplicate "on ready"
//   executions, and logs cleanly to both GM chat & API console.
// ------------------------------------------------------------

on('ready', function () {
  var VERSION = 'v1.0.1';
  var MODULES = [
    'StateManager',
    'DeckManager',
    'UIManager',
    'BoonManager',
    'ShopManager',
    'RoomManager',
    'EventManager',
    'DevTools'
  ];

  // ------------------------------------------------------------
  // Initialize global state if missing
  // ------------------------------------------------------------
  if (!state.HoardRun) {
    state.HoardRun = {
      version: VERSION,
      players: {},
      initialized: false
    };
    log('[Hoard Run] Created new state.HoardRun.');
  }

  // ------------------------------------------------------------
  // Prevent duplicate initialization
  // ------------------------------------------------------------
  if (state.HoardRun.initialized) {
    log('[Hoard Run] Sandbox reloaded — modules already initialized.');
    return;
  }

  log('=== Hoard Run ' + VERSION + ' initializing... ===');

  // ------------------------------------------------------------
  // Register all modules if available
  // ------------------------------------------------------------
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;

  MODULES.forEach(function (moduleName) {
    try {
      var moduleRef = root[moduleName];
      if (moduleRef && typeof moduleRef.register === 'function') {
        moduleRef.register();
        log('[Hoard Run] ' + moduleName + ' registered.');
      } else if (moduleRef && typeof moduleRef.init === 'function') {
        moduleRef.init();
        log('[Hoard Run] ' + moduleName + ' initialized.');
      } else {
        log('[Hoard Run] ⚠️ ' + moduleName + ' not found or missing register/init.');
      }
    } catch (err) {
      log('[Hoard Run] ❌ Error loading ' + moduleName + ': ' + err);
    }
  });

  // ------------------------------------------------------------
  // Mark as initialized
  // ------------------------------------------------------------
  state.HoardRun.initialized = true;

  // ------------------------------------------------------------
  // Send confirmation to GM
  // ------------------------------------------------------------
  var gmMessage = '' +
    '<div style="border:1px solid #333; padding:8px; background:#000; color:#ccc;">' +
    '<b>Hoard Run ' + VERSION + '</b><br>' +
    'Modules loaded: ' + MODULES.join(', ') + '.<br><br>' +
    '<u>Commands:</u><br>' +
    '• <b>!startrun</b> – Begin a new Hoard Run<br>' +
    '• <b>!nextr room|miniboss|boss</b> – Advance to next room<br>' +
    '• <b>!openshop</b> – Open Bing, Bang & Bongo Shop<br>' +
    '• <b>!offerboons [Ancestor]</b> – Offer boon choices<br>' +
    '• <b>!chooseboon [CardID]</b> – Choose a boon<br>' +
    '• <b>!tradeSquares scrip|fse</b> – Trade Squares<br><br>' +
    'Roll20 API sandbox ready.' +
    '</div>';

  sendChat('Hoard Run', '/w gm ' + gmMessage);

  log('=== Hoard Run ' + VERSION + ' initialized successfully ===');
});
