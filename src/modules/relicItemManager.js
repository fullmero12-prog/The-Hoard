// ------------------------------------------------------------
// Relic Item Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Tracks which relic IDs players own and coordinates with
//   RelicBinder so character sheets stay in sync whenever the
//   automation helpers are available.
//   Shops, rewards, and GM tools call into this module to
//   grant or remove relics without duplicating bookkeeping.
// ------------------------------------------------------------

var RelicItemManager = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function logInfo(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('RelicItemManager', message);
    } else {
      log('[Hoard Run] [RelicItemManager] ℹ️ ' + message);
    }
  }

  function logWarn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('RelicItemManager', message);
    } else {
      log('[Hoard Run] [RelicItemManager] ⚠️ ' + message);
    }
  }

  function normalizeRelicId(value) {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      if (value.relicId) {
        return String(value.relicId);
      }
      if (value.id) {
        return String(value.id);
      }
      if (value.name) {
        return String(value.name);
      }
    }
    return null;
  }

  function ensureRelicArray(playerState) {
    if (!playerState) {
      return [];
    }

    if (!playerState.relics || !Array.isArray(playerState.relics)) {
      playerState.relics = [];
      return playerState.relics;
    }

    var normalized = [];
    var seen = {};
    for (var i = 0; i < playerState.relics.length; i += 1) {
      var id = normalizeRelicId(playerState.relics[i]);
      if (!id || seen[id]) {
        continue;
      }
      seen[id] = true;
      normalized.push(id);
    }

    playerState.relics = normalized;
    return playerState.relics;
  }

  function addRelicToPlayer(playerId, relicId) {
    var outcome = { ok: false, added: false, alreadyOwned: false };

    if (!playerId || !relicId) {
      return outcome;
    }

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function') {
      return outcome;
    }

    var playerState = StateManager.getPlayer(playerId);
    if (!playerState) {
      return outcome;
    }

    var relics = ensureRelicArray(playerState);
    var normalizedId = String(relicId);
    for (var i = 0; i < relics.length; i += 1) {
      if (relics[i] === normalizedId) {
        outcome.ok = true;
        outcome.alreadyOwned = true;
        return outcome;
      }
    }

    relics.push(normalizedId);
    StateManager.setPlayer(playerId, playerState);

    outcome.ok = true;
    outcome.added = true;
    return outcome;
  }

  function removeRelicFromPlayer(playerId, relicId) {
    var outcome = { ok: false, removed: false };

    if (!playerId || !relicId) {
      return outcome;
    }

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getPlayer !== 'function') {
      return outcome;
    }

    var playerState = StateManager.getPlayer(playerId);
    if (!playerState) {
      return outcome;
    }

    var relics = ensureRelicArray(playerState);
    var normalizedId = String(relicId);
    var next = [];
    var removed = false;

    for (var i = 0; i < relics.length; i += 1) {
      if (relics[i] === normalizedId) {
        removed = true;
        continue;
      }
      next.push(relics[i]);
    }

    if (removed) {
      playerState.relics = next;
      StateManager.setPlayer(playerId, playerState);
      outcome.removed = true;
    }

    outcome.ok = true;
    return outcome;
  }

  function mergeWarnings(target, warnings) {
    if (!target || !warnings || !warnings.length) {
      return;
    }
    for (var i = 0; i < warnings.length; i += 1) {
      var code = warnings[i];
      var exists = false;
      for (var j = 0; j < target.length; j += 1) {
        if (target[j] === code) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        target.push(code);
      }
    }
  }

  function grantRelic(options) {
    var spec = options || {};
    var relicId = normalizeRelicId(spec.relicId);
    if (!relicId) {
      relicId = normalizeRelicId(spec.id);
    }
    if (!relicId) {
      relicId = normalizeRelicId(spec.relic);
    }
    if (!relicId) {
      relicId = normalizeRelicId(spec.name);
    }

    var playerId = spec.playerId || null;
    var characterId = spec.characterId || null;
    var displayName = spec.displayName || normalizeRelicId(spec.relic) || relicId || 'Relic';
    var suppressCharacterWarning = spec && spec.suppressCharacterWarning;

    var result = {
      ok: false,
      stateUpdated: false,
      binderApplied: false,
      alreadyOwned: false,
      warnings: [],
      reason: null,
      relicId: relicId,
      binderResult: null
    };

    if (!relicId) {
      result.reason = 'missing_relic';
      logWarn('grantRelic called without a valid relic id.');
      return result;
    }

    if (!playerId && !characterId) {
      result.reason = 'missing_target';
      logWarn('grantRelic called without a player or character target for relic "' + relicId + '".');
      return result;
    }

    if (playerId) {
      var stateOutcome = addRelicToPlayer(playerId, relicId);
      if (stateOutcome.ok) {
        result.stateUpdated = stateOutcome.added;
        result.alreadyOwned = stateOutcome.alreadyOwned;
      } else {
        mergeWarnings(result.warnings, ['state_unavailable']);
      }
    }

    if (!characterId) {
      if (!suppressCharacterWarning) {
        mergeWarnings(result.warnings, ['missing_character']);
      }
    }

    if (characterId) {
      if (typeof RelicBinder !== 'undefined' && RelicBinder && typeof RelicBinder.grantRelic === 'function') {
        var binderResult = RelicBinder.grantRelic(characterId, relicId);
        result.binderResult = binderResult;
        if (binderResult && binderResult.ok) {
          result.binderApplied = true;
        } else {
          mergeWarnings(result.warnings, ['binder_failed']);
        }
      } else {
        mergeWarnings(result.warnings, ['binder_unavailable']);
      }
    }

    if (result.stateUpdated || result.binderApplied || result.alreadyOwned) {
      result.ok = true;
      logInfo('Relic "' + displayName + '" granted (player ' + (playerId || 'n/a') + ', character ' + (characterId || 'n/a') + ').');
    } else {
      if (!result.reason) {
        result.reason = 'no_effect';
      }
      logWarn('Relic "' + displayName + '" could not be granted (player ' + (playerId || 'n/a') + ', character ' + (characterId || 'n/a') + ').');
    }

    return result;
  }

  function removeRelic(options) {
    var spec = options || {};
    var relicId = normalizeRelicId(spec.relicId);
    if (!relicId) {
      relicId = normalizeRelicId(spec.id);
    }
    if (!relicId) {
      relicId = normalizeRelicId(spec.relic);
    }
    if (!relicId) {
      relicId = normalizeRelicId(spec.name);
    }

    var playerId = spec.playerId || null;
    var characterId = spec.characterId || null;
    var suppressCharacterWarning = spec && spec.suppressCharacterWarning;

    var result = {
      ok: false,
      stateUpdated: false,
      binderRemoved: false,
      warnings: [],
      reason: null,
      relicId: relicId,
      binderResult: null
    };

    if (!relicId) {
      result.reason = 'missing_relic';
      logWarn('removeRelic called without a valid relic id.');
      return result;
    }

    if (!playerId && !characterId) {
      result.reason = 'missing_target';
      logWarn('removeRelic called without a player or character target for relic "' + relicId + '".');
      return result;
    }

    if (playerId) {
      var stateOutcome = removeRelicFromPlayer(playerId, relicId);
      if (stateOutcome.ok && stateOutcome.removed) {
        result.stateUpdated = true;
      } else if (!stateOutcome.ok) {
        mergeWarnings(result.warnings, ['state_unavailable']);
      }
    }

    if (!characterId) {
      if (!suppressCharacterWarning) {
        mergeWarnings(result.warnings, ['missing_character']);
      }
    }

    if (characterId) {
      if (typeof RelicBinder !== 'undefined' && RelicBinder && typeof RelicBinder.removeRelic === 'function') {
        var binderResult = RelicBinder.removeRelic(characterId, relicId);
        result.binderResult = binderResult;
        if (binderResult && binderResult.ok) {
          result.binderRemoved = true;
        } else {
          mergeWarnings(result.warnings, ['binder_failed']);
        }
      } else {
        mergeWarnings(result.warnings, ['binder_unavailable']);
      }
    }

    if (result.stateUpdated || result.binderRemoved) {
      result.ok = true;
      logInfo('Relic "' + relicId + '" removed (player ' + (playerId || 'n/a') + ', character ' + (characterId || 'n/a') + ').');
    } else {
      if (!result.reason) {
        result.reason = 'not_found';
      }
      logWarn('Relic "' + relicId + '" could not be removed (player ' + (playerId || 'n/a') + ', character ' + (characterId || 'n/a') + ').');
    }

    return result;
  }

  function getRelicIds(playerId) {
    if (!playerId) {
      return [];
    }
    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.getRelicIds !== 'function') {
      return [];
    }
    return StateManager.getRelicIds(playerId);
  }

  function removeAllForCharacter(characterId) {
    var summary = { removed: 0 };
    if (!characterId) {
      return summary;
    }

    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.findPlayersByCharacter !== 'function') {
      return summary;
    }

    var owners = StateManager.findPlayersByCharacter(characterId) || [];
    var seen = {};

    for (var i = 0; i < owners.length; i += 1) {
      var owner = owners[i];
      if (!owner || !owner.id) {
        continue;
      }
      var playerState = owner.state || StateManager.getPlayer(owner.id);
      var relics = ensureRelicArray(playerState);
      for (var r = 0; r < relics.length; r += 1) {
        var relicId = relics[r];
        if (!relicId || seen[relicId]) {
          continue;
        }
        var removal = removeRelic({
          playerId: owner.id,
          characterId: characterId,
          relicId: relicId,
          suppressCharacterWarning: true
        });
        if (removal && removal.ok) {
          summary.removed += 1;
        }
        seen[relicId] = true;
      }
    }

    return summary;
  }

  return {
    grantRelic: grantRelic,
    removeRelic: removeRelic,
    removeAllForCharacter: removeAllForCharacter,
    getRelicIds: getRelicIds
  };
})();
