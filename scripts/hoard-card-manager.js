(() => {
  'use strict';

  const SCRIPT_NAME = 'Hoard Card Manager';
  const VERSION = '0.1.0';

  const CONFIG = Object.freeze({
    dialA: 20,
    relicWeights: {
      common: 0.55,
      greater: 0.35,
      signature: 0.1
    },
    boonWeights: {
      common: 0.45,
      greater: 0.4,
      signature: 0.15
    }
  });

  const RESOURCE_KEYS = ['scrip', 'fse', 'squares', 'rerolls'];
  const RESOURCE_LABELS = {
    scrip: 'Scrip',
    fse: 'FSE',
    squares: 'Squares',
    rerolls: 'Rerolls'
  };

  const ensureState = () => {
    if (!state.Hoard) {
      state.Hoard = {
        version: VERSION,
        config: _.clone(CONFIG),
        players: {}
      };
    }

    state.Hoard.players = state.Hoard.players || {};
    _.each(state.Hoard.players, (playerState) => ensurePlayerStateDefaults(playerState));
    state.Hoard.config = state.Hoard.config || _.clone(CONFIG);
  };

  const ensurePlayerStateDefaults = (playerState) => {
    RESOURCE_KEYS.forEach((key) => {
      if (typeof playerState[key] !== 'number' || _.isNaN(playerState[key])) {
        playerState[key] = 0;
      }
    });
  };

  const onReady = () => {
    ensureState();
    log(`${SCRIPT_NAME} v${VERSION} ready.`);
  };

  const startsWith = (value, prefix) => _.isString(value) && value.slice(0, prefix.length) === prefix;

  const parseArgs = (content) => {
    const tokens = [];
    const regex = /"([^"]*)"|([^\s"]+)/g;
    let match = regex.exec(content);
    while (match) {
      tokens.push(match[1] || match[2]);
      match = regex.exec(content);
    }

    const args = { _: [] };
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (startsWith(token, '--')) {
        const key = token.slice(2).toLowerCase();
        const nextToken = tokens[i + 1];
        const value = nextToken && !startsWith(nextToken, '--') ? nextToken : 'true';
        args[key] = value;
        i += value === 'true' ? 1 : 2;
      } else {
        args._.push(token);
        i += 1;
      }
    }

    return args;
  };

  const handleInput = (msg) => {
    if (msg.type !== 'api' || !_.isString(msg.content)) {
      return;
    }

    const trimmed = msg.content.trim();
    if (!trimmed.startsWith('!hoard')) {
      return;
    }

    ensureState();

    const args = parseArgs(trimmed);
    const command = (args._[1] || 'help').toLowerCase();

    switch (command) {
      case 'help':
        sendHelp(msg);
        break;
      case 'status':
        handleStatus(args, msg);
        break;
      case 'award':
        if (requireGM(msg)) {
          handleAdjust(args, msg, 1, 'Awarded');
        }
        break;
      case 'spend':
        if (requireGM(msg)) {
          handleAdjust(args, msg, -1, 'Spent');
        }
        break;
      case 'set':
        if (requireGM(msg)) {
          handleSet(args, msg);
        }
        break;
      case 'reroll':
        handleReroll(args, msg);
        break;
      default:
        sendHelp(msg);
        break;
    }
  };

  const requireGM = (msg) => {
    if (!playerIsGM(msg.playerid)) {
      whisper(msg.who, 'Only the GM may use that command.');
      return false;
    }
    return true;
  };

  const handleStatus = (args, msg) => {
    const targetId = resolvePlayerId(args.player, msg, true);
    if (targetId === false) {
      return;
    }

    if (targetId) {
      const playerState = getOrCreatePlayerState(targetId);
      const name = getDisplayName(targetId);
      whisper(msg.who, formatStatusLine(name, playerState));
      return;
    }

    const entries = _.chain(state.Hoard.players)
      .map((playerState, playerId) => ({
        id: playerId,
        name: getDisplayName(playerId),
        state: playerState
      }))
      .sortBy((entry) => entry.name.toLowerCase())
      .value();

    if (!entries.length) {
      whisper(msg.who, 'No players are being tracked yet.');
      return;
    }

    const lines = entries.map((entry) => formatStatusLine(entry.name, entry.state));
    whisper(msg.who, lines.join('<br>'));
  };

  const handleAdjust = (args, msg, multiplier, verb) => {
    const playerId = resolvePlayerId(args.player, msg);
    if (!playerId) {
      return;
    }

    const adjustments = parseResourceArgs(args);
    if (_.isEmpty(adjustments)) {
      whisper(msg.who, 'No resource values supplied.');
      return;
    }

    const signedAdjustments = _.reduce(adjustments, (memo, value, key) => {
      memo[key] = multiplier * value;
      return memo;
    }, {});
    const playerState = getOrCreatePlayerState(playerId);
    const applied = applyResourceDelta(playerState, signedAdjustments);

    if (_.isEmpty(applied)) {
      whisper(msg.who, 'No changes were applied (values may have been zero).');
      return;
    }

    announceChange(verb, playerId, applied, msg.who);
  };

  const handleSet = (args, msg) => {
    const playerId = resolvePlayerId(args.player, msg);
    if (!playerId) {
      return;
    }

    const values = parseResourceArgs(args, { allowZero: true });
    if (_.isEmpty(values)) {
      whisper(msg.who, 'No resource values supplied.');
      return;
    }

    const playerState = getOrCreatePlayerState(playerId);
    const applied = {};

    _.each(values, (value, key) => {
      const prior = playerState[key] || 0;
      const nextValue = Math.max(0, value);
      playerState[key] = nextValue;
      const delta = nextValue - prior;
      if (delta !== 0) {
        applied[key] = delta;
      }
    });

    if (_.isEmpty(applied)) {
      whisper(msg.who, 'No changes were applied (values match current totals).');
      return;
    }

    announceChange('Set', playerId, applied, msg.who);
  };

  const handleReroll = (args, msg) => {
    const resolved = resolvePlayerId(args.player, msg, true);
    if (resolved === false) {
      return;
    }

    const playerId = resolved || msg.playerid;
    if (!playerId) {
      whisper(msg.who, 'Unable to determine which player to charge for the reroll.');
      return;
    }

    const playerState = getOrCreatePlayerState(playerId);
    if (playerState.rerolls <= 0) {
      whisper(msg.who, `${getDisplayName(playerId)} has no reroll tokens remaining.`);
      return;
    }

    const kind = (args.kind || 'slot').toLowerCase();
    const kindLabel = kind === 'die' ? 'd20 reroll' : 'shop slot reroll';

    playerState.rerolls = Math.max(0, playerState.rerolls - 1);

    const totals = formatTotals(playerState);
    sendChat(SCRIPT_NAME, `${getDisplayName(playerId)} spends a reroll token for a ${kindLabel}. (${totals})`);
  };

  const announceChange = (verb, playerId, delta, recipient) => {
    const summary = formatDelta(delta);
    const totals = formatTotals(getOrCreatePlayerState(playerId));
    const name = getDisplayName(playerId);
    const message = `${verb} **${name}** — ${summary}.<br><span style="font-size: 0.9em;">${totals}</span>`;
    whisper(recipient, message);
  };

  const formatStatusLine = (name, playerState) => {
    return `**${name}** — ${formatTotals(playerState)}`;
  };

  const formatTotals = (playerState) => {
    return RESOURCE_KEYS
      .map((key) => `${RESOURCE_LABELS[key]} ${playerState[key] || 0}`)
      .join(' | ');
  };

  const formatDelta = (delta) => {
    return _.chain(delta)
      .map((value, key) => `${RESOURCE_LABELS[key] || titleCase(key)} ${value >= 0 ? '+' : ''}${value}`)
      .join(', ')
      .value();
  };

  const titleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1);

  const getOrCreatePlayerState = (playerId) => {
    const players = state.Hoard.players;
    if (!players[playerId]) {
      players[playerId] = { scrip: 0, fse: 0, squares: 0, rerolls: 0 };
    }
    ensurePlayerStateDefaults(players[playerId]);
    return players[playerId];
  };

  const parseResourceArgs = (args, options = {}) => {
    const { allowZero = false } = options;
    const values = {};
    RESOURCE_KEYS.forEach((key) => {
      if (args[key] !== undefined) {
        const numeric = parseInt(args[key], 10);
        if (!_.isNaN(numeric) && (allowZero || numeric !== 0)) {
          values[key] = numeric;
        }
      }
    });
    return values;
  };

  const applyResourceDelta = (playerState, adjustments) => {
    const applied = {};

    _.each(adjustments, (delta, key) => {
      if (!_.contains(RESOURCE_KEYS, key)) {
        return;
      }
      const prior = playerState[key] || 0;
      const nextValue = Math.max(0, prior + delta);
      playerState[key] = nextValue;
      const actualDelta = nextValue - prior;
      if (actualDelta !== 0) {
        applied[key] = actualDelta;
      }
    });

    return applied;
  };

  const resolvePlayerId = (rawValue, msg, allowEmpty) => {
    if (!rawValue) {
      return allowEmpty ? null : msg.playerid;
    }

    const candidate = getObj('player', rawValue);
    if (candidate) {
      return candidate.id;
    }

    const search = rawValue.toLowerCase();
    const matches = findObjs({ _type: 'player' }).filter((player) => player.get('displayname').toLowerCase() === search);

    if (matches.length === 1) {
      return matches[0].id;
    }

    if (matches.length > 1) {
      whisper(msg.who, `Multiple players match "${rawValue}". Please be more specific or use the player ID.`);
      return false;
    }

    whisper(msg.who, `No player found matching "${rawValue}".`);
    return false;
  };

  const getDisplayName = (playerId) => {
    const player = getObj('player', playerId);
    if (player) {
      return player.get('displayname');
    }
    return `Player ${playerId}`;
  };

  const sendHelp = (msg) => {
    const lines = [
      '<strong>Hoard Card Manager</strong> commands:',
      '`!hoard status [--player "Name"]` — show currency totals.',
      '`!hoard award --player "Name" --scrip N --fse N --squares N --rerolls N` (GM) — grant resources.',
      '`!hoard spend --player "Name" --scrip N --fse N --squares N --rerolls N` (GM) — spend resources.',
      '`!hoard set --player "Name" --scrip N --fse N --squares N --rerolls N` (GM) — set exact totals.',
      '`!hoard reroll [--player "Name"] [--kind slot|die]` — consume a reroll token.'
    ];
    whisper(msg.who, lines.join('<br>'));
  };

  const whisper = (recipient, message) => {
    const target = recipient || 'GM';
    sendChat(SCRIPT_NAME, `/w "${target}" ${message}`);
  };

  on('ready', onReady);
  on('chat:message', handleInput);
})();
