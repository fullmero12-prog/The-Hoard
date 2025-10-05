// ------------------------------------------------------------
// Run Flow Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Directs the opening beats of a Hoard Run campaign.
//   Handles starting the run, weapon selection, ancestor binding,
//   the first free boon phase, and steady room progression.
//   Designed to complement existing managers (Boon/Event/Relic).
// ------------------------------------------------------------

var RunFlowManager = (function () {

  var VERSION = '1.1.0';
  var isRegistered = false;

  var DEFAULT_RUN_STATE = {
    currentRoom: 0,
    weapon: null,
    ancestor: null,
    freeBoonUsed: false,
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

  function promptAncestorSelection(run) {
    var weaponAncestors = (ANCESTOR_SETS[run.weapon] || []).map(function (a) {
      // encode spaces so Roll20 buttons can handle multi-word names
      var safeName = a.replace(/\s+/g, '_');
      return { label: 'Select ' + a, command: '!selectancestor ' + safeName };
    });

    var body = 'Choose your Ancestor (weapon: <b>' + run.weapon + '</b>):<br><br>' +
      formatButtons(weaponAncestors);

    sendDirect('Ancestor Selection', body);
    log('[RunFlow] Awaiting ancestor selection for ' + run.weapon + '.');
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

  function grantFreeBoons(run) {
    run.freeBoonUsed = true;
    run.rerollTokens += 1;
    sendDirect('Free Boon Phase',
      '🎁 You gain <b>2 free Boons</b> and <b>+1 Reroll Token</b>.<br><br>' +
      'Use <code>!offerboons ' + run.ancestor + '</code> to choose your starting boons.'
    );
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

    var name = (arg || '').trim().replace(/_/g, ' ');
    log('[RunFlow] Ancestor command arg: ' + name);
    if (!name) {
      whisperGM('Ancestor Selection', '⚠️ Provide an ancestor name.');
      return;
    }

    var options = ANCESTOR_SETS[run.weapon] || [];
    var isValid = false;
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (options[i].toLowerCase() === name.toLowerCase()) {
        name = options[i];
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      whisperGM('Ancestor Selection', '⚠️ ' + name + ' is not available for the ' + run.weapon + '.');
      return;
    }

    run.ancestor = name;

    var info = typeof AncestorDataLoader !== 'undefined' ? AncestorDataLoader.get(name) : null;
    if (info) {
      sendChat('Hoard Run', '/w gm <b>' + name + ' — ' + info.title + '</b><br>' + info.summary);
    } else {
      sendChat('Hoard Run', '/w gm No info found for ' + name + '.');
    }

    sendDirect('Ancestor Chosen', '🌟 Ancestor blessing secured: <b>' + name + '</b>.<br>' +
      'When you enter Room 2, you will gain 2 free Boons and +1 Reroll token.');
    log('[RunFlow] Ancestor selected: ' + name);

    if (run.currentRoom === 2 && !run.freeBoonUsed) {
      grantFreeBoons(run);
    }
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

    var type = (arg || '').trim().toLowerCase();
    var reward = { scrip: 20, fse: 1, squareChance: 0, label: 'Standard Room' };

    if (type === 'miniboss') {
      reward = { scrip: 20, fse: 2, squareChance: 0.5, label: 'Miniboss Room' };
    } else if (type === 'boss') {
      reward = { scrip: 40, fse: 5, squareChance: 0.5, label: 'Boss Room' };
    }

    if (run.currentRoom === 2 && !run.ancestor) {
      promptAncestorSelection(run);
      return;
    }

    var nextRoom = run.currentRoom + 1;

    if (nextRoom === 2 && !run.ancestor) {
      run.currentRoom = nextRoom;
      promptAncestorSelection(run);
      return;
    }

    if (nextRoom === 2 && run.ancestor && !run.freeBoonUsed) {
      run.currentRoom = nextRoom;
      grantFreeBoons(run);
      return;
    }

    run.currentRoom = nextRoom;
    run.scrip += reward.scrip;
    run.fse += reward.fse;

    var squareDropped = false;
    if (reward.squareChance > 0 && Math.random() < reward.squareChance) {
      run.squares += 1;
      squareDropped = true;
    }

    var rewardSummary =
      '🏆 <b>' + reward.label + ' Cleared!</b><br>' +
      '+<b>' + reward.scrip + ' Scrip</b>, ' +
      '+<b>' + reward.fse + ' FSE</b>' +
      (reward.squareChance ? ', 💠 ' + (squareDropped ? 'Square acquired!' : 'Square chance rolled') : '') + '<br><br>';

    sendDirect('Room Complete',
      rewardSummary +
      'Advancing to <b>Room ' + run.currentRoom + '</b>...'
    );

    if (typeof BoonManager !== 'undefined' && run.ancestor && run.currentRoom > 1) {
      sendDirect('Boon Opportunity',
        '✨ <b>' + run.ancestor + '</b> offers you a new boon choice.<br>' +
        'Use <code>!offerboons ' + run.ancestor + '</code> to draw your options.<br>' +
        '<small>(This boon is free — no Scrip cost outside shops.)</small>'
      );
    }

    log('[RunFlow] Advanced to Room ' + run.currentRoom +
      ' | Type: ' + reward.label +
      ' | Scrip: ' + run.scrip +
      ' | FSE: ' + run.fse +
      ' | Squares: ' + run.squares +
      (squareDropped ? ' (Square awarded)' : '') +
      ' | Arg: ' + (type || 'standard'));
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
