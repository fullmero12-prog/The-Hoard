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

  var DEFAULT_RUN_STATE = {
    currentRoom: 0,
    weapon: null,
    ancestor: null,
    scrip: 0,
    fse: 0,
    rerollTokens: 0,
    squares: 0,
    started: false
  };

  var WEAPONS = ['Staff', 'Orb', 'Greataxe', 'Rapier', 'Bow'];

  var ANCESTOR_SETS = {
    Staff: ['Azuren', 'Sutra Vayla'],
    Orb: ['Sutra Vayla', 'Seraphine Emberwright'],
    Greataxe: ['Vladren Moroi', 'Morvox, Tiny Tyrant'],
    Rapier: ['Lian Veilbinder', 'Vladren Moroi'],
    Bow: ['Azuren', 'Lian Veilbinder']
  };

  var ANCESTOR_INFO = {
    'Azuren': {
      title: 'The Stormheart',
      desc: 'Master of wind and storm. Empowers mobility, deflection, and ranged control.'
    },
    'Sutra Vayla': {
      title: 'The Woven Sun',
      desc: 'Weaver of radiant barriers and healing light. Inspires protection and focus.'
    },
    'Seraphine Emberwright': {
      title: 'The Foreglight',
      desc: 'Radiant artist who channels flame into healing, renewal, and creative power.'
    },
    'Vladren Moroi': {
      title: 'The Blood Sage',
      desc: 'Scholar of life and decay. Balances vitality through sacrifice and shadow.'
    },
    'Lian Veilbinder': {
      title: 'The Threadweaver',
      desc: 'Manipulator of fate and illusion. Shifts outcomes with elegance and cunning.'
    },
    'Morvox, Tiny Tyrant': {
      title: 'The Shard King',
      desc: 'Greedy genius of crystal and willpower. Turns ambition into unstoppable force.'
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

  function isGM(playerid) {
    if (typeof playerIsGM === 'function') {
      return playerIsGM(playerid);
    }
    return true;
  }

  function formatPanel(title, bodyHTML) {
    if (typeof UIManager !== 'undefined' && typeof UIManager.panel === 'function') {
      return UIManager.panel(title, bodyHTML);
    }
    return '**' + title + '**\n' + bodyHTML;
  }

  function formatButtons(buttons) {
    if (typeof UIManager !== 'undefined' && typeof UIManager.buttons === 'function') {
      rendered = UIManager.buttons(buttons);
      return rendered;
    }
    rendered = buttons.map(function (b) {
      var command = (b.command || '').replace(/^!/, '');
      return '[' + b.label + '](!' + command + ')';
    }).join('<br>');
  }

  function sendDirect(title, bodyHTML) {
    sendChat('Hoard Run', '/direct ' + formatPanel(title, bodyHTML));
  }

  function whisperGM(title, bodyHTML) {
    sendChat('Hoard Run', '/w gm ' + formatPanel(title, bodyHTML));
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
    if (!isGM(playerid)) {
      return;
    }

    var run = resetRunState();
    run.started = true;
    run.currentRoom = 0; // 0 = pre-battle setup room (Weapon/Ancestor phase)

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
    if (!isGM(playerid)) {
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
    run.currentRoom = 1;

    sendDirect('Weapon Chosen', '🗡️ Weapon locked: <b>' + weapon + '</b>.<br>Prepare for your first encounter!<br><br>' +
      'Entering <b>Room 1</b>...');
    log('[RunFlow] Weapon selected: ' + weapon);
  }

  function handleSelectAncestor(playerid, arg) {
    if (!isGM(playerid)) {
      return;
    }

    var run = getRun();
    if (!run.started || !run.weapon) {
      whisperGM('Ancestor Selection', '⚠️ Start a run and choose a weapon first.');
      return;
    }

    var chosen = (arg || '').trim().replace(/^"|"$/g, '').replace(/_/g, ' ');
    if (!chosen) {
      whisperGM('Ancestor Selection', '⚠️ Provide an ancestor name.');
      return;
    }

    var available = ANCESTOR_SETS[run.weapon] || [];
    var valid = null;
    var i;
    for (i = 0; i < available.length; i += 1) {
      if (available[i].toLowerCase() === chosen.toLowerCase()) {
        valid = available[i];
        break;
      }
    }

    if (!valid) {
      whisperGM('Ancestor Selection', '⚠️ ' + chosen + ' is not available for the ' + run.weapon + '.');
      return;
    }

    run.ancestor = valid;

    sendDirect('Ancestor Chosen',
      '🌟 <b>Ancestor blessing secured:</b> <b>' + valid + '</b>.<br>' +
      'You will now gain <b>1 Boon</b> after each completed room.<br><br>' +
      'When you clear your first room, use <code>!offerboons</code> to select your free boon.'
    );

    log('[RunFlow] Ancestor selected: ' + valid);
  }

  function handleNextRoom(playerid, arg) {
    if (!isGM(playerid)) {
      return;
    }

    var run = getRun();
    if (!run.started) {
      whisperGM('Room Progression', '⚠️ No active run. Use <b>!startrun</b> first.');
      return;
    }
    if (!run.weapon) {
      whisperGM('Room Progression', '⚠️ Choose a weapon before advancing.');
      return;
    }

    run.currentRoom += 1;

    if (run.currentRoom === 1 && !run.ancestor) {
      var ancestors = (ANCESTOR_SETS[run.weapon] || []).map(function (a) {
        var info = ANCESTOR_INFO[a] || { title: '', desc: '' };
        return '<b>' + a + '</b> — ' + info.title + '<br><i>' + info.desc + '</i><br>' +
          '[Select ' + a + '](!selectancestor "' + a + '")<br><br>';
      }).join('');

      sendDirect('Choose Your Ancestor',
        'Choose your guiding spirit (weapon: <b>' + run.weapon + '</b>):<br><br>' + ancestors
      );

      log('[RunFlow] Awaiting ancestor selection for ' + run.weapon + '.');
      return;
    }

    if (run.currentRoom > 1) {
      run.scrip += 20;
      run.fse += 1;

      sendDirect('Room Complete',
        '🏁 <b>Room ' + (run.currentRoom - 1) + '</b> cleared!<br>' +
        '+20 Scrip, +1 FSE earned.<br><br>' +
        'Total — Scrip: <b>' + run.scrip + '</b> | FSE: <b>' + run.fse + '</b><br><br>' +
        '🌀 You may now choose a new <b>Boon</b> inspired by your Ancestor.'
      );

      if (typeof BoonManager !== 'undefined' && run.ancestor) {
        sendChat('Hoard Run', '/direct ' + formatPanel('Boon Selection',
          'Use <b>!offerboons ' + run.ancestor + '</b> to choose your next boon from your Ancestor’s path.'));
      }
    }

    log('[RunFlow] Advanced to room ' + run.currentRoom + '.');
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
