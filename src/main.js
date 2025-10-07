// ------------------------------------------------------------
// main.js — Hoard Run Unified Bootstrap
// ------------------------------------------------------------
// Purpose:
//   Centralized system startup for all Hoard Run modules.
//   Ensures consistent load order, prevents duplicate "on ready"
//   executions, and logs cleanly to both GM chat & API console.
// ------------------------------------------------------------

on('ready', function () {
  var VERSION = 'v1.1.0';
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('Bootstrap', message);
    } else {
      log('[Hoard Run] [Bootstrap] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('Bootstrap', message);
    } else {
      log('[Hoard Run] [Bootstrap] ⚠️ ' + message);
    }
  }

  function error(message) {
    if (logger && logger.error) {
      logger.error('Bootstrap', message);
    } else {
      log('[Hoard Run] [Bootstrap] ❌ ' + message);
    }
  }

  function ready(message) {
    if (logger && logger.ready) {
      logger.ready('Bootstrap', message);
    } else {
      log('[Hoard Run] [Bootstrap] ✅ ' + message);
    }
  }

  var MODULES = [
    'LogManager',
    'SafetyGuards',
    'StateManager',
    'DeckManager',
    'UIManager',
    'EffectRegistry',
    'EffectEngine',
    'BoonDataLoader',
    'BoonManager',
    'ShopManager',
    'RoomManager',
    'RunFlowManager',
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
    info('Created new state.HoardRun container.');
  }

  // ------------------------------------------------------------
  // Prevent duplicate initialization
  // ------------------------------------------------------------
  // Temporarily disabled guard to allow forced reinitialization during debugging.
  // if (state.HoardRun.initialized) {
  //   log('[Hoard Run] Sandbox reloaded — modules already initialized.');
  //   return;
  // }

  info('Initialization sequence started for Hoard Run ' + VERSION + '.');

  // ------------------------------------------------------------
  // Register all modules if available
  // ------------------------------------------------------------
    MODULES.forEach(function (moduleName) {
      try {
        var moduleRef = root[moduleName];
      if (moduleRef && typeof moduleRef.register === 'function') {
        moduleRef.register();
        info(moduleName + ' registered.');
      } else if (moduleRef && typeof moduleRef.init === 'function') {
        moduleRef.init();
        info(moduleName + ' initialized.');
      } else {
        warn(moduleName + ' not found or missing register/init.');
      }
    } catch (err) {
      error('Error loading ' + moduleName + ': ' + err);
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
    '• <b>!selectweapon [Weapon]</b> – Lock in starting focus<br>' +
    '• <b>!selectancestor [Name]</b> – Bind an Ancestor blessing<br>' +
    '• [Advance Room](!nextroom) – Progress core Hoard Run flow<br>' +
    '• <b>!nextr room|miniboss|boss</b> – Legacy room advancement<br>' +
    '• <b>!openshop</b> – Open Bing, Bang & Bongo Shop<br>' +
    '• <b>!offerboons [Ancestor]</b> – Offer boon choices<br>' +
    '• <b>!chooseboon [CardID]</b> – Choose a boon<br>' +
    '• <b>!tradeSquares scrip|fse</b> – Trade Squares<br><br>' +
    'Roll20 API sandbox ready.' +
    '</div>';

  if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
    HRChat.say('/w gm ' + gmMessage);
  } else {
    sendChat('Hoard Run', '/w gm ' + gmMessage);
  }

  ready('Hoard Run ' + VERSION + ' initialized successfully.');
});
