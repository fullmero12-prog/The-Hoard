// ------------------------------------------------------------
// Run Flow Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Directs the opening beats of a Hoard Run campaign.
//   Handles starting the run, weapon selection, ancestor binding,
//   introduces ancestors, and steady room progression with post-room boons.
//   Designed to complement existing managers (Boon/Event/Relic).
// ------------------------------------------------------------

var RunFlowManager = (function () {

  var VERSION = '1.1.0';
  var isRegistered = false;
  var _advancing = false;

  var DEFAULT_RUN_STATE = {
    started: false,
    lastPrompt: null,
    currentRoom: 0
  };

  var WEAPONS = ['Staff', 'Orb', 'Greataxe', 'Rapier', 'Bow'];

  // Only the 6 you actually have right now.
  // Empty arrays for the 3 melee/ranged weapons become “Coming soon”.
  var ANCESTOR_SETS = {
    Orb: ['Sutra Vayla', 'Azuren', 'Vladren Moroi'],
    Staff: ['Morvox, Tiny Tyrant', 'Lian Veilbinder', 'Seraphine Emberwright'],
    Greataxe: [],
    Rapier: [],
    Bow: []
  };

  var ANCESTOR_INFO = {
    'Azuren': {
      title: 'Azuren, Ascendant of the Endless Bolt',
      desc: 'Lightning artillery with Charges, line/burst nukes, and long-range Barrages.',
      refs: 'Azuren.md'
    },
    'Sutra Vayla': {
      title: 'Sutra Vayla, the Harmonized Mantra',
      desc: 'Mantra forms (Bolt/Bond/Ward) that add radiant splash, tethers, or warding temp HP/speed.',
      refs: 'Sutra Vayla.md'
    },
    'Vladren Moroi': {
      title: 'Vladren Moroi, the Crimson Tide',
      desc: 'Temp-HP engine; necrotic drain (Transfusion), damage shunts (Pool), and burst heal/damage.',
      refs: 'Vladren Moroi.md'
    },
    'Lian Veilbinder': {
      title: 'Lian the Veilbinder, Mistress of Mirrors',
      desc: 'Stack Veils via spells/hits; invis on demand; Detonate to blind/stun with psychic damage.',
      refs: 'Lian Veilbinder.md'
    },
    'Morvox, Tiny Tyrant': {
      title: 'Morvox, Tiny Tyrant of the Umbral Staff',
      desc: 'Build Malice from spell hits/fails; Dark Star + Event Horizon control; big single-target burst.',
      refs: 'Morvox, Tiny Tyrant.md'
    },
    'Seraphine Emberwright': {
      title: 'Seraphine Emberwright, Phoenix of the Nine Coals',
      desc: 'Heat/Overheat loop, Vent nova + ignited terrain, and staff strings; fire boon escalations.',
      refs: 'Seraphine Emberwright.md'
    }
  };

  // ------------------------------------------------------------
  // Internal Helpers
  // ------------------------------------------------------------

  function ensureState() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }
    if (!state.HoardRun.players) {
      state.HoardRun.players = {};
    }
    if (!state.HoardRun.runFlow) {
      state.HoardRun.runFlow = clone(DEFAULT_RUN_STATE);
      log('[RunFlow] Initialized run flow state.');
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getRun() {
    ensureState();
    return state.HoardRun.runFlow;
  }

  function resetRunState() {
    state.HoardRun.runFlow = clone(DEFAULT_RUN_STATE);
    log('[RunFlow] Run state reset.');
    return state.HoardRun.runFlow;
  }

  function formatPanel(title, bodyHTML) {
    if (typeof UIManager !== 'undefined' && typeof UIManager.panel === 'function') {
      return UIManager.panel(title, bodyHTML);
    }
    return '**' + title + '**\n' + bodyHTML;
  }

  function formatButtons(buttons) {
    if (typeof UIManager !== 'undefined' && typeof UIManager.buttons === 'function') {
      var rendered = UIManager.buttons(buttons);
      return rendered;
    }
    return buttons.map(function (b) {
      var command = (b.command || '').replace(/^!/, '');
      return '[' + b.label + '](!' + command + ')';
    }).join('<br>');
  }

  function sendDirect(title, bodyHTML) {
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.direct === 'function') {
      HRChat.direct(formatPanel(title, bodyHTML));
    } else {
      sendChat('Hoard Run', '/direct ' + formatPanel(title, bodyHTML));
    }
  }

  function whisperGM(title, bodyHTML) {
    if (typeof HRChat !== 'undefined' && HRChat && typeof HRChat.say === 'function') {
      HRChat.say('/w gm ' + formatPanel(title, bodyHTML));
    } else {
      sendChat('Hoard Run', '/w gm ' + formatPanel(title, bodyHTML));
    }
  }

  function getPlayerName(playerid) {
    var player = getObj('player', playerid);
    if (player && typeof player.get === 'function') {
      return player.get('_displayname');
    }
    return 'Player';
  }

  function whisperPanel(playerid, title, bodyHTML) {
    var name = String(getPlayerName(playerid) || 'Player').replace(/"/g, '\\"');
    var payload = formatPanel(title, bodyHTML);
    sendChat('Hoard Run', '/w "' + name + '" ' + payload);
  }

  function whisperText(playerid, textHTML) {
    var name = String(getPlayerName(playerid) || 'Player').replace(/"/g, '\\"');
    sendChat('Hoard Run', '/w "' + name + '" ' + textHTML);
  }

  function sanitizeWeapon(arg) {
    if (!arg) {
      return null;
    }
    var trimmed = arg.trim();
    if (!trimmed) {
      return null;
    }
    var normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    var i;
    for (i = 0; i < WEAPONS.length; i += 1) {
      if (WEAPONS[i].toLowerCase() === normalized.toLowerCase()) {
        return WEAPONS[i];
      }
    }
    return null;
  }

  // ------------------------------------------------------------
  // Core Actions
  // ------------------------------------------------------------

  function handleStartRun(playerid) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      return;
    }

    var run = resetRunState();
    run.started = true;
    run.lastPrompt = null;
    run.currentRoom = 0;

    if (typeof StateManager !== 'undefined' && typeof StateManager.resetPlayerRun === 'function') {
      StateManager.resetPlayerRun(playerid);
    }

    var body =
      '<b>The Hoard stirs…</b><br>' +
      'Before you step inside, you must choose your weapon.<br><br>' +
      'Select one of the following to attune to your chosen focus:<br><br>' +
      formatButtons([
        { label: '⚔️ Greataxe', command: '!selectweapon Greataxe' },
        { label: '🗡️ Rapier', command: '!selectweapon Rapier' },
        { label: '🏹 Bow', command: '!selectweapon Bow' },
        { label: '🔮 Orb', command: '!selectweapon Orb' },
        { label: '📚 Staff', command: '!selectweapon Staff' }
      ]);

    sendDirect('Welcome to the Hoard Run', body);

    log('[RunFlow] New Hoard Run started — awaiting weapon selection.');
  }

  function handleSelectWeapon(playerid, arg) {
    var run = getRun();
    if (!run.started) {
      whisperText(playerid, '⚠️ No active run. Ask the GM to use <b>!startrun</b> first.');
      return;
    }

    var weapon = sanitizeWeapon(arg);
    if (!weapon) {
      whisperText(playerid, '⚠️ Invalid weapon: ' + (arg || '(none)'));
      return;
    }

    if (typeof StateManager !== 'undefined' && typeof StateManager.resetPlayerRun === 'function') {
      StateManager.resetPlayerRun(playerid);
    }

    if (typeof StateManager !== 'undefined' && typeof StateManager.getPlayer === 'function') {
      var playerState = StateManager.getPlayer(playerid);
      playerState.focus = weapon;
      playerState.currentRoom = 0;
      playerState.hasEnteredFirstRoom = false;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, playerState);
      }
    }

    run.lastPrompt = null;

    whisperPanel(playerid, 'Weapon Chosen', '🗡️ Weapon locked: <b>' + weapon + '</b>.<br>Prepare for your first encounter!<br><br>' +
      'Entering <b>Room 1</b>...');
    log('[RunFlow] Weapon selected for ' + playerid + ': ' + weapon);
  }

  function handleSelectAncestor(playerid, arg) {
    var run = getRun();
    if (!run.started) {
      whisperText(playerid, '⚠️ Start a run and choose a weapon first.');
      return;
    }

    var name = (arg || '').trim().replace(/^"|"$/g, '').replace(/_/g, ' ');
    if (!name) { whisperText(playerid, '⚠️ Provide an ancestor name.'); return; }

    var playerState = (typeof StateManager !== 'undefined' && StateManager.getPlayer)
        ? StateManager.getPlayer(playerid) : null;

    var focus = playerState && playerState.focus ? playerState.focus : 'Staff';
    var options = ANCESTOR_SETS[focus] || [];

    var canon = null, i;
    for (i = 0; i < options.length; i += 1) {
      if (options[i].toLowerCase() === name.toLowerCase()) { canon = options[i]; break; }
    }
    if (!canon) { whisperText(playerid, '⚠️ ' + name + ' is not available for the ' + focus + '.'); return; }

    if (playerState) {
      playerState.ancestor_id = canon;
      // NOTE: we do NOT offer a boon here; that happens at room end.
      if (typeof StateManager.setPlayer === 'function') StateManager.setPlayer(playerid, playerState);
    }

    run.lastPrompt = null;

    whisperPanel(
      playerid,
      'Ancestor Chosen',
      '🌟 Ancestor blessing secured: <b>' + canon + '</b>.<br>' +
      'You will be offered a free boon at the <b>end of each room</b> (shop boons cost Scrip).'
    );

    // Install kit & whisper GM bind button (Vladren example)
    try {
      if (typeof AncestorKits !== 'undefined' && AncestorKits.Vladren && canon === 'Vladren Moroi') {
        AncestorKits.Vladren.install(playerid, {});
        if (AncestorKits.Vladren.promptBindToSelectedPC) AncestorKits.Vladren.promptBindToSelectedPC();
      }
    } catch (e) { log('[RunFlow] Vladren install/prompt error: ' + e.message); }

    // If this player cleared a room without an ancestor, we queued a pending boon.
    if (playerState && playerState.pendingFreeBoon && typeof BoonManager !== 'undefined' && BoonManager.offerBoons) {
      delete playerState.pendingFreeBoon;
      if (typeof StateManager.setPlayer === 'function') StateManager.setPlayer(playerid, playerState);
      BoonManager.offerBoons(playerid, canon, 'free');
    }
  }

  function handleNextRoom(playerid, arg) {
    if (_advancing) return;
    _advancing = true;

    try {
      var run = getRun();
      if (!run.started) { whisperText(playerid, '⚠️ No active run. Use <b>!startrun</b> first.'); return; }

      if (!StateManager || !StateManager.getPlayer) { whisperText(playerid, '⚠️ StateManager not ready.'); return; }
      var ps = StateManager.getPlayer(playerid);
      if (!ps || !ps.focus) {
        whisperPanel(playerid, 'Choose Your Weapon',
          '⚠️ Select a weapon to attune with:<br><br>' + formatButtons([
            { label: '⚔️ Greataxe', command: '!selectweapon Greataxe' },
            { label: '🗡️ Rapier',   command: '!selectweapon Rapier'   },
            { label: '🏹 Bow',      command: '!selectweapon Bow'      },
            { label: '🔮 Orb',      command: '!selectweapon Orb'      },
            { label: '📚 Staff',    command: '!selectweapon Staff'    }
          ])
        );
        return;
      }

      // Use RoomManager (now pure) to determine the step
      var result = (RoomManager && RoomManager.advanceRoom)
        ? RoomManager.advanceRoom(playerid, 'room')
        : StateManager.advanceRoom(playerid, { scrip: 20, fse: 1 }); // minimal fallback

      if (result && result.firstEntry) {
        whisperPanel(playerid, 'Room 1 Ready',
          '⚔️ The first chamber opens. Run the encounter, then use <b>!nextroom</b> again to claim rewards.'
        );

        if (!ps.ancestor_id) {
          var ancestors = ANCESTOR_SETS[ps.focus] || [];
          if (ancestors.length) {
            var ancestorButtons = ancestors.map(function (a) {
              var ident = String(a || '').replace(/\s+/g, '_').replace(/"/g, '');
              return { label: 'Select ' + _.escape(a), command: '!selectancestor ' + ident };
            });
            whisperPanel(playerid, 'Choose Your Ancestor',
              '🌟 Bind to an ancestor to unlock room-end boons:<br><br>' + formatButtons(ancestorButtons)
            );
          }
        }
        return; // important: no rewards yet
      }

      // Normal room clear
      var clearedRoom = (result && result.clearedRoom) || 0;
      var totals = (result && result.totals) || { scrip: 0, fse: 0 };

      whisperPanel(playerid, 'Room Complete',
        '🏁 <b>Room ' + clearedRoom + '</b> cleared!<br>' +
        '+20 Scrip, +1 FSE earned.<br><br>' +
        'Total — Scrip: <b>' + totals.scrip + '</b> | FSE: <b>' + totals.fse + '</b>'
      );

      // Offer free boon only if ancestor chosen; else queue it
      ps = StateManager.getPlayer(playerid);
      if (ps.ancestor_id && BoonManager && BoonManager.offerBoons) {
        BoonManager.offerBoons(playerid, ps.ancestor_id, 'free');
      } else {
        ps.pendingFreeBoon = true;
        if (StateManager.setPlayer) StateManager.setPlayer(playerid, ps);

        var anc = ANCESTOR_SETS[ps.focus] || [];
        if (anc.length) {
          var btns = anc.map(function (a) {
            var ident = String(a || '').replace(/\s+/g, '_').replace(/"/g, '');
            return { label: 'Select ' + _.escape(a), command: '!selectancestor ' + ident };
          });
          whisperPanel(playerid, 'Boon Opportunity',
            '📘 Choose an ancestor to claim your free boon now:<br><br>' + formatButtons(btns)
          );
        }
      }

      // keep a *local* notion of cleared room if you want, but
      // don’t compute a global max across all players yet.
      run.currentRoom = Math.max(run.currentRoom || 0, clearedRoom);
      sendDirect('Room Progression', '✅ Room event processed. Current cleared room: <b>' + run.currentRoom + '</b>.');

    } finally {
      _advancing = false;
    }
  }

  // ------------------------------------------------------------
  // Event Handling
  // ------------------------------------------------------------

  function handleMessage(msg) {
    if (msg.type !== 'api') {
      return;
    }

    var content = (msg.content || '').trim();
    if (!content) {
      return;
    }

    var parsed = content.match(/^(\S+)(?:\s+([\s\S]+))?$/);
    if (!parsed) {
      return;
    }

    var command = parsed[1];
    var argString = parsed[2] || '';

    switch (command.toLowerCase()) {
      case '!startrun':
        handleStartRun(msg.playerid);
        break;
      case '!selectweapon':
        handleSelectWeapon(msg.playerid, argString);
        break;
      case '!selectancestor':
        handleSelectAncestor(msg.playerid, argString);
        break;
      case '!nextroom':
        handleNextRoom(msg.playerid, argString);
        break;
    }
  }

  function register() {
    if (isRegistered) {
      return;
    }
    ensureState();
    on('chat:message', handleMessage);
    log('=== Run Flow Manager ' + VERSION + ' ready ===');
    isRegistered = true;
  }

  return {
    register: register,
    resetRunState: resetRunState,
    getRunState: getRun
  };

})();
