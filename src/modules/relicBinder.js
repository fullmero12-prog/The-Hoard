// ------------------------------------------------------------
// Relic Binder
// ------------------------------------------------------------
// What this does (in simple terms):
//   Adds and removes Hoard relic records on characters.
//   Uses the sheet adapter helpers to write inventory rows and
//   token actions, keeps StateManager in sync, and enforces the
//   "Hoard: <Relic>" naming convention for relic abilities.
// ------------------------------------------------------------

var RelicBinder = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function logInfo(message) {
    if (logger && typeof logger.info === 'function') {
      logger.info('RelicBinder', message);
    } else {
      log('[Hoard Run] [RelicBinder] ℹ️ ' + message);
    }
  }

  function logWarn(message) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('RelicBinder', message);
    } else {
      log('[Hoard Run] [RelicBinder] ⚠️ ' + message);
    }
  }

  function logError(message) {
    if (logger && typeof logger.error === 'function') {
      logger.error('RelicBinder', message);
    } else {
      log('[Hoard Run] [RelicBinder] ❌ ' + message);
    }
  }

  function deepClone(obj) {
    if (!obj && obj !== 0) {
      return obj;
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (err) {
      return obj;
    }
  }

  function getAdapterHelper() {
    if (typeof root.EffectAdaptersDnd5eRoll20 !== 'undefined') {
      return root.EffectAdaptersDnd5eRoll20;
    }
    return null;
  }

  function buildStateRecord(payload, hoardName) {
    var record = {
      id: payload.id,
      relicId: payload.id,
      name: payload.name || payload.id,
      displayName: hoardName,
      rarity: payload.rarity || null,
      metaVersion: payload.metaVersion || 1
    };

    if (payload.inventory) {
      record.inventory = deepClone(payload.inventory);
    }
    if (payload.ability) {
      record.ability = deepClone(payload.ability);
    }

    return record;
  }

  function ensurePlayerStateHasRelics(playerState) {
    if (!playerState.relics || !Array.isArray(playerState.relics)) {
      playerState.relics = [];
    }
  }

  function attachRelicToPlayers(characterId, payload, hoardName) {
    var updates = [];
    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.findPlayersByCharacter !== 'function') {
      logWarn('StateManager unavailable; cannot record relic ownership for character ' + characterId + '.');
      return updates;
    }

    var owners = StateManager.findPlayersByCharacter(characterId) || [];
    for (var i = 0; i < owners.length; i += 1) {
      var playerId = owners[i].id;
      if (!playerId) {
        continue;
      }

      var playerState = StateManager.getPlayer(playerId);
      ensurePlayerStateHasRelics(playerState);

      var exists = false;
      for (var r = 0; r < playerState.relics.length; r += 1) {
        var existing = playerState.relics[r];
        if (existing && existing.id === payload.id) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        playerState.relics.push(buildStateRecord(payload, hoardName));
        StateManager.setPlayer(playerId, playerState);
        updates.push(playerId);
      }
    }

    return updates;
  }

  function removeRelicFromPlayers(characterId, relicId) {
    var removals = [];
    if (typeof StateManager === 'undefined' || !StateManager || typeof StateManager.findPlayersByCharacter !== 'function') {
      logWarn('StateManager unavailable; cannot clear relic ownership for character ' + characterId + '.');
      return removals;
    }

    var owners = StateManager.findPlayersByCharacter(characterId) || [];
    for (var i = 0; i < owners.length; i += 1) {
      var playerId = owners[i].id;
      if (!playerId) {
        continue;
      }

      var playerState = StateManager.getPlayer(playerId);
      ensurePlayerStateHasRelics(playerState);

      var nextRelics = [];
      var removed = false;
      for (var r = 0; r < playerState.relics.length; r += 1) {
        var record = playerState.relics[r];
        if (record && record.id === relicId) {
          removed = true;
          continue;
        }
        nextRelics.push(record);
      }

      if (removed) {
        playerState.relics = nextRelics;
        StateManager.setPlayer(playerId, playerState);
        removals.push(playerId);
      }
    }

    return removals;
  }

  function fetchRelicPayload(relicId) {
    if (typeof RelicData === 'undefined' || !RelicData || typeof RelicData.buildRelicPayload !== 'function') {
      return null;
    }
    return RelicData.buildRelicPayload(relicId);
  }

  function sanitizeName(name) {
    return name || 'Hoard Relic';
  }

  function hasHoardAbility(characterId, relicName) {
    if (typeof findObjs !== 'function') {
      return false;
    }

    var ability = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: 'Hoard: ' + sanitizeName(relicName)
    })[0];

    return !!ability;
  }

  function ensureHoardAbilityName(characterId, abilityId, hoardName, fallbackLabel) {
    if (typeof getObj !== 'function') {
      return false;
    }

    var ability = null;
    if (abilityId) {
      ability = getObj('ability', abilityId);
    }

    if (!ability && typeof findObjs === 'function') {
      var namesToCheck = [hoardName, fallbackLabel];
      for (var i = 0; i < namesToCheck.length; i += 1) {
        var checkName = namesToCheck[i];
        if (!checkName) {
          continue;
        }
        var found = findObjs({
          _type: 'ability',
          _characterid: characterId,
          name: checkName
        })[0];
        if (found) {
          ability = found;
          break;
        }
      }
    }

    if (!ability) {
      return false;
    }

    try {
      ability.set({ name: hoardName, istokenaction: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeRelicAbility(characterId, relicName) {
    if (typeof findObjs !== 'function') {
      return false;
    }

    var desired = 'Hoard: ' + sanitizeName(relicName);
    var legacy = 'HR Relic: ' + sanitizeName(relicName);

    var ability = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: desired
    })[0];

    if (!ability) {
      ability = findObjs({
        _type: 'ability',
        _characterid: characterId,
        name: legacy
      })[0];
    }

    if (!ability) {
      return false;
    }

    try {
      ability.remove();
      return true;
    } catch (err) {
      return false;
    }
  }

  function parseHoardMeta(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    try {
      return JSON.parse(String(value));
    } catch (err) {
      return null;
    }
  }

  function findRelicInventoryRows(characterId, relicId) {
    var rows = [];
    if (typeof findObjs !== 'function') {
      return rows;
    }

    var target = String(relicId || '').toLowerCase();
    if (!target) {
      return rows;
    }

    var attrs = findObjs({
      _type: 'attribute',
      characterid: characterId
    }) || [];

    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      if (!attr || typeof attr.get !== 'function') {
        continue;
      }
      var name = attr.get('name') || '';
      if (name.indexOf('repeating_inventory_') !== 0) {
        continue;
      }
      if (name.slice(-11) !== '_hoard_meta') {
        continue;
      }

      var match = name.match(/^repeating_inventory_([A-Za-z0-9\-]+)_hoard_meta$/);
      if (!match) {
        continue;
      }

      var meta = parseHoardMeta(attr.get('current'));
      if (!meta || meta.type !== 'relic') {
        continue;
      }

      var metaId = meta.id ? String(meta.id).toLowerCase() : '';
      if (metaId === target) {
        rows.push(match[1]);
      }
    }

    return rows;
  }

  function removeRepeatingRow(characterId, section, rowId) {
    if (!rowId || typeof findObjs !== 'function') {
      return false;
    }

    var prefix = 'repeating_' + section + '_' + rowId + '_';
    var attrs = findObjs({
      _type: 'attribute',
      characterid: characterId
    }) || [];

    var removed = false;
    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      if (!attr || typeof attr.get !== 'function') {
        continue;
      }
      var name = attr.get('name') || '';
      if (name.indexOf(prefix) !== 0) {
        continue;
      }
      try {
        attr.remove();
        removed = true;
      } catch (err) {
        // Ignore removal failure; attribute may already be gone.
      }
    }

    var orderAttr = findObjs({
      _type: 'attribute',
      characterid: characterId,
      name: '_reporder_repeating_' + section
    })[0];

    if (orderAttr && typeof orderAttr.get === 'function') {
      var currentOrder = String(orderAttr.get('current') || '');
      if (currentOrder) {
        var parts = currentOrder.split(',');
        var filtered = [];
        for (var j = 0; j < parts.length; j += 1) {
          if (parts[j] && parts[j] !== rowId) {
            filtered.push(parts[j]);
          }
        }
        try {
          orderAttr.set('current', filtered.join(','));
        } catch (err) {
          // Ignore failures writing back order attribute.
        }
      }
    }

    return removed;
  }

  function removeRelicInventory(characterId, relicId) {
    var rows = findRelicInventoryRows(characterId, relicId);
    var removed = false;
    for (var i = 0; i < rows.length; i += 1) {
      if (removeRepeatingRow(characterId, 'inventory', rows[i])) {
        removed = true;
      }
    }
    return removed;
  }

  function grantRelic(characterId, relicId) {
    var result = {
      ok: false,
      inventoryApplied: false,
      abilityApplied: false,
      stateUpdates: [],
      reason: null
    };

    if (!characterId) {
      result.reason = 'missing_character';
      logWarn('grantRelic called without a characterId.');
      return result;
    }

    var payload = fetchRelicPayload(relicId);
    if (!payload) {
      result.reason = 'missing_definition';
      logError('Relic definition for "' + relicId + '" not found.');
      return result;
    }

    var helper = getAdapterHelper();
    if (!helper) {
      logWarn('Effect adapter helper unavailable; relic effects may need manual entry.');
    }

    var relicName = sanitizeName(payload.name);
    var hoardName = 'Hoard: ' + relicName;

    if (helper && typeof helper.ensureRelicInventory === 'function') {
      var inventoryResult = helper.ensureRelicInventory({
        characterId: characterId,
        relicId: payload.id,
        itemName: payload.inventory && payload.inventory.name ? payload.inventory.name : relicName,
        relicName: payload.inventory && payload.inventory.name ? payload.inventory.name : relicName,
        description: (payload.inventory && payload.inventory.description) || (payload.ability && payload.ability.description) || '',
        mods: payload.inventory && payload.inventory.mods ? payload.inventory.mods : [],
        metaVersion: (payload.inventory && payload.inventory.metaVersion) || payload.metaVersion || 1
      });
      result.inventoryApplied = inventoryResult && inventoryResult.ok;
    }

    if (hasHoardAbility(characterId, relicName)) {
      result.abilityApplied = true;
    } else if (helper && typeof helper.ensureRelicAbility === 'function') {
      var abilityResult = helper.ensureRelicAbility(characterId, {
        relicName: payload.ability && payload.ability.relicName ? payload.ability.relicName : relicName,
        name: payload.ability && payload.ability.name ? payload.ability.name : relicName,
        description: (payload.ability && payload.ability.description) || (payload.inventory && payload.inventory.description) || '',
        metaVersion: (payload.ability && payload.ability.metaVersion) || payload.metaVersion || 1
      });
      if (abilityResult && abilityResult.ok) {
        result.abilityApplied = true;
        ensureHoardAbilityName(characterId, abilityResult.abilityId, hoardName, 'HR Relic: ' + relicName);
      }
    }

    result.stateUpdates = attachRelicToPlayers(characterId, payload, hoardName);

    if (result.inventoryApplied || result.abilityApplied || result.stateUpdates.length) {
      result.ok = true;
      logInfo('Granted relic "' + hoardName + '" to character ' + characterId + '.');
    } else {
      result.reason = 'apply_failed';
      logWarn('Relic "' + hoardName + '" could not be applied to character ' + characterId + '.');
    }

    return result;
  }

  function removeRelic(characterId, relicId) {
    var result = {
      ok: false,
      inventoryRemoved: false,
      abilityRemoved: false,
      stateUpdates: [],
      reason: null
    };

    if (!characterId) {
      result.reason = 'missing_character';
      logWarn('removeRelic called without a characterId.');
      return result;
    }

    var payload = fetchRelicPayload(relicId);
    if (!payload) {
      result.reason = 'missing_definition';
      logError('Relic definition for removal "' + relicId + '" not found.');
      return result;
    }

    var relicName = sanitizeName(payload.name);
    var hoardName = 'Hoard: ' + relicName;

    result.inventoryRemoved = removeRelicInventory(characterId, payload.id);
    result.abilityRemoved = removeRelicAbility(characterId, relicName);
    result.stateUpdates = removeRelicFromPlayers(characterId, payload.id);

    if (result.inventoryRemoved || result.abilityRemoved || result.stateUpdates.length) {
      result.ok = true;
      logInfo('Removed relic "' + hoardName + '" from character ' + characterId + '.');
    } else {
      result.reason = 'not_found';
      logWarn('Relic "' + hoardName + '" not found on character ' + characterId + ' during removal.');
    }

    return result;
  }

  return {
    grantRelic: grantRelic,
    removeRelic: removeRelic
  };
})();
