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

    var name = (arg || '').trim().replace(/^"|"$/g, '');
    name = name.replace(/_/g, ' ');
    if (!name) { whisperText(playerid, '⚠️ Provide an ancestor name.'); return; }

    var playerState = null;
    var focus = null;
    if (typeof StateManager !== 'undefined' && typeof StateManager.getPlayer === 'function') {
      playerState = StateManager.getPlayer(playerid);
      focus = playerState.focus;
    }

    if (!focus) {
      focus = 'Staff';
    }

    var options = ANCESTOR_SETS[focus] || [];
    var canon = null;
    if (options && typeof options.find === 'function') {
      canon = options.find(function (a) { return a.toLowerCase() === name.toLowerCase(); });
    }
    if (!canon) {
      var idx;
      for (idx = 0; idx < options.length; idx += 1) {
        if (options[idx].toLowerCase() === name.toLowerCase()) {
          canon = options[idx];
          break;
        }
      }
    }
    if (!canon) { whisperText(playerid, '⚠️ ' + name + ' is not available for the ' + focus + '.'); return; }

    if (playerState) {
      playerState.ancestor_id = canon;
      if (typeof StateManager.setPlayer === 'function') {
        StateManager.setPlayer(playerid, playerState);
      }
    }

    run.lastPrompt = null;

    whisperPanel(playerid,
      'Ancestor Chosen',
      '🌟 Ancestor blessing secured: <b>' + canon + '</b>.<br>' +
      'You will be offered a free boon at the end of each room (shop boons cost Scrip).'
    );

    // If Vladren, install the kit for THIS player and whisper GM the bind button
    try {
      if (typeof AncestorKits !== 'undefined' && AncestorKits.Vladren && canon === 'Vladren Moroi') {
        AncestorKits.Vladren.install(playerid, {});  // creates kit + handout for the player
        if (AncestorKits.Vladren.promptBindToSelectedPC) {
          AncestorKits.Vladren.promptBindToSelectedPC(); // /w gm panel with [Mirror Buttons to Selected PC]
        } else if (typeof promptBindToSelectedPC === 'function') {
          promptBindToSelectedPC();
        }
      }
    } catch(e){ log('[RunFlow] Vladren install/prompt error: '+e.message); }

    // Optional: if they are already in a post-fight stage, offer the boon now
    if (run.currentRoom >= 1) {
      if (typeof BoonManager !== 'undefined' && BoonManager.offerBoons){
        BoonManager.offerBoons(playerid, canon, 'free'); // end-of-room = free
      }
    }
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

      if (run.lastPrompt === 'ancestor') {
        run.lastPrompt = null;
      }

      var rewardBundle = { scrip: 20, fse: 1 };
      var roster = (state && state.HoardRun && state.HoardRun.players) ? state.HoardRun.players : {};
      var processed = false;
      var maxCleared = run.currentRoom || 0;
      var pid;

      for (pid in roster) {
        if (!roster.hasOwnProperty(pid)) {
          continue;
        }

        if (typeof StateManager === 'undefined' || typeof StateManager.getPlayer !== 'function') {
          continue;
        }

        var playerState = StateManager.getPlayer(pid);
        if (!playerState) {
          continue;
        }

        if (!playerState.focus) {
          whisperPanel(pid, 'Choose Your Weapon',
            '⚠️ Select a weapon to attune with:<br><br>' +
            formatButtons([
              { label: '⚔️ Greataxe', command: '!selectweapon Greataxe' },
              { label: '🗡️ Rapier', command: '!selectweapon Rapier' },
              { label: '🏹 Bow', command: '!selectweapon Bow' },
              { label: '🔮 Orb', command: '!selectweapon Orb' },
              { label: '📚 Staff', command: '!selectweapon Staff' }
            ])
          );
          continue;
        }

        if (typeof StateManager.advanceRoom !== 'function') {
          continue;
        }

        var result = StateManager.advanceRoom(pid, rewardBundle);
        processed = true;

        if (result.firstEntry) {
          whisperPanel(pid, 'Room 1 Ready',
            '⚔️ The first chamber opens. Run the encounter, then use <b>!nextroom</b> again to claim rewards.'
          );
          continue;
        }

        var clearedRoom = result.clearedRoom || 0;
        var totals = result.totals || { scrip: 0, fse: 0 };
        if (clearedRoom > maxCleared) {
          maxCleared = clearedRoom;
        }

        whisperPanel(pid, 'Room Complete',
          '🏁 <b>Room ' + clearedRoom + '</b> cleared!<br>' +
          '+20 Scrip, +1 FSE earned.<br><br>' +
          'Total — Scrip: <b>' + totals.scrip + '</b> | FSE: <b>' + totals.fse + '</b>'
        );

        if (result.player && result.player.ancestor_id && typeof BoonManager !== 'undefined' && BoonManager.offerBoons) {
          BoonManager.offerBoons(pid, result.player.ancestor_id, 'free');
        } else if (!result.player || !result.player.ancestor_id) {
          var focus = result.player && result.player.focus ? result.player.focus : playerState.focus;
          var ancestors = ANCESTOR_SETS[focus] || [];
          if (ancestors.length) {
            var ancestorButtons = ancestors.map(function (a) {
              var label = _.escape(a);
              var commandName = a.replace(/"/g, '\"');
              return { label: 'Select ' + label, command: '!selectancestor "' + commandName + '"' };
            });
            whisperPanel(pid, 'Choose Your Ancestor',
              '🌟 Bind to an ancestor to unlock room-end boons:<br><br>' + formatButtons(ancestorButtons)
            );
          }
        }
      }

      if (processed && maxCleared > (run.currentRoom || 0)) {
        run.currentRoom = maxCleared;
      }

      if (!processed) {
        whisperGM('Room Progression', '⚠️ No players were advanced. Ensure players have joined the run.');
      } else {
        sendDirect('Room Progression', '✅ Room event processed. Current cleared room: <b>' + run.currentRoom + '</b>.');
      }

      log('[RunFlow] Global room progression resolved. Highest cleared room: ' + (run.currentRoom || 0) + '.');
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
