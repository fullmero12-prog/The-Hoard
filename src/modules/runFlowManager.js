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

  var ANCESTOR_BLURBS = {
    'Azuren': {
      title: 'Azuren — The Stormheart',
      desc: 'Master of wind and storm. Empowers mobility, deflection, and ranged control.'
    },
    'Sutra Vayla': {
      title: 'Sutra Vayla — The Mindroot',
      desc: 'Wielder of psychic calm. Focused on discipline, shielding, and insight.'
    },
    'Seraphine Emberwright': {
      title: 'Seraphine Emberwright — The Phoenix Binder',
      desc: 'Channels renewal and fire. Rewards aggression and self-healing.'
    },
    'Vladren Moroi': {
      title: 'Vladren Moroi — The Blood Sovereign',
      desc: 'Harnesses vitality through sacrifice. Thrives when near death.'
    },
    'Morvox, Tiny Tyrant': {
      title: 'Morvox, Tiny Tyrant — The Iron Whelp',
      desc: 'Defies odds with overwhelming presence. Bolsters allies through fury.'
    },
    'Lian Veilbinder': {
      title: 'Lian Veilbinder — The Shadowed Blade',
      desc: 'Dances between light and dark. Prefers precision and calculated strikes.'
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

    var body = 'Choose your weapon to begin your journey:<br><br>' +
      formatButtons([
        { label: 'Select Staff', command: '!selectweapon Staff' },
        { label: 'Select Orb', command: '!selectweapon Orb' },
        { label: 'Select Greataxe', command: '!selectweapon Greataxe' },
        { label: 'Select Rapier', command: '!selectweapon Rapier' },
        { label: 'Select Bow', command: '!selectweapon Bow' }
      ]);

    sendDirect('Welcome to the Hoard Run', body);
    log('[RunFlow] Run started. Awaiting weapon selection.');
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

    var name = (arg || '').trim().replace(/^"|"$/g, '').replace(/_/g, ' ');
    log('[RunFlow] Ancestor command arg: ' + name);
    if (!name) {
      whisperGM('Ancestor Selection', '⚠️ Provide an ancestor name.');
      return;
    }

    var options = ANCESTOR_SETS[run.weapon] || [];
    var selected = null;
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (options[i].toLowerCase() === name.toLowerCase()) {
        selected = options[i];
        break;
      }
    }

    if (!selected) {
      whisperGM('Ancestor Selection', '⚠️ ' + name + ' is not available for the ' + run.weapon + '.');
      return;
    }

    run.ancestor = selected;

    var blurb = ANCESTOR_BLURBS[run.ancestor];

    sendDirect('Ancestor Chosen',
      '🌟 <b>Ancestor blessing secured:</b> ' + run.ancestor + '<br>' +
      (blurb ? '<i>' + blurb.desc + '</i><br><br>' : '') +
      'Begin your journey under their guidance!'
    );
    log('[RunFlow] Ancestor selected: ' + run.ancestor);
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

    if (run.currentRoom === 1) {
      sendDirect('Room 1 Ready', '⚔️ Choose your weapon first with <b>!selectweapon</b>.');
      return;
    }

    if (!run.ancestor) {
      var weaponAncestors = (ANCESTOR_SETS[run.weapon] || []).map(function (a) {
        var blurbInfo = ANCESTOR_BLURBS[a];
        var blurbHTML = '';
        if (blurbInfo) {
          blurbHTML = '<div style="margin-top:4px;padding:4px;background:#0a0;color:#eee;"><b>' +
            blurbInfo.title + '</b><br><span style="color:#cfc;">' + blurbInfo.desc + '</span></div>';
        }
        return {
          label: 'Select ' + a,
          command: '!selectancestor "' + a + '"',
          blurb: blurbHTML
        };
      });

      var body = 'Choose your Ancestor (weapon: <b>' + run.weapon + '</b>):<br><br>' +
        weaponAncestors.map(function (a) {
          return '[' + a.label + '](' + a.command + ')' + a.blurb;
        }).join('<br>');

      sendDirect('Ancestor Selection', body);
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
