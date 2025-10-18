// ------------------------------------------------------------
// Effect Adapter — D&D 5e by Roll20
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides sheet-specific logic for the Roll20 5e sheet.
//   Adds and removes repeating global modifiers and namespaced
//   attributes so Hoard Run effects can patch attacks and DCs.
// ------------------------------------------------------------

(function () {
  if (typeof EffectAdapters === 'undefined' || !EffectAdapters || typeof EffectAdapters.registerAdapter !== 'function') {
    return;
  }

  function randRowId() {
    if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.generateRowId === 'function') {
      return AttributeManager.generateRowId();
    }

    var charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var output = '-';
    for (var i = 0; i < 19; i++) {
      var idx = Math.floor(Math.random() * charset.length);
      output += charset.charAt(idx);
    }
    return output;
  }

  function setAttr(charId, name, value) {
    if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.setAttributes === 'function') {
      var res = AttributeManager.setAttributes(charId, [{ name: name, current: value }]);
      if (res && res[0] && res[0].attribute) {
        return res[0].attribute;
      }
    }

    var attr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: name
    })[0];

    if (!attr) {
      attr = createObj('attribute', {
        characterid: charId,
        name: name,
        current: value
      });
    } else if (typeof attr.setWithWorker === 'function') {
      attr.setWithWorker({ current: value });
    } else {
      attr.set('current', value);
    }

    return attr;
  }

  function getAttr(charId, name) {
    var attr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: name
    })[0];

    if (!attr) {
      return '';
    }

    var current = attr.get('current');
    return typeof current === 'undefined' || current === null ? '' : current;
  }

  function addNumber(charId, name, delta) {
    var currentRaw = getAttr(charId, name);
    var current = parseFloat(currentRaw);
    if (isNaN(current)) {
      current = 0;
    }

    var change = parseFloat(delta);
    if (isNaN(change)) {
      change = 0;
    }

    if (currentRaw === '') {
      setAttr(charId, name, 0);
      current = 0;
    }

    setAttr(charId, name, current + change);
  }

  function rememberRowId(charId, key, rowId) {
    var existing = String(getAttr(charId, key) || '');
    var list = existing ? existing.split('|') : [];
    var already = false;

    for (var i = 0; i < list.length; i++) {
      if (list[i] === rowId) {
        already = true;
        break;
      }
    }

    if (!already) {
      list.push(rowId);
    }

    setAttr(charId, key, list.join('|'));
  }

  /**
   * Ensure the Roll20 repeating order tracker includes the created row.
   */
  function ensureReporder(charId, section, rowId) {
    if (!rowId) {
      return;
    }

    var orderName = '_reporder_repeating_' + section;
    var current = String(getAttr(charId, orderName) || '');
    var parts = current ? current.split(',') : [];
    var exists = false;

    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === rowId) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      parts.push(rowId);
      setAttr(charId, orderName, parts.join(','));
    }
  }

  function readRowIds(charId, key) {
    var raw = String(getAttr(charId, key) || '');
    var parts = raw ? raw.split('|') : [];
    var ids = [];

    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) {
        ids.push(parts[i]);
      }
    }

    return ids;
  }

  function clearRowIds(charId, key) {
    setAttr(charId, key, '');
  }

  function removeRepeatingRow(charId, section, rowId) {
    var prefix = 'repeating_' + section + '_' + rowId + '_';
    var attrs = findObjs({
      _type: 'attribute',
      characterid: charId
    }) || [];

    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var name = attr.get('name') || '';
      if (name.indexOf(prefix) === 0) {
        try {
          attr.remove();
        } catch (err) {
          // Ignore removal issues; sandbox may throw if already deleted.
        }
      }
    }

    var orderAttr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: '_reporder_repeating_' + section
    })[0];

    if (orderAttr) {
      var currentOrder = String(orderAttr.get('current') || '');
      if (currentOrder) {
        var orderParts = currentOrder.split(',');
        var filtered = [];

        for (var j = 0; j < orderParts.length; j++) {
          if (orderParts[j] && orderParts[j] !== rowId) {
            filtered.push(orderParts[j]);
          }
        }

        orderAttr.set('current', filtered.join(','));
      }
    }
  }

  var inventoryWatchdogInstalled = false;

  var inventoryAdditiveTokens = {
    'Melee Attacks': true,
    'Melee Damage': true,
    'AC': true,
    'Saving Throws': true,
    'Strength Save': true,
    'Dexterity Save': true,
    'Constitution Save': true,
    'Intelligence Save': true,
    'Wisdom Save': true,
    'Charisma Save': true,
    'Ability Checks': true,
    'Acrobatics': true,
    'Animal Handling': true,
    'Arcana': true,
    'Athletics': true,
    'Deception': true,
    'History': true,
    'Insight': true,
    'Intimidation': true,
    'Investigation': true,
    'Medicine': true,
    'Nature': true,
    'Perception': true,
    'Performance': true,
    'Persuasion': true,
    'Religion': true,
    'Sleight of Hand': true,
    'Stealth': true,
    'Survival': true,
    'Spell Attack': true,
    'Spell DC': true,
    'Strength': true,
    'Dexterity': true,
    'Constitution': true,
    'Intelligence': true,
    'Wisdom': true,
    'Charisma': true
  };

  var inventoryReplacementTokens = {
    'Strength': true,
    'Dexterity': true,
    'Constitution': true,
    'Intelligence': true,
    'Wisdom': true,
    'Charisma': true
  };

  function sanitizeInventoryMods(mods) {
    var sanitized = [];
    var seen = {};

    if (!mods || !mods.length) {
      return sanitized;
    }

    for (var i = 0; i < mods.length; i++) {
      var raw = mods[i];
      if (typeof raw === 'undefined' || raw === null) {
        continue;
      }

      var cleaned = String(raw).replace(/\s+/g, ' ').trim();
      if (!cleaned) {
        continue;
      }

      var additiveMatch = cleaned.match(/^(.*?)(?:\s+)?\+(-?\d+)$/);
      if (additiveMatch) {
        var additiveName = additiveMatch[1].replace(/\s+/g, ' ').trim();
        var additiveValue = additiveMatch[2];
        if (inventoryAdditiveTokens[additiveName]) {
          var parsedAdditive = parseInt(additiveValue, 10);
          if (!isNaN(parsedAdditive) && String(parsedAdditive) === additiveValue.replace(/^\+/, '')) {
            var additiveToken = additiveName + ' ' + (parsedAdditive >= 0 ? '+' : '') + parsedAdditive;
            if (!seen[additiveToken]) {
              sanitized.push(additiveToken);
              seen[additiveToken] = true;
            }
          }
        }
        continue;
      }

      var replaceMatch = cleaned.match(/^(.*?):\s*(-?\d+)$/);
      if (replaceMatch) {
        var replaceName = replaceMatch[1].replace(/\s+/g, ' ').trim();
        var replaceValue = replaceMatch[2];
        if (inventoryReplacementTokens[replaceName]) {
          var parsedReplace = parseInt(replaceValue, 10);
          if (!isNaN(parsedReplace) && String(parsedReplace) === replaceValue) {
            var replaceToken = replaceName + ': ' + parsedReplace;
            if (!seen[replaceToken]) {
              sanitized.push(replaceToken);
              seen[replaceToken] = true;
            }
          }
        }
      }
    }

    return sanitized;
  }

  function buildHoardMetaString(relicId, version) {
    var meta = { type: 'relic', id: relicId, ver: String(version || '1') };
    try {
      return JSON.stringify(meta);
    } catch (err) {
      return '{"type":"relic","id":"' + relicId + '","ver":"' + String(version || '1') + '"}';
    }
  }

  function parseHoardMetaValue(value) {
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

  function findHoardRelicInventoryRow(charId, relicId) {
    var target = String(relicId || '').toLowerCase();
    if (!target) {
      return '';
    }

    var attrs = findObjs({
      _type: 'attribute',
      characterid: charId
    }) || [];

    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var name = attr.get('name') || '';
      if (name.indexOf('repeating_inventory_') !== 0) {
        continue;
      }

      if (name.slice(-11) !== '_hoard_meta') {
        continue;
      }

      var rowMatch = name.match(/^repeating_inventory_([A-Za-z0-9\-]+)_hoard_meta$/);
      if (!rowMatch) {
        continue;
      }

      var meta = parseHoardMetaValue(attr.get('current'));
      if (!meta || meta.type !== 'relic') {
        continue;
      }

      var metaId = meta.id ? String(meta.id).toLowerCase() : '';
      if (metaId === target) {
        return rowMatch[1];
      }
    }

    return '';
  }

  function enforceInventoryLock(charId, rowId) {
    if (!charId || !rowId) {
      return;
    }

    var equippedName = 'repeating_inventory_' + rowId + '_equipped';
    var equippedAttr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: equippedName
    })[0];

    if (equippedAttr) {
      var current = String(equippedAttr.get('current') || '');
      if (current !== '1') {
        if (typeof equippedAttr.setWithWorker === 'function') {
          equippedAttr.setWithWorker({ current: '1' });
        } else {
          equippedAttr.set('current', '1');
        }
      }
      return;
    }

    setAttr(charId, equippedName, '1');
  }

  function syncRelicInventoryRow(charId, patch, effect) {
    var relicId = String(patch.relicId || (effect && effect.id) || '').toLowerCase();
    if (!charId || !relicId) {
      return false;
    }

    var rowId = findHoardRelicInventoryRow(charId, relicId);
    if (!rowId) {
      rowId = randRowId();
    }

    var prefix = 'repeating_inventory_' + rowId + '_';
    var baseName = patch.itemName || (effect && effect.name) || relicId;
    var itemName = 'Hoard: ' + String(baseName);
    var mods = sanitizeInventoryMods(patch.mods || []);
    var content = pickFirst(
      patch.content,
      effect && effect.note,
      ''
    );
    var metaVersion = patch.metaVersion || 1;

    setAttr(charId, prefix + 'itemname', itemName);
    setAttr(charId, prefix + 'itemcount', '1');
    setAttr(charId, prefix + 'itemweight', '');
    setAttr(charId, prefix + 'equipped', '1');
    setAttr(charId, prefix + 'itemmodifiers', mods.join(', '));
    setAttr(charId, prefix + 'itemcontent', String(content || ''));
    setAttr(charId, prefix + 'hoard_meta', buildHoardMetaString(relicId, metaVersion));
    setAttr(charId, prefix + 'hoard_lock', '1');

    ensureReporder(charId, 'inventory', rowId);
    enforceInventoryLock(charId, rowId);
    return true;
  }

  function removeRelicInventoryRow(charId, relicId) {
    var rowId = findHoardRelicInventoryRow(charId, relicId);
    if (!rowId) {
      return;
    }
    removeRepeatingRow(charId, 'inventory', rowId);
  }

  function purgeHoardRelicInventory(charId) {
    if (!charId) {
      return 0;
    }

    var attrs = findObjs({
      _type: 'attribute',
      characterid: charId
    }) || [];

    var rows = [];
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
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

      var meta = parseHoardMetaValue(attr.get('current'));
      if (meta && meta.type === 'relic') {
        rows.push(match[1]);
      }
    }

    var removed = 0;
    for (var j = 0; j < rows.length; j++) {
      removeRepeatingRow(charId, 'inventory', rows[j]);
      removed += 1;
    }

    return removed;
  }

  function handleInventoryEquipChange(attr) {
    if (!attr) {
      return;
    }

    var name = attr.get('name') || '';
    var match = name.match(/^repeating_inventory_([A-Za-z0-9\-]+)_equipped$/);
    if (!match) {
      return;
    }

    var rowId = match[1];
    var charId = attr.get('characterid');
    if (!charId) {
      return;
    }

    var lockAttr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: 'repeating_inventory_' + rowId + '_hoard_lock'
    })[0];

    if (!lockAttr || String(lockAttr.get('current') || '').trim() !== '1') {
      return;
    }

    var metaAttr = findObjs({
      _type: 'attribute',
      characterid: charId,
      name: 'repeating_inventory_' + rowId + '_hoard_meta'
    })[0];

    if (!metaAttr) {
      return;
    }

    var meta = parseHoardMetaValue(metaAttr.get('current'));
    if (!meta || meta.type !== 'relic') {
      return;
    }

    var current = String(attr.get('current') || '');
    if (current !== '1') {
      if (typeof attr.setWithWorker === 'function') {
        attr.setWithWorker({ current: '1' });
      } else {
        attr.set('current', '1');
      }
    }
  }

  function installInventoryLockWatchdog() {
    if (inventoryWatchdogInstalled) {
      return;
    }
    if (typeof on !== 'function') {
      return;
    }

    inventoryWatchdogInstalled = true;
    on('change:attribute', function (attr) {
      try {
        handleInventoryEquipChange(attr);
      } catch (err) {
        // Silent guard; sandbox may throw if attribute vanished mid-change.
      }
    });
  }

  function toActiveValue(value, fallback) {
    if (typeof fallback === 'undefined') {
      fallback = true;
    }

    if (typeof value === 'undefined' || value === null) {
      return fallback ? 1 : 0;
    }

    var str = String(value).toLowerCase();
    if (str === 'on' || str === 'true') {
      return 1;
    }
    if (str === 'off' || str === 'false') {
      return 0;
    }
    if (str === '' || str === '0') {
      return 0;
    }

    var num = Number(value);
    if (!isNaN(num)) {
      return num ? 1 : 0;
    }

    return fallback ? 1 : 0;
  }

  function pickFirst() {
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value === null || typeof value === 'undefined') {
        continue;
      }
      if (typeof value === 'string' && value.trim() === '') {
        continue;
      }
      return value;
    }
    return '';
  }

  function toSegmentBase(value) {
    if (typeof value === 'number') {
      if (value === 0) {
        return '0';
      }
      return (value >= 0 ? '+' : '') + value;
    }
    if (typeof value === 'string') {
      return value.replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function formatSegment(base, label) {
    var segment = toSegmentBase(base);
    if (!segment) {
      return '';
    }

    var tag = typeof label === 'undefined' || label === null ? '' : String(label);
    tag = tag.replace(/\s+/g, ' ').trim();
    if (tag) {
      segment += ' [' + tag + ']';
    }
    return segment;
  }

  function readLedger(charId, name) {
    var raw = String(getAttr(charId, name) || '').trim();
    if (!raw) {
      return [];
    }

    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.length) {
        return parsed;
      }
    } catch (err) {
      // Ignore parse errors; treat as empty ledger.
    }

    return [];
  }

  function writeLedger(charId, name, entries) {
    if (!entries || !entries.length) {
      setAttr(charId, name, '');
      return;
    }

    try {
      setAttr(charId, name, JSON.stringify(entries));
    } catch (err) {
      setAttr(charId, name, '');
    }
  }

  function extractLedgerDelta(entry) {
    if (!entry) {
      return 0;
    }

    var raw = typeof entry.delta !== 'undefined' ? entry.delta : entry.amount;
    var value = Number(raw);
    return isNaN(value) ? 0 : value;
  }

  function sumLedgerDelta(entries) {
    var total = 0;
    if (!entries || !entries.length) {
      return total;
    }

    for (var i = 0; i < entries.length; i++) {
      total += extractLedgerDelta(entries[i]);
    }

    return total;
  }

  function updateAdditiveBucket(charId, attrName, entries) {
    if (!attrName) {
      return;
    }

    var total = sumLedgerDelta(entries);
    setAttr(charId, attrName, total || 0);
  }

  function normalizeLabel(label) {
    if (typeof label === 'undefined' || label === null) {
      return '';
    }

    return String(label).replace(/\s+/g, ' ').trim();
  }

  function buildAcMiscLabel(entries) {
    var base = 'Hoard: AC Mods';
    if (!entries || !entries.length) {
      return base;
    }

    var seen = {};
    var labels = [];

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || !entry.label) {
        continue;
      }

      var normalized = normalizeLabel(entry.label);
      if (!normalized) {
        continue;
      }

      var dedupeKey = normalized.toLowerCase();
      if (seen[dedupeKey]) {
        continue;
      }

      seen[dedupeKey] = true;
      labels.push(normalized);
    }

    if (!labels.length) {
      return base;
    }

    var slice = labels.slice(0, 3);
    var suffix = slice.join(', ');
    if (labels.length > 3) {
      suffix += ', +' + (labels.length - 3) + ' more';
    }

    return base + ' (' + suffix + ')';
  }

  function escapeForRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function appendSegmentToAttr(charId, attrName, segment) {
    var addition = String(segment || '').trim();
    if (!addition) {
      return String(getAttr(charId, attrName) || '').trim();
    }

    var current = String(getAttr(charId, attrName) || '').trim();
    var combined = current ? (current + ' ' + addition) : addition;
    combined = combined.replace(/\s+/g, ' ').trim();
    setAttr(charId, attrName, combined);
    return combined;
  }

  function removeSegmentFromAttr(charId, attrName, segment) {
    var target = String(segment || '').trim();
    if (!target) {
      return String(getAttr(charId, attrName) || '').trim();
    }

    var current = String(getAttr(charId, attrName) || '');
    if (!current) {
      return '';
    }

    var pattern = new RegExp('(?:^|\\s)' + escapeForRegex(target) + '(?=\\s|$)', 'g');
    var updated = current.replace(pattern, function (match) {
      return match.indexOf(' ') === 0 ? ' ' : '';
    });
    updated = updated.replace(/\s+/g, ' ').trim();
    setAttr(charId, attrName, updated);
    return updated;
  }

  function syncFlagToAttr(charId, attrName, flagName) {
    if (!flagName) {
      return;
    }
    var current = String(getAttr(charId, attrName) || '').trim();
    setAttr(charId, flagName, current ? 'on' : '0');
  }

  function resolveLabel(patch, effect, fallback) {
    if (patch && patch.label) {
      return String(patch.label);
    }
    if (patch && patch.name) {
      return String(patch.name);
    }
    if (effect && effect.name) {
      return String(effect.name);
    }
    if (effect && effect.id) {
      return String(effect.id);
    }
    if (patch && patch.op) {
      return String(patch.op);
    }
    return fallback || 'Effect';
  }

  function getLedgerKey(patch, effect) {
    if (patch && patch.ledgerKey) {
      return String(patch.ledgerKey);
    }
    if (patch && patch.id) {
      return String(patch.id);
    }
    if (patch && patch.key) {
      return String(patch.key);
    }
    if (effect && effect.id) {
      var suffix = '';
      if (patch && patch.label) {
        suffix = '::' + patch.label;
      } else if (patch && patch.name) {
        suffix = '::' + patch.name;
      } else if (patch && patch.op) {
        suffix = '::' + patch.op;
      }
      return String(effect.id) + suffix;
    }
    if (patch && patch.label) {
      return String(patch.label);
    }
    if (patch && patch.name) {
      return String(patch.name);
    }
    if (patch && patch.op) {
      return String(patch.op);
    }
    return 'effect';
  }

  function addGlobalStringMath(charId, attrName, flagName, ledgerName, ledgerKey, baseValue, label) {
    var segment = formatSegment(baseValue, label);
    if (!segment) {
      return false;
    }

    appendSegmentToAttr(charId, attrName, segment);
    syncFlagToAttr(charId, attrName, flagName);

    var ledger = readLedger(charId, ledgerName);
    var remaining = [];
    for (var i = 0; i < ledger.length; i++) {
      var entry = ledger[i];
      if (entry && entry.key !== ledgerKey) {
        remaining.push(entry);
      }
    }
    remaining.push({ key: ledgerKey, segment: segment });
    writeLedger(charId, ledgerName, remaining);
    return true;
  }

  function removeGlobalStringMath(charId, attrName, flagName, ledgerName, ledgerKey) {
    var ledger = readLedger(charId, ledgerName);
    var remaining = [];
    var removed = [];
    for (var i = 0; i < ledger.length; i++) {
      var entry = ledger[i];
      if (entry && entry.key === ledgerKey) {
        removed.push(entry.segment);
      } else if (entry) {
        remaining.push(entry);
      }
    }

    for (var r = 0; r < removed.length; r++) {
      removeSegmentFromAttr(charId, attrName, removed[r]);
    }

    writeLedger(charId, ledgerName, remaining);
    if (!remaining.length) {
      var value = String(getAttr(charId, attrName) || '').trim();
      if (!value) {
        setAttr(charId, attrName, '');
      }
    }
    syncFlagToAttr(charId, attrName, flagName);
  }

  function addGlobalDamageMath(charId, ledgerKey, label, rollValue, critValue, typeValue) {
    var rollSegment = formatSegment(rollValue, label);
    var critSegment = formatSegment(critValue, label);
    var typeSegment = formatSegment(typeValue, label);

    if (!rollSegment && !critSegment && !typeSegment) {
      return false;
    }

    if (rollSegment) {
      appendSegmentToAttr(charId, 'global_damage_mod', rollSegment);
    }
    if (critSegment) {
      appendSegmentToAttr(charId, 'global_damage_mod_crit', critSegment);
    }
    if (typeSegment) {
      appendSegmentToAttr(charId, 'global_damage_mod_type', typeSegment);
    }

    syncFlagToAttr(charId, 'global_damage_mod', 'global_damage_mod_flag');
    syncFlagToAttr(charId, 'global_damage_mod_crit', 'global_damage_mod_crit_flag');
    syncFlagToAttr(charId, 'global_damage_mod_type', 'global_damage_mod_type_flag');

    var ledger = readLedger(charId, 'hr_ledger_global_damage_mod');
    var remaining = [];
    for (var i = 0; i < ledger.length; i++) {
      var entry = ledger[i];
      if (entry && entry.key !== ledgerKey) {
        remaining.push(entry);
      }
    }
    remaining.push({
      key: ledgerKey,
      roll: rollSegment,
      crit: critSegment,
      type: typeSegment
    });
    writeLedger(charId, 'hr_ledger_global_damage_mod', remaining);
    return true;
  }

  function removeGlobalDamageMath(charId, ledgerKey) {
    var ledger = readLedger(charId, 'hr_ledger_global_damage_mod');
    var remaining = [];
    var removed = [];
    for (var i = 0; i < ledger.length; i++) {
      var entry = ledger[i];
      if (entry && entry.key === ledgerKey) {
        removed.push(entry);
      } else if (entry) {
        remaining.push(entry);
      }
    }

    for (var r = 0; r < removed.length; r++) {
      var item = removed[r];
      if (item.roll) {
        removeSegmentFromAttr(charId, 'global_damage_mod', item.roll);
      }
      if (item.crit) {
        removeSegmentFromAttr(charId, 'global_damage_mod_crit', item.crit);
      }
      if (item.type) {
        removeSegmentFromAttr(charId, 'global_damage_mod_type', item.type);
      }
    }

    writeLedger(charId, 'hr_ledger_global_damage_mod', remaining);

    var rollValue = String(getAttr(charId, 'global_damage_mod') || '').trim();
    if (!rollValue) {
      setAttr(charId, 'global_damage_mod', '');
    }

    var critValue = String(getAttr(charId, 'global_damage_mod_crit') || '').trim();
    if (!critValue) {
      setAttr(charId, 'global_damage_mod_crit', '');
    }

    var typeValue = String(getAttr(charId, 'global_damage_mod_type') || '').trim();
    if (!typeValue) {
      setAttr(charId, 'global_damage_mod_type', '');
    }

    syncFlagToAttr(charId, 'global_damage_mod', 'global_damage_mod_flag');
    syncFlagToAttr(charId, 'global_damage_mod_crit', 'global_damage_mod_crit_flag');
    syncFlagToAttr(charId, 'global_damage_mod_type', 'global_damage_mod_type_flag');
  }

  function ensureGlobalRow(charId, section, fields, rememberKey) {
    try {
      var created = null;
      if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.createRepeatingRow === 'function') {
        created = AttributeManager.createRepeatingRow(charId, section, fields);
      }

      var rowId = created && created.rowId ? created.rowId : randRowId();
      if (!created || !created.attributes || !created.attributes.length) {
        for (var field in fields) {
          if (fields.hasOwnProperty(field)) {
            var attrName = 'repeating_' + section + '_' + rowId + '_' + field;
            setAttr(charId, attrName, fields[field]);
          }
        }
      }
      ensureReporder(charId, section, rowId);
      if (rememberKey) {
        rememberRowId(charId, rememberKey, rowId);
      }
      return { ok: true, rowId: rowId };
    } catch (err) {
      sendChat('Adapter', '/w gm Failed to create repeating_' + section + ' row: ' + err.message);
      return { ok: false };
    }
  }

  function applyPatch(charId, patch, effect) {
    if (!patch || patch.type !== 'adapter' || !patch.op) {
      return false;
    }

    if (patch.op === 'add_global_skill_mod') {
      var skillMath = pickFirst(patch.math, patch.value, patch.bonus, patch.roll);
      var skillLabel = resolveLabel(patch, effect, 'Skill Mod');
      var skillKey = getLedgerKey(patch, effect);
      return addGlobalStringMath(
        charId,
        'global_skill_mod',
        'global_skill_mod_flag',
        'hr_ledger_global_skill_mod',
        skillKey,
        skillMath,
        skillLabel
      );
    }

    if (patch.op === 'add_global_save_mod') {
      var saveMath = pickFirst(patch.math, patch.value, patch.bonus, patch.roll);
      var saveLabel = resolveLabel(patch, effect, 'Save Mod');
      var saveKey = getLedgerKey(patch, effect);
      return addGlobalStringMath(
        charId,
        'global_save_mod',
        'global_save_mod_flag',
        'hr_ledger_global_save_mod',
        saveKey,
        saveMath,
        saveLabel
      );
    }

    if (patch.op === 'add_global_damage_mod') {
      var dmgLabel = resolveLabel(patch, effect, 'Damage Mod');
      var dmgKey = getLedgerKey(patch, effect);
      var rollValue = pickFirst(patch.math, patch.roll, patch.value, patch.bonus);
      var critValue = pickFirst(patch.crit, patch.critMath, patch.critBonus);
      var typeValue = pickFirst(patch.damageType, patch.type, patch.element, patch.damageTag);
      return addGlobalDamageMath(charId, dmgKey, dmgLabel, rollValue, critValue, typeValue);
    }

    if (patch.op === 'add_speed_bonus') {
      addNumber(charId, 'hr_speed_bonus_total', patch.value || 0);
      return true;
    }

    if (patch.op === 'add_initiative_bonus') {
      var initiativeValue = Number(pickFirst(patch.value, patch.bonus, patch.amount, patch.delta, 0));
      if (isNaN(initiativeValue)) {
        initiativeValue = 0;
      }

      var initiativeLedgerKey = getLedgerKey(patch, effect);
      var initiativeLedger = readLedger(charId, 'hr_ledger_add_initiative_bonus');
      var filteredInitiative = [];
      var previousInitiative = 0;

      for (var i = 0; i < initiativeLedger.length; i++) {
        var initiativeEntry = initiativeLedger[i];
        if (initiativeEntry && initiativeEntry.key === initiativeLedgerKey) {
          previousInitiative += extractLedgerDelta(initiativeEntry);
        } else if (initiativeEntry) {
          filteredInitiative.push(initiativeEntry);
        }
      }

      if (previousInitiative !== 0) {
        addNumber(charId, 'initiative_bonus', -previousInitiative);
      }

      if (initiativeValue !== 0) {
        addNumber(charId, 'initiative_bonus', initiativeValue);
        filteredInitiative.push({
          key: initiativeLedgerKey,
          delta: initiativeValue,
          label: resolveLabel(patch, effect, 'Initiative Bonus')
        });
      }

      writeLedger(charId, 'hr_ledger_add_initiative_bonus', filteredInitiative);
      updateAdditiveBucket(charId, 'hr_initiative_bonus_total', filteredInitiative);
      return true;
    }

    if (patch.op === 'add_death_save_bonus') {
      var deathSaveValue = Number(pickFirst(patch.value, patch.bonus, patch.amount, patch.delta, 0));
      if (isNaN(deathSaveValue)) {
        deathSaveValue = 0;
      }

      var deathLedgerKey = getLedgerKey(patch, effect);
      var deathLedger = readLedger(charId, 'hr_ledger_add_death_save_bonus');
      var filteredDeath = [];
      var previousDeath = 0;

      for (var j = 0; j < deathLedger.length; j++) {
        var deathEntry = deathLedger[j];
        if (deathEntry && deathEntry.key === deathLedgerKey) {
          previousDeath += extractLedgerDelta(deathEntry);
        } else if (deathEntry) {
          filteredDeath.push(deathEntry);
        }
      }

      if (previousDeath !== 0) {
        addNumber(charId, 'death_save_bonus', -previousDeath);
      }

      if (deathSaveValue !== 0) {
        addNumber(charId, 'death_save_bonus', deathSaveValue);
        filteredDeath.push({
          key: deathLedgerKey,
          delta: deathSaveValue,
          label: resolveLabel(patch, effect, 'Death Save Bonus')
        });
      }

      writeLedger(charId, 'hr_ledger_add_death_save_bonus', filteredDeath);
      updateAdditiveBucket(charId, 'hr_death_save_bonus_total', filteredDeath);
      return true;
    }

    if (patch.op === 'add_global_spell_attack') {
      var attackValue = Number(patch.value || 0);
      var attackString = (attackValue >= 0 ? '+' : '') + attackValue;

      var attackRow = ensureGlobalRow(charId, 'attackmod', {
        'global_attack_name': 'Hoard: Spell Attacks ' + attackString,
        'global_attack_attack': attackString,
        'global_attack_roll': 'on'
      }, 'hr_rows_attackmod');

      if (attackRow.ok) {
        return true;
      }

      var legacyAttack = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'global_spell_attack_bonus'
      })[0];

      if (legacyAttack) {
        var curAttack = String(legacyAttack.get('current') || '').trim();
        legacyAttack.set('current', curAttack ? curAttack + ' ' + attackString : attackString);
        return true;
      }

      addNumber(charId, 'hr_spell_attack_bonus_total', attackValue);
      return true;
    }

    if (patch.op === 'add_global_save_dc') {
      var saveValue = Number(patch.value || 0);
      var saveString = (saveValue >= 0 ? '+' : '') + saveValue;

      var saveRow = ensureGlobalRow(charId, 'savemod', {
        'global_save_name': 'Hoard: Spell DC ' + saveString,
        'global_save_bonus': saveString,
        'global_save_roll': 'on'
      }, 'hr_rows_savemod');

      if (saveRow.ok) {
        return true;
      }

      var legacySave = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'global_spell_dc_bonus'
      })[0];

      if (legacySave) {
        var curSave = String(legacySave.get('current') || '').trim();
        legacySave.set('current', curSave ? curSave + ' ' + saveString : saveString);
        return true;
      }

      addNumber(charId, 'hr_spell_dc_bonus_total', saveValue);
      return true;
    }

    if (patch.op === 'add_resource_counter') {
      var base = 'hr_res_' + String(patch.name || 'resource').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      setAttr(charId, base + '_max', patch.max || 1);
      setAttr(charId, base + '_cur', patch.max || 1);
      setAttr(charId, base + '_cadence', patch.cadence || 'per_room');
      return true;
    }

    if (patch.op === 'on_kill_refresh') {
      var list = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'hr_on_kill_hooks'
      })[0];

      if (!list) {
        list = createObj('attribute', {
          characterid: charId,
          name: 'hr_on_kill_hooks',
          current: ''
        });
      }

      var existingHooks = list.get('current') || '';
      var feature = String(patch.feature || 'Feature').replace(/[|]/g, '/');
      list.set('current', existingHooks ? existingHooks + '|' + feature : feature);
      return true;
    }

    if (patch.op === 'add_aura') {
      var auraName = String(patch.name || 'Aura').replace(/[|]/g, '/');
      var packed = auraName + '::' + (patch.radius || 10) + '::' + (patch.note || '');
      setAttr(charId, 'hr_token_aura_cfg', packed);
      return true;
    }

    if (patch.op === 'sync_relic_inventory') {
      return syncRelicInventoryRow(charId, patch, effect);
    }

    return false;
  }

  function removePatch(charId, patch, effect) {
    if (!patch || patch.type !== 'adapter' || !patch.op) {
      return false;
    }

    if (patch.op === 'add_global_skill_mod') {
      var skillKey = getLedgerKey(patch, effect);
      removeGlobalStringMath(charId, 'global_skill_mod', 'global_skill_mod_flag', 'hr_ledger_global_skill_mod', skillKey);
      return true;
    }

    if (patch.op === 'add_global_save_mod') {
      var saveKey = getLedgerKey(patch, effect);
      removeGlobalStringMath(charId, 'global_save_mod', 'global_save_mod_flag', 'hr_ledger_global_save_mod', saveKey);
      return true;
    }

    if (patch.op === 'add_global_damage_mod') {
      var dmgKey = getLedgerKey(patch, effect);
      removeGlobalDamageMath(charId, dmgKey);
      return true;
    }

    if (patch.op === 'add_speed_bonus') {
      var speedAttr = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'hr_speed_bonus_total'
      })[0];
      if (speedAttr) {
        speedAttr.set('current', 0);
      }
      return true;
    }

    if (patch.op === 'add_initiative_bonus') {
      var removeInitiativeKey = getLedgerKey(patch, effect);
      var removeInitiativeLedger = readLedger(charId, 'hr_ledger_add_initiative_bonus');
      var remainingInitiative = [];
      var initiativeDelta = 0;

      for (var m = 0; m < removeInitiativeLedger.length; m++) {
        var initEntry = removeInitiativeLedger[m];
        if (initEntry && initEntry.key === removeInitiativeKey) {
          initiativeDelta += extractLedgerDelta(initEntry);
        } else if (initEntry) {
          remainingInitiative.push(initEntry);
        }
      }

      if (initiativeDelta !== 0) {
        addNumber(charId, 'initiative_bonus', -initiativeDelta);
      }

      writeLedger(charId, 'hr_ledger_add_initiative_bonus', remainingInitiative);
      updateAdditiveBucket(charId, 'hr_initiative_bonus_total', remainingInitiative);
      return true;
    }

    if (patch.op === 'add_death_save_bonus') {
      var removeDeathKey = getLedgerKey(patch, effect);
      var removeDeathLedger = readLedger(charId, 'hr_ledger_add_death_save_bonus');
      var remainingDeath = [];
      var deathDelta = 0;

      for (var n = 0; n < removeDeathLedger.length; n++) {
        var deathEntry = removeDeathLedger[n];
        if (deathEntry && deathEntry.key === removeDeathKey) {
          deathDelta += extractLedgerDelta(deathEntry);
        } else if (deathEntry) {
          remainingDeath.push(deathEntry);
        }
      }

      if (deathDelta !== 0) {
        addNumber(charId, 'death_save_bonus', -deathDelta);
      }

      writeLedger(charId, 'hr_ledger_add_death_save_bonus', remainingDeath);
      updateAdditiveBucket(charId, 'hr_death_save_bonus_total', remainingDeath);
      return true;
    }

    if (patch.op === 'add_global_spell_attack') {
      var attackIds = readRowIds(charId, 'hr_rows_attackmod');
      for (var i = 0; i < attackIds.length; i++) {
        removeRepeatingRow(charId, 'attackmod', attackIds[i]);
      }
      clearRowIds(charId, 'hr_rows_attackmod');

      var attackTotal = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'hr_spell_attack_bonus_total'
      })[0];
      if (attackTotal) {
        attackTotal.set('current', 0);
      }
      return true;
    }

    if (patch.op === 'add_global_save_dc') {
      var saveIds = readRowIds(charId, 'hr_rows_savemod');
      for (var j = 0; j < saveIds.length; j++) {
        removeRepeatingRow(charId, 'savemod', saveIds[j]);
      }
      clearRowIds(charId, 'hr_rows_savemod');

      var saveTotal = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'hr_spell_dc_bonus_total'
      })[0];
      if (saveTotal) {
        saveTotal.set('current', 0);
      }
      return true;
    }

    if (patch.op === 'sync_relic_inventory') {
      removeRelicInventoryRow(charId, patch.relicId || (effect && effect.id));
      return true;
    }

    if (patch.op === 'add_resource_counter') {
      var baseName = 'hr_res_' + String(patch.name || 'resource').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      var suffixes = ['_max', '_cur', '_cadence'];
      for (var k = 0; k < suffixes.length; k++) {
        var attr = findObjs({
          _type: 'attribute',
          characterid: charId,
          name: baseName + suffixes[k]
        })[0];
        if (attr) {
          try {
            attr.remove();
          } catch (err) {
            // Ignore removal failures; attribute may already be gone.
          }
        }
      }
      return true;
    }

    if (patch.op === 'on_kill_refresh') {
      return true;
    }

    if (patch.op === 'add_aura') {
      var auraCfg = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'hr_token_aura_cfg'
      })[0];
      if (auraCfg) {
        try {
          auraCfg.remove();
        } catch (err) {
          // Ignore failures; attribute might be locked by sandbox conditions.
        }
      }
      return true;
    }

    return false;
  }

  installInventoryLockWatchdog();

  EffectAdapters.registerAdapter({
    name: 'dnd5e-roll20',
    detect: function (character) {
      var charId = character ? character.id : null;
      if (!charId) {
        return false;
      }
      var pb = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'pb'
      })[0];
      var sca = findObjs({
        _type: 'attribute',
        characterid: charId,
        name: 'spellcasting_ability'
      })[0];
      return !!(pb || sca);
    },
    apply: function (charId, patch, effect) {
      return applyPatch(charId, patch, effect);
    },
    remove: function (charId, patch, effect) {
      return removePatch(charId, patch, effect);
    },
    purgeHoardInventory: function (charId) {
      return purgeHoardRelicInventory(charId);
    }
  });
})();
