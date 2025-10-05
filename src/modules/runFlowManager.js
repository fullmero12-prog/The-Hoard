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
    weapon: null,
    ancestor: null,
    started: false,
    lastPrompt: null
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

    if (typeof StateManager !== 'undefined' && typeof StateManager.resetPlayerRun === 'function') {
      StateManager.resetPlayerRun(playerid);
    }

    sendDirect('Welcome to the Hoard Run',
      '<b>The Hoard stirs…</b><br>' +
      'Before you step inside, you must choose your weapon.<br><br>' +
      'Select one of the following to attune to your chosen focus:<br><br>' +
      formatButtons([
        { label: '⚔️ Greataxe', command: '!selectweapon Greataxe' },
        { label: '🗡️ Rapier', command: '!selectweapon Rapier' },
        { label: '🏹 Bow', command: '!selectweapon Bow' },
        { label: '🔮 Orb', command: '!selectweapon Orb' },
        { label: '📚 Staff', command: '!selectweapon Staff' }
      ])
    );

    log('[RunFlow] New Hoard Run started — awaiting weapon selection.');
  }

  function handleSelectWeapon(playerid, arg) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      return;
    }

    var run = getRun();
    if (!run.started) {
      whisperGM('Weapon Selection', '⚠️ No active run. Use <b>!startrun</b> first.');
      return;
    }

    var weapon = sanitizeWeapon(arg);
    if (!weapon) {
      whisperGM('Weapon Selection', '⚠️ Invalid weapon: ' + (arg || '(none)'));
      return;
    }

    run.weapon = weapon;
    run.lastPrompt = null;

    if (typeof StateManager !== 'undefined' && typeof StateManager.getPlayer === 'function') {
      StateManager.initPlayer(playerid);
      var playerState = StateManager.getPlayer(playerid);
      playerState.focus = weapon;
      if (typeof StateManager.setCurrentRoom === 'function') {
        StateManager.setCurrentRoom(playerid, 0);
      } else {
        playerState.currentRoom = 0;
      }
    }

    sendDirect('Weapon Chosen', '🗡️ Weapon locked: <b>' + weapon + '</b>.<br>Prepare for your first encounter!<br><br>' +
      'Entering <b>Room 1</b>...');
    log('[RunFlow] Weapon selected: ' + weapon);
  }

  function handleSelectAncestor(playerid, arg) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      return;
    }

    var run = getRun();
    if (!run.started || !run.weapon) {
      whisperGM('Ancestor Selection', '⚠️ Start a run and choose a weapon first.');
      return;
    }

    var chosenRaw = (arg || '').trim();
    if (!chosenRaw) {
      whisperGM('Ancestor Selection', '⚠️ Provide an ancestor name.');
      return;
    }

    var chosen = chosenRaw.replace(/_/g, ' ');
    var options = ANCESTOR_SETS[run.weapon] || [];
    var valid = null;
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (options[i].toLowerCase() === chosen.toLowerCase()) {
        valid = options[i];
        break;
      }
    }

    if (!valid) {
      whisperGM('Ancestor Selection', '⚠️ ' + chosen + ' is not available for the ' + run.weapon + '.');
      return;
    }

    run.ancestor = valid;

    try {
      if (typeof AncestorKits !== 'undefined' && AncestorKits.Vladren && valid === 'Vladren Moroi') {
        // Create the kit + handout as before (stats optional)
        AncestorKits.Vladren.install(playerid, {
          // pb: 3,
          // spellMod: 4
        });
        // ✅ Whisper the slick “bind to selected PC” button to the GM
        if (typeof AncestorKits.Vladren.promptBindToSelectedPC === 'function') {
          AncestorKits.Vladren.promptBindToSelectedPC();
        } else {
          if (typeof promptBindToSelectedPC === 'function') {
            promptBindToSelectedPC();
          }
        }
      }
    } catch (e) {
      log('[RunFlow] Vladren bind prompt error: ' + e.message);
    }

    run.lastPrompt = null;

    if (typeof StateManager !== 'undefined' && typeof StateManager.getPlayer === 'function') {
      var gmPlayer = StateManager.getPlayer(playerid) || {};
      gmPlayer.ancestor_id = valid;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, gmPlayer);
      } else {
        if (!state.HoardRun) {
          state.HoardRun = {};
        }
        if (!state.HoardRun.players) {
          state.HoardRun.players = {};
        }
        state.HoardRun.players[playerid] = gmPlayer;
      }
    }

    var info = ANCESTOR_INFO[valid];
    var head = info ? '<b>' + _.escape(info.title) + '</b>' : '<b>' + _.escape(valid) + '</b>';
    var blurb = info ? '<div style="margin-top:4px;color:#bbb">' + _.escape(info.desc) + '</div>' : '';

    sendDirect('Ancestor Chosen',
      '🌟 Ancestor blessing secured: ' + head + blurb + '<br>' +
      'You gain <b>1 boon at the end of each room</b> (outside shops).'
    );

    log('[RunFlow] Ancestor selected: ' + valid);
  }

  function handleNextRoom(playerid, arg) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      return;
    }

    if (_advancing) {
      return;
    }

    _advancing = true;

    try {
      var run = getRun();
      if (!run.started) {
        whisperGM('Room Progression', '⚠️ No active run. Use <b>!startrun</b> first.');
        return;
      }
      if (!run.weapon) {
        if (run.lastPrompt !== 'weapon') {
          sendDirect('Room 1 Ready', '⚔️ Choose your weapon first with <b>!selectweapon</b>.');
          run.lastPrompt = 'weapon';
        }
        return;
      }

      if (!run.ancestor) {
        var list = ANCESTOR_SETS[run.weapon] || [];

        if (!list.length) {
          sendDirect('Choose your Ancestor',
            'No ancestors are available for <b>' + run.weapon + '</b> yet.<br>' +
            '<i>Coming soon.</i><br><br>' +
            'Pick a different weapon to test ancestor flow: ' +
            '[Staff](!selectweapon Staff) | [Orb](!selectweapon Orb)'
          );
          log('[RunFlow] No ancestors for ' + run.weapon + ' (placeholder shown).');
          return;
        }

        var html = list.map(function (a) {
          var info = ANCESTOR_INFO[a] || { title: a, desc: '' };
          var safe = a.replace(/\s+/g, '_');
          return (
            '<div style="margin:6px 0 12px 0; padding:8px; border:1px solid #444; background:#111;">' +
              '<div style="font-weight:bold; color:#fff;">' + _.escape(info.title) + '</div>' +
              '<div style="margin-top:4px; color:#bbb;">' + _.escape(info.desc) + '</div>' +
              '<div style="margin-top:8px;">[Select ' + a + '](!selectancestor ' + safe + ')</div>' +
            '</div>'
          );
        }).join('');

        sendDirect('Choose your Ancestor',
          'Choose your guiding spirit (weapon: <b>' + run.weapon + '</b>):<br><br>' + html
        );
        log('[RunFlow] Awaiting ancestor selection for ' + run.weapon + '.');
        return;
      }

      run.lastPrompt = null;

      var clearedRoom = null;
      var totals = null;

      if (typeof StateManager !== 'undefined') {
        if (typeof StateManager.incrementRoom === 'function') {
          clearedRoom = StateManager.incrementRoom(playerid);
        } else if (typeof StateManager.getPlayer === 'function') {
          var fallbackPlayer = StateManager.getPlayer(playerid);
          fallbackPlayer.currentRoom = (fallbackPlayer.currentRoom || 0) + 1;
          clearedRoom = fallbackPlayer.currentRoom;
        }

        if (clearedRoom !== null && clearedRoom > 0) {
          if (typeof StateManager.applyCurrencyBundle === 'function') {
            totals = StateManager.applyCurrencyBundle(playerid, { scrip: 20, fse: 1 });
          } else {
            if (typeof StateManager.addCurrency === 'function') {
              StateManager.addCurrency(playerid, 'scrip', 20);
              StateManager.addCurrency(playerid, 'fse', 1);
            }
          }
        }

        if (!totals && typeof StateManager.getCurrencies === 'function') {
          totals = StateManager.getCurrencies(playerid);
        }
      }

      if (clearedRoom === null) {
        clearedRoom = 0;
      }

      if (totals === null) {
        totals = { scrip: 0, fse: 0 };
      }

      if (clearedRoom > 0) {
        sendDirect('Room Complete',
          '🏁 <b>Room ' + clearedRoom + '</b> cleared!<br>' +
          '+20 Scrip, +1 FSE earned.<br><br>' +
          'Total — Scrip: <b>' + totals.scrip + '</b> | FSE: <b>' + totals.fse + '</b><br><br>' +
          '🌀 You may now choose a new <b>Boon</b> inspired by your Ancestor.'
        );

        if (typeof BoonManager !== 'undefined' && run.ancestor && clearedRoom >= 1) {
          var safe = run.ancestor.replace(/\s+/g, '_');
          sendDirect('Boon Opportunity',
            '✨ ' + _.escape(run.ancestor) + ' offers a new boon choice.<br>' +
            '[Draw Boons](!offerboons ' + safe + ' free)'
          );
        }
      }

      log('[RunFlow] Room ' + clearedRoom + ' cleared. Next up: ' + (clearedRoom + 1) + '.');
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

    var spaceIdx = content.indexOf(' ');
    var command = spaceIdx === -1 ? content : content.slice(0, spaceIdx);
    var argString = spaceIdx === -1 ? '' : content.slice(spaceIdx + 1);

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
