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

  var VERSION = '1.2.0';
  var isRegistered = false;
  var _advancing = false;

  var DEFAULT_RUN_STATE = {
    started: false,
    bossPending: false,
    currentHighestCleared: 0
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

  function escapeHTML(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getActivePlayers() {
    var players = findObjs({ _type: 'player' }) || [];
    return players.filter(function (p) {
      return p.get('online');
    });
  }

  function getKnownPlayerIds() {
    ensureState();
    var roster = [];
    var players = state.HoardRun.players || {};
    var id;
    for (id in players) {
      if (players.hasOwnProperty(id)) {
        roster.push(id);
      }
    }
    return roster;
  }

  function buildWeaponButtons() {
    return [
      { label: '⚔️ Greataxe', command: '!selectweapon Greataxe' },
      { label: '🗡️ Rapier', command: '!selectweapon Rapier' },
      { label: '🏹 Bow', command: '!selectweapon Bow' },
      { label: '🔮 Orb', command: '!selectweapon Orb' },
      { label: '📚 Staff', command: '!selectweapon Staff' }
    ];
  }

  function whisperWeaponPrompt(playerid) {
    var body =
      '<b>The Hoard stirs…</b><br>' +
      'Choose a weapon to begin your personalized run.<br><br>' +
      formatButtons(buildWeaponButtons());
    whisperPanel(playerid, 'Choose Your Weapon', body);
  }

  function sanitizeAncestorCommand(name) {
    return String(name || '')
      .replace(/"/g, '')
      .replace(/\s+/g, '_');
  }

  function buildAncestorCards(focus) {
    var options = ANCESTOR_SETS[focus] || [];
    if (!options.length) {
      return '⚠️ Ancestors for the ' + escapeHTML(focus) + ' are coming soon.';
    }

    var cards = [];
    for (var i = 0; i < options.length; i += 1) {
      var key = options[i];
      var info = ANCESTOR_INFO[key] || {};
      var title = escapeHTML(info.title || key);
      var desc = escapeHTML(info.desc || '');
      var button = formatButtons([
        {
          label: 'Bind to ' + escapeHTML(key),
          command: '!selectancestor ' + sanitizeAncestorCommand(key)
        }
      ]);
      cards.push('<div><b>' + title + '</b><br>' + desc + '<br><br>' + button + '</div>');
    }
    return cards.join('<hr>');
  }

  function whisperAncestorPrompt(playerid, focus) {
    var body =
      'Choose an ancestor tied to your ' + escapeHTML(focus) + ' to unlock free end-of-room boons.<br><br>' +
      buildAncestorCards(focus);
    whisperPanel(playerid, 'Select Your Ancestor', body);
  }

  function getProcessingList(invokerId) {
    if (typeof isGM === 'function' && isGM(invokerId)) {
      var roster = getKnownPlayerIds();
      if (!roster.length) {
        var active = getActivePlayers();
        for (var i = 0; i < active.length; i += 1) {
          roster.push(active[i].id);
        }
      }
      return roster;
    }
    return [invokerId];
  }

  function processNextRoomFor(playerid, useBossType) {
    if (!StateManager || !StateManager.getPlayer) {
      whisperGM('State Warning', '⚠️ StateManager not ready.');
      return null;
    }

    var playerState = StateManager.getPlayer(playerid);
    if (!playerState) {
      return null;
    }

    if (!playerState.focus) {
      whisperWeaponPrompt(playerid);
      return null;
    }

    if (playerState.currentRoom === 0 && !playerState.ancestor_id) {
      if (playerState.stage !== 'awaiting-ancestor') {
        playerState.stage = 'awaiting-ancestor';
        if (StateManager.setPlayer) {
          StateManager.setPlayer(playerid, playerState);
        }
      }
      whisperAncestorPrompt(playerid, playerState.focus);
      return { status: 'awaiting-ancestor', player: playerState };
    }

    if (playerState.stage === 'awaiting-ancestor' && playerState.ancestor_id) {
      playerState.stage = 'pre-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(playerid, playerState);
      }
      if (typeof RoomManager !== 'undefined' && typeof RoomManager.advance === 'function') {
        return RoomManager.advance(playerid, { type: 'room', freeBoon: true });
      }
      return null;
    }

    if (typeof RoomManager === 'undefined' || typeof RoomManager.advance !== 'function') {
      whisperGM('Room Engine Warning', '⚠️ Room progression engine not ready.');
      return null;
    }

    var roomType = useBossType ? 'boss' : 'room';
    var opts = {
      type: roomType,
      freeBoon: true,
      firstClearBonusFSE: 3
    };

    return RoomManager.advance(playerid, opts);
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
    run.bossPending = false;
    run.currentHighestCleared = 0;

    var roster = getActivePlayers();
    var processed = {};
    var i;

    if (typeof StateManager !== 'undefined' && typeof StateManager.resetPlayerRun === 'function') {
      var known = getKnownPlayerIds();
      for (i = 0; i < known.length; i += 1) {
        StateManager.resetPlayerRun(known[i]);
        processed[known[i]] = true;
      }
    }

    for (i = 0; i < roster.length; i += 1) {
      var pid = roster[i].id;
      if (processed[pid]) {
        whisperWeaponPrompt(pid);
        continue;
      }
      if (typeof StateManager !== 'undefined' && typeof StateManager.resetPlayerRun === 'function') {
        StateManager.resetPlayerRun(pid);
      }
      processed[pid] = true;
      whisperWeaponPrompt(pid);
    }

    if (!roster.length) {
      whisperGM('Hoard Run Ready', 'No active players detected. Use <b>!selectweapon</b> once players join.');
    }

    log('[RunFlow] New Hoard Run started — awaiting weapon selections.');
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

    if (typeof StateManager !== 'undefined') {
      if (StateManager.resetPlayerRun) {
        StateManager.resetPlayerRun(playerid);
      }
      var playerState = StateManager.getPlayer ? StateManager.getPlayer(playerid) : null;
      if (playerState) {
        playerState.focus = weapon;
        playerState.stage = 'pre-room';
        playerState.currentRoom = 0;
        if (StateManager.setPlayer) {
          StateManager.setPlayer(playerid, playerState);
        }
      }
    }

    whisperPanel(
      playerid,
      'Weapon Chosen',
      '🗡️ Weapon locked: <b>' + weapon + '</b>.<br>' +
      'Your run progress will now be tracked under your player ID.<br><br>' +
      'Use <b>!nextroom</b> once the GM opens the corridor.'
    );
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
      if (typeof StateManager.setPlayer === 'function') StateManager.setPlayer(playerid, playerState);
    }

    whisperPanel(
      playerid,
      'Ancestor Chosen',
      '🌟 Ancestor blessing secured: <b>' + escapeHTML(canon) + '</b>.<br>' +
      'We will offer free boons tied to this ancestor at the end of each cleared room.'
    );

    // Install kit & whisper GM bind button (Vladren example)
    try {
      if (typeof AncestorKits !== 'undefined' && AncestorKits.Vladren && canon === 'Vladren Moroi') {
        AncestorKits.Vladren.install(playerid, {});
        if (AncestorKits.Vladren.promptBindToSelectedPC) AncestorKits.Vladren.promptBindToSelectedPC();
      }
    } catch (e) { log('[RunFlow] Vladren install/prompt error: ' + e.message); }
  }

  function handleNextRoom(playerid, arg) {
    if (_advancing) return;
    _advancing = true;

    try {
      var run = getRun();
      if (!run.started) {
        whisperText(playerid, '⚠️ No active run. Use <b>!startrun</b> first.');
        return;
      }

      var targets = getProcessingList(playerid);
      var useBossType = !!run.bossPending;
      var anyReady = false;
      var anyCleared = false;

      for (var i = 0; i < targets.length; i += 1) {
        var pid = targets[i];
        var outcome = processNextRoomFor(pid, useBossType);
        if (!outcome) {
          continue;
        }

        if (useBossType) {
          if (outcome.status === 'ready') {
            anyReady = true;
          } else if (outcome.status === 'cleared') {
            anyCleared = true;
          }
        }

        if (outcome.status === 'cleared' && outcome.room && run.currentHighestCleared < outcome.room) {
          run.currentHighestCleared = outcome.room;
        }
      }

      if (useBossType) {
        if (anyReady) {
          run.bossPending = true;
        } else if (anyCleared) {
          run.bossPending = false;
        }
      }
    } catch (e) {
      log('[RunFlow] next room error: ' + e);
    } finally {
      _advancing = false;
    }

  }

  function handleFinalRoom(playerid) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      whisperText(playerid, '⚠️ Only the GM can flag the final room.');
      return;
    }

    var run = getRun();
    run.bossPending = true;
    whisperGM('Final Room Flagged', '👑 Next <b>!nextroom</b> call will prepare the boss encounter for each player.');
  }

  function handleCompleteRun(playerid) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      whisperText(playerid, '⚠️ Only the GM can complete the run.');
      return;
    }

    if (!StateManager || !StateManager.getPlayer) {
      whisperGM('State Warning', '⚠️ StateManager not ready.');
      return;
    }

    var run = getRun();
    var roster = getKnownPlayerIds();
    if (!roster.length) {
      whisperGM('Complete Run', '⚠️ No players are currently registered for this run.');
      return;
    }

    var gmLines = [];
    for (var i = 0; i < roster.length; i += 1) {
      var pid = roster[i];
      var state = StateManager.getPlayer(pid);
      if (!state) {
        continue;
      }

      var totals = StateManager.getCurrencies(pid) || { scrip: 0, fse: 0, squares: 0 };
      var gold = totals.scrip || 0;
      var ancestorName = state.ancestor_id ? escapeHTML(state.ancestor_id) : 'No Ancestor';

      state.scrip = 0;
      state.currentRoom = 0;
      state.stage = 'pre-room';
      if (StateManager.setPlayer) {
        StateManager.setPlayer(pid, state);
      }

      var body =
        'Run complete!<br>' +
        'Ancestor: <b>' + ancestorName + '</b><br>' +
        'Converted <b>' + gold + '</b> Scrip into <b>' + gold + '</b> Gold.<br>' +
        'FSE Earned: <b>' + totals.fse + '</b><br>' +
        'Squares Remaining: <b>' + totals.squares + '</b><br><br>' +
        'Keepsakes and boons remain bound to your player ID.';

      whisperPanel(pid, 'Hoard Run Complete', body);

      gmLines.push(getPlayerName(pid) + ': ' + gold + ' Gold, ' + totals.fse + ' FSE, ancestor ' + ancestorName);
    }

    run.started = false;
    run.bossPending = false;
    run.currentHighestCleared = 0;

    if (gmLines.length) {
      whisperGM('Run Completion Summary', gmLines.join('<br>'));
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
      case '!finalroom':
        handleFinalRoom(msg.playerid);
        break;
      case '!completerun':
        handleCompleteRun(msg.playerid);
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
