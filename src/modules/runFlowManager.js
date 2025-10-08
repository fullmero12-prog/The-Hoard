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

  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('RunFlow', message);
    } else {
      log('[Hoard Run] [RunFlow] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('RunFlow', message);
    } else {
      log('[Hoard Run] [RunFlow] ⚠️ ' + message);
    }
  }

  function error(message) {
    if (logger && logger.error) {
      logger.error('RunFlow', message);
    } else {
      log('[Hoard Run] [RunFlow] ❌ ' + message);
    }
  }

  function ready(message) {
    if (logger && logger.ready) {
      logger.ready('RunFlow', message);
    } else {
      log('[Hoard Run] [RunFlow] ✅ ' + message);
    }
  }

  var VERSION = '1.2.0';
  var isRegistered = false;
  var _advancing = false;

  var DEFAULT_RUN_STATE = {
    started: false,
    bossPending: false,
    bossUnlocked: false,
    currentHighestCleared: 0,
    sessionId: 0
  };

  var WEAPONS = ['Staff', 'Orb', 'Greataxe', 'Rapier', 'Bow'];

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
      info('Initialized run flow state.');
    } else if (typeof state.HoardRun.runFlow.bossUnlocked === 'undefined') {
      state.HoardRun.runFlow.bossUnlocked = false;
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
    ensureState();
    var previous = state.HoardRun.runFlow || {};
    var next = clone(DEFAULT_RUN_STATE);
    next.sessionId = (previous.sessionId || 0) + 1;
    state.HoardRun.runFlow = next;
    info('Run state reset.');
    return state.HoardRun.runFlow;
  }

  function formatPanel(title, bodyHTML) {
    if (typeof UIManager !== 'undefined' && typeof UIManager.panel === 'function') {
      return UIManager.panel(title, bodyHTML);
    }
    return '<div><strong>' + title + '</strong><br>' + bodyHTML + '</div>';
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

  function renderAdvanceRoomButton() {
    return formatButtons([
      { label: 'Advance Room ▶️', command: '!nextroom' }
    ]);
  }

  function whisperAdvanceRoomPrompt(message, title) {
    var segments = [];
    if (message) {
      segments.push(message);
    }
    segments.push(renderAdvanceRoomButton());
    whisperGM(title || 'Advance Room', segments.join('<br><br>'));
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

  function HR_findAutoPCForPlayer(playerid) {
    if (typeof StateManager !== 'undefined' && StateManager && typeof StateManager.getPlayer === 'function') {
      // Prefer an explicit kit binding if one is recorded on the player state.
      var ps = StateManager.getPlayer(playerid);
      if (ps && ps.boundCharacterId) {
        var existing = getObj('character', ps.boundCharacterId);
        if (existing) {
          var ctrl = existing.get('controlledby') || '';
          if (ctrl === 'all') {
            return existing;
          }
          var owners = ctrl.split(',');
          for (var o = 0; o < owners.length; o += 1) {
            if ((owners[o] || '').trim() === playerid) {
              return existing;
            }
          }
        }

        if (typeof StateManager.setPlayer === 'function') {
          StateManager.setPlayer(playerid, { boundCharacterId: null });
        } else if (ps) {
          ps.boundCharacterId = null;
        }
      }
    }

    var chars = findObjs({ _type: 'character' }).filter(function (c) {
      var ctrl = (c.get('controlledby') || '');
      if (ctrl === 'all') {
        return true;
      }
      var segments = ctrl.split(',');
      for (var i = 0; i < segments.length; i += 1) {
        if ((segments[i] || '').trim() === playerid) {
          return true;
        }
      }
      return false;
    });

    if (!chars.length) {
      return null;
    }

    var campaign = typeof Campaign === 'function' ? Campaign() : null;
    var pageId = null;

    if (campaign) {
      var psp = campaign.get('playerspecificpages') || {};
      pageId = psp[playerid] || campaign.get('playerpageid') || null;
    }

    if (pageId) {
      var tokenList = findObjs({ _type: 'graphic', _pageid: pageId, layer: 'objects' }) || [];
      for (var t = 0; t < tokenList.length; t += 1) {
        var token = tokenList[t];
        var rep = token.get('represents');
        if (!rep) {
          continue;
        }
        for (var j = 0; j < chars.length; j += 1) {
          if (chars[j] && chars[j].id === rep) {
            var cid = token.get('represents');
            return getObj('character', cid) || null;
          }
        }
      }
    }

    if (chars.length === 1) {
      return chars[0];
    }

    return null;
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

  function ancestorKitRegistered(name) {
    if (typeof AncestorKits === 'undefined' || !AncestorKits || !AncestorKits._defs) {
      return false;
    }
    var key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) {
      return false;
    }
    var aliasIndex = AncestorKits._aliasIndex || {};
    var resolved = aliasIndex[key] || key;
    return !!AncestorKits._defs[resolved];
  }

  function promptAncestorKitBinding(ancestorName) {
    if (typeof AncestorKits === 'undefined' || !AncestorKits) {
      return;
    }

    var safeName = escapeHTML(ancestorName || 'Ancestor');
    var command = '!bindkit ' + ancestorName;
    var label = 'Bind ' + ancestorName + ' to Selected PC';
    var body = [];

    body.push('<div style=\'margin-bottom:6px;\'>Select the player\'s token, then click the button below or run <code>'
      + escapeHTML(command)
      + '</code> to mirror the kit actions.</div>');
    body.push('<div style=\'margin-bottom:6px;\'>Mirrored abilities are stored on the sheet\'s <b>Attributes &amp; Abilities</b> tab '
      + 'and appear as token action buttons for that character.</div>');

    var buttonHtml;
    if (typeof AncestorKits.buttons === 'function') {
      buttonHtml = AncestorKits.buttons([{ label: label, command: command }]);
    } else {
      var safeLabel = escapeHTML(label);
      var stripped = command.replace(/^!/, '');
      buttonHtml = '[' + safeLabel + '](!' + stripped + ')';
    }

    body.push('<div>' + buttonHtml + '</div>');

    var panelTitle = 'Mirror ' + safeName + ' Kit';
    var panelHtml = typeof AncestorKits.panel === 'function'
      ? AncestorKits.panel(panelTitle, body.join(''))
      : '<div style=\'border:1px solid #444;background:#111;color:#eee;padding:8px;\'>'
        + '<div style=\'font-weight:bold;margin-bottom:6px;\'>' + panelTitle + '</div>'
        + body.join('')
        + '</div>';

    if (typeof AncestorKits.gmSay === 'function') {
      AncestorKits.gmSay(panelHtml);
    } else if (typeof sendChat === 'function') {
      sendChat('Hoard Run', '/w gm ' + panelHtml);
    }
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

  function registryFocusEntries(focus) {
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getFocusEntries === 'function') {
      return AncestorRegistry.getFocusEntries(focus);
    }
    return [];
  }

  function registryFocusNames(focus) {
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getFocusNames === 'function') {
      return AncestorRegistry.getFocusNames(focus);
    }
    return [];
  }

  function registryUiBlurb(name) {
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getUiBlurb === 'function') {
      return AncestorRegistry.getUiBlurb(name);
    }
    return null;
  }

  function registryAncestorForFocus(focus, name) {
    if (typeof AncestorRegistry === 'undefined' || !AncestorRegistry || typeof AncestorRegistry.get !== 'function') {
      return null;
    }
    var entry = AncestorRegistry.get(name);
    if (!entry || !entry.focusTags) {
      return null;
    }
    var target = String(focus || '').toLowerCase();
    for (var i = 0; i < entry.focusTags.length; i += 1) {
      if (String(entry.focusTags[i] || '').toLowerCase() === target) {
        return entry;
      }
    }
    return null;
  }

  function sanitizeAncestorCommand(name) {
    return String(name || '')
      .replace(/"/g, '')
      .replace(/\s+/g, '_');
  }

  function buildAncestorCards(focus) {
    var entries = registryFocusEntries(focus);
    if (!entries.length) {
      return '⚠️ Ancestors for the ' + escapeHTML(focus) + ' are coming soon.';
    }

    var cards = [];
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var key = entry.displayName || entry.name || 'Ancestor';
      var info = registryUiBlurb(key) || {};
      var title = escapeHTML(info.title || entry.title || key);
      var desc = escapeHTML(info.desc || entry.description || entry.summary || '');
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
    run.bossUnlocked = false;
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

    info('New Hoard Run started — awaiting weapon selections.');
    whisperAdvanceRoomPrompt('Click after each encounter to distribute room rewards.', 'Advance Room Control');
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
      'The GM will advance rooms once each encounter is finished.'
    );
    info('Weapon selected for ' + playerid + ': ' + weapon + '.');
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
    var entry = registryAncestorForFocus(focus, name);
    if (!entry) {
      var available = registryFocusNames(focus);
      var safeName = escapeHTML(name);
      var message = '⚠️ ' + safeName + ' is not available for the ' + escapeHTML(focus) + '.';
      if (available && available.length) {
        var safeList = available.map(function (label) {
          return escapeHTML(label);
        }).join(', ');
        message += ' Options: ' + safeList + '.';
      }
      whisperText(playerid, message);
      return;
    }

    var canon = entry.displayName || entry.name || name;

    if (playerState) {
      playerState.ancestor_id = canon;
      playerState.boundCharacterId = null;
      if (typeof StateManager.setPlayer === 'function') {
        playerState = StateManager.setPlayer(playerid, playerState);
      }
    }

    whisperPanel(
      playerid,
      'Ancestor Chosen',
      '🌟 Ancestor blessing secured: <b>' + escapeHTML(canon) + '</b>.<br>' +
      'We will offer free boons tied to this ancestor at the end of each cleared room.'
    );

    if (ancestorKitRegistered(canon)) {
      try {
        if (typeof AncestorKits !== 'undefined' && AncestorKits && typeof AncestorKits.install === 'function') {
          var pc = HR_findAutoPCForPlayer(playerid);
          if (pc) {
            var autoResult = AncestorKits.install((playerState && playerState.ancestor_id) || canon, pc, { by: playerid });
            var charId = pc.id || (pc.get && pc.get('_id')) || null;
            if (autoResult && charId && playerState) {
              playerState.boundCharacterId = charId;
              if (typeof StateManager.setPlayer === 'function') {
                playerState = StateManager.setPlayer(playerid, playerState);
              }
            }
            if (typeof AncestorKits.gmSay === 'function') {
              var ancestorLabel = escapeHTML((playerState && playerState.ancestor_id) || canon);
              var pcName = pc.get && pc.get('name') ? pc.get('name') : 'Character';
              AncestorKits.gmSay('✅ Auto-bound <b>' + ancestorLabel + '</b> to <b>' + escapeHTML(pcName) + '</b>.');
            }
          } else {
            if (typeof AncestorKits.promptBindToSelectedPC === 'function') {
              AncestorKits.promptBindToSelectedPC();
            }
            if (typeof AncestorKits.gmSay === 'function') {
              AncestorKits.gmSay('⚠️ Select a PC token and click a kit to mirror actions.');
            }
          }
        }
      } catch (e) {
        warn('Auto-bind error: ' + (e && e.message ? e.message : e));
      }
    }
  }

  function handleNextRoom(playerid, arg) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      whisperText(playerid, '⚠️ Only the GM can advance rooms.');
      return;
    }

    if (_advancing) return;
    _advancing = true;

    var run;
    var useBossType = false;
    var bossJustUnlocked = false;

    try {
      run = getRun();
      if (!run.started) {
        whisperText(playerid, '⚠️ No active run. Use <b>!startrun</b> first.');
        return;
      }

      var targets = getProcessingList(playerid);
      useBossType = !!run.bossPending;
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

      if (!useBossType && !run.bossUnlocked && run.currentHighestCleared >= 5) {
        run.bossUnlocked = true;
        run.bossPending = true;
        bossJustUnlocked = true;
      }

      if (useBossType) {
        var stillInBoss = false;
        var awaitingAncestor = false;
        var rosterCheck = getKnownPlayerIds();
        var j;

        for (j = 0; j < rosterCheck.length; j += 1) {
          var rid = rosterCheck[j];
          var state = (typeof StateManager !== 'undefined' && StateManager.getPlayer)
            ? StateManager.getPlayer(rid)
            : null;

          if (!state) {
            continue;
          }

          if (state.stage === 'in-room') {
            stillInBoss = true;
            break;
          }

          if (state.stage === 'awaiting-ancestor') {
            awaitingAncestor = true;
          }
        }

        if (stillInBoss || awaitingAncestor || anyReady) {
          run.bossPending = true;
        } else if (anyCleared) {
          run.bossPending = false;
          run.bossUnlocked = false;
        }
      }
    } catch (e) {
      error('Next room error: ' + e);
    } finally {
      _advancing = false;

      if (run && run.started) {
        var promptMessage;
        var promptTitle;
        if (bossJustUnlocked) {
          promptTitle = 'Boss Unlocked';
          promptMessage = '👑 Room 6 (Boss) is unlocked. Click when the party is ready to begin the final encounter.';
        } else if (run.bossPending && useBossType) {
          promptTitle = 'Advance Boss Room';
          promptMessage = '👑 Boss room in progress. Click after the encounter to distribute boss rewards again.';
        } else if (run.bossPending) {
          promptTitle = 'Boss Ready';
          promptMessage = '👑 Final chamber prepped. Click to begin the boss room when the party is ready.';
        } else {
          promptTitle = 'Advance Room Control';
          promptMessage = 'Click after each encounter to distribute room rewards.';
        }
        whisperAdvanceRoomPrompt(promptMessage, promptTitle);
      }
    }

  }

  function handleFinalRoom(playerid) {
    if (typeof isGM === 'function' && !isGM(playerid)) {
      whisperText(playerid, '⚠️ Only the GM can flag the final room.');
      return;
    }

    var run = getRun();
    run.bossPending = true;
    run.bossUnlocked = true;
    whisperAdvanceRoomPrompt(
      '👑 Final chamber flagged. Use the button below after the boss encounter to deliver rewards for each player.',
      'Final Room Flagged'
    );
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
    ready('Run Flow Manager ' + VERSION + ' ready.');
    isRegistered = true;
  }

  return {
    register: register,
    resetRunState: resetRunState,
    getRunState: getRun
  };

})();
