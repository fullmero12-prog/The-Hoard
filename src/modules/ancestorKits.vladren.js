// ------------------------------------------------------------
// Ancestor Kit Registration: Vladren Moroi
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Registers the Vladren kit with the shared AncestorKits core.
//   • Supplies roll template actions for Vladren's core abilities.
//   • Ensures each player controlling the bound PC receives the kit handout.
// ------------------------------------------------------------

(function(){
  'use strict';

  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('AncestorKits', message);
    } else if (typeof log === 'function') {
      log('[Hoard Run] [AncestorKits] ⚠️ ' + message);
    }
  }

  var PACT_ITEM_NAME = 'Hoard: Crimson Pact Ward [Vladren]';  // <-- cleaner-safe tag
  var PACT_ITEM_MODS = 'AC +1';
  var PACT_ITEM_DESCRIPTION = 'Crimson Pact: +1 AC while you have Pact Temp HP.';
  var PACT_FLAG_ATTR = 'hr_vladren_pact_enabled';
  var PACT_ROW_ATTR = 'hr_vladren_pact_rowid';

  // ------------------------------------------------------------
  // Crimson Pact Inventory Helpers
  // ------------------------------------------------------------

  function findAttr(charId, name) {
    if (!charId || !name) {
      return null;
    }

    var matches = findObjs({
      _type: 'attribute',
      _characterid: charId,
      name: name
    }) || [];

    return matches[0] || null;
  }

  function setAttr(charId, name, value) {
    if (!charId || !name) {
      return null;
    }

    var attr = findAttr(charId, name);
    var payload = { current: value };

    if (attr) {
      try {
        if (typeof attr.setWithWorker === 'function') {
          attr.setWithWorker(payload);
        } else {
          attr.set('current', value);
        }
      } catch (err) {
        warn('Failed to set attribute ' + name + ' for ' + charId + ': ' + (err.message || err));
      }
      return attr;
    }

    try {
      return createObj('attribute', {
        _characterid: charId,
        name: name,
        current: value
      });
    } catch (errCreate) {
      warn('Failed to create attribute ' + name + ' for ' + charId + ': ' + (errCreate.message || errCreate));
    }
    return null;
  }

  function getAttrCurrent(charId, name) {
    var attr = findAttr(charId, name);
    if (!attr) {
      return null;
    }
    return attr.get('current');
  }

  function ensureAttrValue(charId, name, value) {
    var existing = getAttrCurrent(charId, name);
    if (existing !== null && String(existing) === String(value)) {
      return findAttr(charId, name);
    }
    return setAttr(charId, name, value);
  }

  function normalizeRowId(id) {
    if (id === null || typeof id === 'undefined') {
      return '';
    }

    var trimmed = String(id).trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.charAt(0) === '-' ? trimmed : '-' + trimmed;
  }

  function parseTempValue(value) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }

  function isPactEnabled(charId) {
    var flag = getAttrCurrent(charId, PACT_FLAG_ATTR);
    if (flag === null || typeof flag === 'undefined') {
      return false;
    }
    var normalized = String(flag).trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
  }

  /**
   * Ensures the hidden Crimson Pact inventory row exists on the sheet.
   * Creates or repairs the row as needed and records its repeating ID.
   * @param {string} charId
   * @returns {?string}
   */
  function matchesPactRow(charId, id) {
    var normalized = normalizeRowId(id);
    if (!charId || !normalized) {
      return false;
    }

    var nameAttr = findAttr(charId, 'repeating_inventory_' + normalized + '_itemname');
    return !!(nameAttr && nameAttr.get('current') === PACT_ITEM_NAME);
  }

  function findExistingPactRowId(charId) {
    if (!charId) {
      return '';
    }

    var storedRow = getAttrCurrent(charId, PACT_ROW_ATTR);
    var rowId = normalizeRowId(storedRow);
    if (matchesPactRow(charId, rowId)) {
      return rowId;
    }

    if (typeof findObjs !== 'function') {
      return '';
    }

    var attrs = findObjs({ _type: 'attribute', _characterid: charId }) || [];
    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var name = attr && attr.get('name');
      if (!name || name.indexOf('repeating_inventory_') !== 0) {
        continue;
      }
      if (!/_itemname$/.test(name)) {
        continue;
      }
      if ((attr.get('current') || '') === PACT_ITEM_NAME) {
        var parts = name.split('_');
        if (parts.length >= 4) {
          rowId = normalizeRowId(parts[2]);
          if (matchesPactRow(charId, rowId)) {
            return rowId;
          }
        }
      }
    }

    return '';
  }

  function ensurePactInventoryRow(charId) {
    if (!charId) {
      return null;
    }

    var rowId = findExistingPactRowId(charId);

    var created = false;
    if (!rowId) {
      if (typeof generateRowID === 'function') {
        rowId = normalizeRowId(generateRowID());
      } else {
        rowId = normalizeRowId(new Date().getTime().toString(36) + Math.floor(Math.random() * 100000));
      }
      created = true;
    }

    var prefix = 'repeating_inventory_' + rowId + '_';

    ensureAttrValue(charId, prefix + 'itemname', PACT_ITEM_NAME);
    ensureAttrValue(charId, prefix + 'itemmodifiers', PACT_ITEM_MODS);
    ensureAttrValue(charId, prefix + 'itemcontent', PACT_ITEM_DESCRIPTION);

    if (created) {
      ensureAttrValue(charId, prefix + 'itemcount', 1);
      ensureAttrValue(charId, prefix + 'itemweight', 0);
      ensureAttrValue(charId, prefix + 'useasresource', 0);
      ensureAttrValue(charId, prefix + 'hasattack', 0);
      ensureAttrValue(charId, prefix + 'itemproperties', '');
    }

    ensureAttrValue(charId, PACT_ROW_ATTR, rowId);
    ensureAttrValue(charId, PACT_FLAG_ATTR, 1);

    return rowId;
  }

  function removeAttribute(charId, name) {
    var attr = findAttr(charId, name);
    if (!attr || typeof attr.remove !== 'function') {
      return false;
    }

    try {
      attr.remove();
      return true;
    } catch (err) {
      warn('Failed to remove attribute ' + name + ' for ' + charId + ': ' + (err.message || err));
      return false;
    }
  }

  function removePactInventoryRow(charId) {
    if (!charId || typeof findObjs !== 'function') {
      return 0;
    }

    var rowId = findExistingPactRowId(charId);
    if (!rowId) {
      return 0;
    }

    var removed = 0;
    var prefix = 'repeating_inventory_' + rowId + '_';
    var attrs = findObjs({ _type: 'attribute', _characterid: charId }) || [];

    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      if (!attr || typeof attr.get !== 'function' || typeof attr.remove !== 'function') {
        continue;
      }

      var name = '';
      try {
        name = attr.get('name') || '';
      } catch (errName) {
        name = '';
      }

      if (!name || name.indexOf(prefix) !== 0) {
        continue;
      }

      try {
        attr.remove();
        removed += 1;
      } catch (errRemove) {
        warn('Failed to remove pact inventory attr ' + name + ' for ' + charId + ': ' + (errRemove.message || errRemove));
      }
    }

    return removed;
  }

  function setPactEquipped(charId, rowId, enable) {
    if (!charId || !rowId) {
      return;
    }
    var desired = enable ? '1' : '0';
    var attrName = 'repeating_inventory_' + rowId + '_equipped';
    var current = getAttrCurrent(charId, attrName);
    if (current !== null && String(current) === desired) {
      return;
    }
    setAttr(charId, attrName, desired);
  }

  /**
   * Synchronizes the pact item's equipped state with current temp HP.
   * @param {string} charId
   */
  function syncPactState(charId) {
    if (!charId) {
      return;
    }
    if (!isPactEnabled(charId)) {
      return;
    }

    var rowId = ensurePactInventoryRow(charId);
    if (!rowId) {
      return;
    }

    var tempAttr = findAttr(charId, 'hp_temp');
    var tempValue = tempAttr ? tempAttr.get('current') : 0;
    setPactEquipped(charId, rowId, parseTempValue(tempValue) > 0);
  }

  /**
   * Listens for hp_temp changes and toggles the Crimson Pact bonus.
   * @param {object} attr
   */
  function handleTempHpChange(attr) {
    try {
      if (!attr || attr.get('name') !== 'hp_temp') {
        return;
      }
      var charId = attr.get('_characterid');
      if (!charId || !isPactEnabled(charId)) {
        return;
      }

      var rowId = ensurePactInventoryRow(charId);
      if (!rowId) {
        return;
      }

      setPactEquipped(charId, rowId, parseTempValue(attr.get('current')) > 0);
    } catch (err) {
      warn('Crimson Pact watcher error: ' + (err.message || err));
    }
  }

  /**
   * Rebuilds pact rows on script restart so existing chars stay synced.
   */
  function seedPactRows() {
    if (typeof findObjs !== 'function') {
      return;
    }

    var flags = findObjs({ _type: 'attribute', name: PACT_FLAG_ATTR }) || [];
    var seen = {};
    for (var i = 0; i < flags.length; i += 1) {
      var flagAttr = flags[i];
      if (!flagAttr) {
        continue;
      }
      var charId = flagAttr.get('_characterid');
      if (!charId || seen[charId]) {
        continue;
      }
      seen[charId] = true;
      if (!isPactEnabled(charId)) {
        continue;
      }
      syncPactState(charId);
    }
  }

  function getAttributeInt(characterId, names) {
    if (!characterId) {
      return null;
    }

    var list = [];
    if (Object.prototype.toString.call(names) === '[object Array]') {
      list = names.slice();
    } else if (typeof names === 'string') {
      list = [names];
    }

    for (var i = 0; i < list.length; i += 1) {
      var attrName = list[i];
      if (!attrName) {
        continue;
      }

      var attr = findObjs({
        _type: 'attribute',
        _characterid: characterId,
        name: attrName
      })[0];

      if (!attr) {
        continue;
      }

      var value = parseInt(attr.get('current'), 10);
      if (!isNaN(value)) {
        return value;
      }
    }

    return null;
  }

  function getAttrInt(characterId, nameList, fallback) {
    var fallbackValue = parseInt(fallback, 10);

    if (!isNaN(fallbackValue)) {
      return fallbackValue;
    }

    var attrValue = getAttributeInt(characterId, nameList);
    if (typeof attrValue === 'number' && !isNaN(attrValue)) {
      return attrValue;
    }

    return 0;
  }

  var KIT_KEY = 'Vladren';
  var KIT_NAME = 'Vladren Moroi';
  var SOURCE_CHARACTER_NAME = 'Ancestor — Vladren Moroi';
  var HANDOUT_TITLE_PREFIX = KIT_NAME + ' — Kit (';
  var TEXT_WRAPPER_START = '<div style="font-family:inherit;font-size:13px;line-height:1.25;">'
    + '<h3 style="margin:0 0 6px 0;">' + KIT_NAME + ' — The Crimson Tide</h3>';
  var TEXT_WRAPPER_END = '</div>';
  var KIT_RULES_HTML = [
    '<b>Crimson Pact.</b> Excess healing becomes <b>temp HP</b> (cap <b>5×PB + spell mod</b>). While you have Pact temp HP: <b>+1 AC</b>; your <b>necrotic ignores resistance</b> (treat immunity as resistance).',
    '<b>Transfusion (Bonus, 1/turn).</b> One creature within <b>60 ft</b> makes a <b>Con save</b>. Fail: <b>2d8 necrotic + PB</b> (success half). You <b>heal</b> for the damage dealt. If the target is <b>½ HP or less</b>, Transfusion deals <b>+1d8 necrotic</b>.',
    '<b>Sanguine Pool (Reaction, 1/room).</b> When you take damage, become <b>blood mist</b> until the start of your next turn: <b>resistance to all</b>, you can <b>move through creatures</b>, you <b>can’t cast leveled spells or make attacks</b>, and <b>enemies can’t make OAs</b> against you. <i>Sovereign Pool:</i> With ≥10 temp HP, gain <b>+15 ft move</b> when you enter and roll Sovereign Pool at the start of your turn; on <b>5–6</b>, refresh Sanguine Pool.',
    '<b>Hemoplague (1/room).</b> <b>20-ft radius</b> point within 60 ft, Con save → target is <b>Plagued</b> until end of next turn (<b>+PB damage</b> from all sources), then it takes <b>6d6 necrotic</b> (success <b>3d6</b>). You <b>heal</b> for the total necrotic; excess healing becomes <b>Pact temp HP</b>.'
  ].join('<br><br>');

  function buildRollTemplate(title, rows) {
    var parts = ['&{template:default} {{name=' + title + '}}'];
    (rows || []).forEach(function(row){
      if (!row || (!row.label && !row.key)) {
        return;
      }
      var key = row.key || row.label;
      var value = row.value || '';
      parts.push('{{' + key + '=' + value + '}}');
    });
    return parts.join(' ');
  }

  function buildCrimsonPactAction() {
    // Uses hr_pb/hr_spellmod attributes set during install; refresh with !hr-sync / !bindkit if stats change.
    return buildRollTemplate('Crimson Pact (Info)', [
      { label: 'Cap', value: '[[ 5*@{selected|hr_pb} + @{selected|hr_spellmod} ]]' },
      { label: 'While active', value: '+1 AC; your necrotic ignores resistance (treat immunity as resistance).' },
      { label: 'Convert healing', value: 'Excess healing becomes Pact temp HP (up to cap).' }
    ]);
  }

function buildTransfusionAction() {
  var dmg    = '[[ 2d8 + @{selected|pb} + ?{Is target ≤ half HP?|No,0|Yes,1d8} ]]';
  var saveDC = '@{selected|spell_save_dc}';
  // Make sure this exactly matches the ability name on the sheet
  var descAbility = '[Vladren] Transfusion - Description';

  return (
    '&{template:dmg} ' +
    '{{rname=[🩸 Transfusion](~selected|' + descAbility + ')}} ' +
    '{{range=60 ft}} ' +
    '{{damage=1}} ' +
    '{{dmg1flag=1}} ' +
    '{{dmg1=' + dmg + '}} ' +
    '{{dmg1type=necrotic}} ' +
    '{{save=1}} ' +
    '{{saveattr=CON}} ' +
    '{{savedc=' + saveDC + '}} ' +
    '{{savedesc=Half damage on success.}}'
  );
}

function buildTransfusionDescriptionAction() {
  // cap = 5*PB + max(0, spell_save_dc - 8 - PB)
  var cap = '[[ (5*@{selected|pb}) + {(@{selected|spell_save_dc} - 8 - @{selected|pb}), 0}kh1 ]]';

  return (
    '&{template:spell} ' +
    '{{level=Bonus Action}} ' +
    '{{name=🩸 Transfusion}} ' +
    '{{school=Necromancy}} ' +
    '{{castingtime=Bonus Action}} ' +
    '{{range=60 ft}} ' +
    '{{target=One creature within range (Con save)}} ' +
    '{{components=—}} ' +
    '{{description=You siphon vitality from the target, healing yourself for the damage dealt. ' +
      'If the target is at or below half its hit points, Transfusion deals an extra 1d8 necrotic. ' +
      'Excess healing becomes Pact Temp HP (cap ' + cap + '). While you have Pact Temp HP, gain +1 AC ' +
      'and your necrotic damage ignores resistance (treat immunity as resistance).}}'
  );
}

  function buildSanguinePoolAction() {
    return buildRollTemplate('Sanguine Pool (Reaction • 1/room)', [
      { label: 'Effect', value: 'Until the start of your next turn you are blood mist: resistance to all damage; move through creatures; cannot cast leveled spells or make attacks; enemies cannot make OAs against you.' },
      { label: 'Sovereign Pool', value: 'With ≥10 temp HP, gain +15 ft move when you enter; at the start of your turn roll HR Boon: Sovereign Pool (1d6). On 5–6, refresh Sanguine Pool.' }
    ]);
  }

  function buildHemoplagueAction() {
    return buildRollTemplate('Hemoplague (1/room; 20-ft; 60 ft; Con save)', [
      { label: 'Plagued', value: 'Target is <b>Plagued</b> until end of its next turn (takes <b>+@{selected|hr_pb}</b> damage from all sources).' },
      { label: 'Then', value: 'Take [[ 6d6 ]] necrotic (success [[ 3d6 ]] necrotic).' },
      { label: 'Heal yourself', value: 'Equal to necrotic dealt; excess becomes Pact temp HP.' }
    ]);
  }

  /**
   * Generic healing handler shared by Vladren's abilities.
   * Supports real healing, overflow-to-temp, and cap logic.
   * @param {string} characterId
   * @param {number|string} healAmount
   * @param {{allowOverflow?:boolean,cap?:number|string,source?:string}=} opts
   * @returns {?{source:string,rolled:number,healed:number,overflow:number,overflowApplied:number,overflowLost:number,trimmed:number,hpBefore:number,hpAfter:number,hpMax:number,tempBefore:number,tempAfter:number,tempCap:?number}}
   */
  function applyHealing(characterId, healAmount, opts) {
    if (!characterId) {
      return null;
    }

    var options = opts || {};

    var hpAttr = findObjs({ _type: 'attribute', _characterid: characterId, name: 'hp' })[0];
    var maxAttr = findObjs({ _type: 'attribute', _characterid: characterId, name: 'hp_max' })[0];
    var tempAttr = findObjs({ _type: 'attribute', _characterid: characterId, name: 'hp_temp' })[0];

    if (!hpAttr || !maxAttr) {
      var sourceLabel = options.source || 'Healing';
      warn(sourceLabel + ' aborted — missing hp or hp_max for ' + characterId + '.');
      return null;
    }

    var hpCurrent = parseInt(hpAttr.get('current'), 10);
    if (isNaN(hpCurrent) || hpCurrent < 0) {
      hpCurrent = 0;
    }

    var hpMax = parseInt(maxAttr.get('current'), 10);
    if (isNaN(hpMax) || hpMax < 0) {
      hpMax = 0;
    }

    var tempCurrent = tempAttr ? parseInt(tempAttr.get('current'), 10) : 0;
    if (isNaN(tempCurrent) || tempCurrent < 0) {
      tempCurrent = 0;
    }

    var healValue = parseFloat(healAmount);
    if (isNaN(healValue)) {
      healValue = 0;
    }
    healValue = Math.floor(healValue);
    if (healValue < 0) {
      healValue = 0;
    }

    var missing = hpMax - hpCurrent;
    if (missing < 0) {
      missing = 0;
    }

    var healed = healValue;
    if (healed > missing) {
      healed = missing;
    }

    var hpNext = hpCurrent + healed;
    if (hpNext > hpMax) {
      hpNext = hpMax;
    }
    if (hpNext < 0) {
      hpNext = 0;
    }

    var overflow = healValue - healed;
    if (overflow < 0) {
      overflow = 0;
    }

    var allowOverflow = !!options.allowOverflow;
    var capRaw = options.cap;
    var capValue = null;

    if (typeof capRaw !== 'undefined' && capRaw !== null) {
      var parsedCap = parseInt(capRaw, 10);
      if (!isNaN(parsedCap)) {
        capValue = parsedCap;
        if (capValue < 0) {
          capValue = 0;
        }
      }
    }

    var desiredTemp = tempCurrent;
    if (allowOverflow && overflow > 0) {
      desiredTemp = tempCurrent + overflow;
    }

    var tempNext = desiredTemp;
    if (capValue !== null && tempNext > capValue) {
      tempNext = capValue;
    }
    if (tempNext < 0) {
      tempNext = 0;
    }

    var overflowApplied = 0;
    if (tempNext > tempCurrent) {
      overflowApplied = tempNext - tempCurrent;
    }

    var overflowLost = overflow - overflowApplied;
    if (overflowLost < 0) {
      overflowLost = 0;
    }

    var trimmed = 0;
    if (tempNext < tempCurrent) {
      trimmed = tempCurrent - tempNext;
    }

    try {
      if (typeof hpAttr.setWithWorker === 'function') {
        hpAttr.setWithWorker({ current: hpNext });
      } else {
        hpAttr.set('current', hpNext);
      }
    } catch (err) {
      warn('Failed to update hp for ' + characterId + ': ' + err.message);
    }

    if (tempAttr) {
      try {
        if (typeof tempAttr.setWithWorker === 'function') {
          tempAttr.setWithWorker({ current: tempNext });
        } else {
          tempAttr.set('current', tempNext);
        }
      } catch (err2) {
        warn('Failed to update hp_temp for ' + characterId + ': ' + err2.message);
      }
    } else if (typeof createObj === 'function') {
      try {
        tempAttr = createObj('attribute', {
          _characterid: characterId,
          name: 'hp_temp',
          current: tempNext
        });
      } catch (err3) {
        warn('Failed to create hp_temp for ' + characterId + ': ' + err3.message);
      }
    }

    return {
      source: options.source || 'Unknown',
      rolled: healValue,
      healed: healed,
      overflow: overflow,
      overflowApplied: overflowApplied,
      overflowLost: overflowLost,
      trimmed: trimmed,
      hpBefore: hpCurrent,
      hpAfter: hpNext,
      hpMax: hpMax,
      tempBefore: tempCurrent,
      tempAfter: tempNext,
      tempCap: capValue
    };
  }

  /**
   * Applies Vladren's Transfusion healing to a character sheet.
   * Converts overflow into Pact temp HP (capped at 5×PB + spell mod).
   * @param {string} characterId
   * @param {number|string} healAmount
   * @param {number|string} pb
   * @param {number|string} spellMod
   * @returns {?{rolled:number,healed:number,overflow:number,overflowApplied:number,overflowLost:number,trimmed:number,hpBefore:number,hpAfter:number,maxHp:number,tempBefore:number,tempAfter:number,tempCap:number}}
   */
  function applyTransfusionHealing(characterId, healAmount, pb, spellMod) {
    if (!characterId) {
      return null;
    }

    var healValue = parseFloat(healAmount);
    if (isNaN(healValue)) {
      healValue = 0;
    }
    healValue = Math.floor(healValue);
    if (healValue < 0) {
      healValue = 0;
    }

    var pbValue = getAttrInt(characterId, ['hr_pb', 'pb'], pb);
    if (pbValue < 0) {
      pbValue = 0;
    }

    var spellValue = getAttrInt(characterId, ['hr_spellmod', 'spell_mod'], spellMod);
    if (isNaN(spellValue)) {
      spellValue = 0;
    }

    var tempCap = (5 * pbValue) + spellValue;
    if (isNaN(tempCap) || tempCap < 0) {
      tempCap = 0;
    }

    var result = applyHealing(characterId, healValue, {
      allowOverflow: true,
      cap: tempCap,
      source: 'Transfusion'
    });

    if (!result) {
      return null;
    }

    return {
      rolled: healValue,
      healed: result.healed,
      overflow: result.overflow,
      overflowApplied: result.overflowApplied,
      overflowLost: result.overflowLost,
      trimmed: result.trimmed,
      hpBefore: result.hpBefore,
      hpAfter: result.hpAfter,
      maxHp: result.hpMax,
      tempBefore: result.tempBefore,
      tempAfter: result.tempAfter,
      tempCap: tempCap
    };
  }

  function ensureHandoutForPlayer(playerId, playerName) {
    if (!playerName) {
      playerName = 'Unknown Player';
    }
    var title = HANDOUT_TITLE_PREFIX + playerName + ')';
    var handout = findObjs({ _type: 'handout', name: title })[0];
    var permissions = playerId || '';

    if (!handout) {
      handout = createObj('handout', {
        name: title,
        archived: false,
        inplayerjournals: permissions,
        controlledby: permissions
      });
    } else {
      handout.set({
        archived: false,
        inplayerjournals: permissions,
        controlledby: permissions
      });
    }

    handout.set('notes', TEXT_WRAPPER_START + KIT_RULES_HTML + TEXT_WRAPPER_END);
    return handout;
  }

  function gatherPlayerIds(targetChar, opts) {
    var ids = {};
    var controlled = (targetChar.get('controlledby') || '').split(',');

    controlled.forEach(function(entry){
      var id = (entry || '').trim();
      if (!id || id === 'all') {
        return;
      }
      ids[id] = true;
    });

    if (opts && opts.by && !ids[opts.by]) {
      ids[opts.by] = true;
    }

    return Object.keys(ids);
  }

  function onInstall(targetChar, opts) {
    var ids = gatherPlayerIds(targetChar, opts || {});
    var charId = targetChar && (targetChar.id || targetChar.get('_id'));

    if (!ids.length) {
      return;
    }

    ids.forEach(function(playerId){
      var player = getObj('player', playerId);
      var name = player ? player.get('_displayname') : 'Unknown Player';
      ensureHandoutForPlayer(playerId, name);
    });

    if (!charId) {
      return;
    }

    var rowId = ensurePactInventoryRow(charId);

    // Persist key stats so actions can roll without prompts. Re-run !hr-sync / !bindkit if PB or spell mods change.
    var pbAttr = findObjs({ _type: 'attribute', _characterid: charId, name: 'pb' })[0];
    var spellModAttr = findObjs({ _type: 'attribute', _characterid: charId, name: 'spell_mod' })[0];
    var pbValue = parseInt(pbAttr ? pbAttr.get('current') : 0, 10);
    var spellModValue = parseInt(spellModAttr ? spellModAttr.get('current') : 0, 10);

    if (isNaN(pbValue)) {
      pbValue = 0;
    }
    if (isNaN(spellModValue)) {
      spellModValue = 0;
    }

    function upsertAttr(name, value) {
      var existing = findObjs({ _type: 'attribute', _characterid: charId, name: name })[0];
      if (existing) {
        existing.set('current', value);
      } else {
        createObj('attribute', {
          _characterid: charId,
          name: name,
          current: value
        });
      }
    }

    upsertAttr('hr_pb', pbValue);
    upsertAttr('hr_spellmod', spellModValue);
    upsertAttr('hr_false_life_pb_bonus', 0);

    if (rowId) {
      syncPactState(charId);
    }

    // Install Vladren's Always Prepared spell list via repeating spell entries when available.
    if (typeof SpellbookHelper !== 'undefined') {
      SpellbookHelper.installAlwaysPrepared(charId, [
        {
          name: 'False Life',
          level: 1,
          school: 'Necromancy',
          castingTime: '1 action',
          range: 'Self',
          components: 'V,S,M (a small amount of alcohol or distilled spirits)',
          duration: '1 hour',
          effect: 'Bolster yourself with necromantic vigor to gain [[ 1d4 + 4 + @{selected|hr_false_life_pb_bonus} ]] temporary hit points for the duration.',
          notes: 'At Higher Levels: Gain 5 additional temporary hit points for each slot level above 1st. Spell Lists: Artificer, Sorcerer, Wizard.'
        },
        {
          name: 'Ray of Sickness',
          level: 1,
          school: 'Necromancy',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V,S',
          duration: 'Instantaneous',
          hit: 'Make a ranged spell attack against a creature.',
          damage: { roll: '2d8', type: 'poison' },
          save: 'Constitution (on a failed save, the target is poisoned until the end of your next turn)',
          effect: 'On a hit, the target takes poison damage and must make a Constitution saving throw or be poisoned until the end of your next turn.',
          notes: 'Spell Lists: Sorcerer, Wizard.'
        },
        {
          name: 'Ray of Enfeeblement',
          level: 2,
          school: 'Necromancy',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V,S',
          duration: 'Concentration, up to 1 minute',
          hit: 'Make a ranged spell attack against a creature.',
          effect: 'On a hit, the target deals only half damage with weapon attacks that use Strength until the spell ends.',
          save: 'Constitution (at the end of each of its turns, ending the spell on a success)',
          notes: 'Spell Lists: Warlock, Wizard.'
        },
        {
          name: 'Mirror Image',
          level: 2,
          school: 'Illusion',
          castingTime: '1 action',
          range: 'Self',
          components: 'V,S',
          duration: '1 minute',
          effect: 'Three illusory duplicates appear in your space and mimic your movements. Use a d20 to divert attacks to the duplicates (6+/8+/11+ as images remain).',
          notes: 'Each duplicate has AC 10 + your Dexterity modifier and is destroyed on a hit. Creatures that cannot see or perceive illusions as false are unaffected. Spell Lists: Bard (Optional), Sorcerer, Warlock, Wizard.'
        },
        {
          name: 'Vampiric Touch',
          level: 3,
          school: 'Necromancy',
          castingTime: '1 action',
          range: 'Self',
          components: 'V,S',
          duration: 'Concentration, up to 1 minute',
          hit: 'Make a melee spell attack against a creature within your reach.',
          damage: { roll: '3d6', type: 'necrotic' },
          effect: 'On a hit, you regain hit points equal to half the necrotic damage dealt. Until the spell ends, you can make the attack again on each of your turns as an action.',
          notes: 'At Higher Levels: Damage increases by 1d6 for each slot level above 3rd. Spell Lists: Sorcerer (Optional), Warlock, Wizard.'
        },
        {
          name: 'Blight',
          level: 4,
          school: 'Necromancy',
          castingTime: '1 action',
          range: '30 feet',
          components: 'V,S',
          duration: 'Instantaneous',
          save: 'Constitution (half damage on a success)',
          damage: { roll: '8d8', type: 'necrotic' },
          effect: 'Necromantic energy washes over a creature, draining moisture and vitality. The spell has no effect on undead or constructs.',
          notes: 'Plant creatures make the saving throw with disadvantage and take maximum damage. Nonmagical plants wither instantly. At Higher Levels: Damage increases by 1d8 for each slot level above 4th. Spell Lists: Druid, Sorcerer, Warlock, Wizard.'
        },
        {
          name: 'Enervation',
          level: 5,
          school: 'Necromancy',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V,S',
          duration: 'Concentration, up to 1 minute',
          save: 'Dexterity (on a success, the target takes 2d8 necrotic damage and the spell ends)',
          damage: { roll: '4d8', type: 'necrotic', notes: 'Initial damage on a failed save.' },
          damage2: { label: 'Sustain', roll: '4d8', type: 'necrotic', notes: 'Use your action on later turns to deal this damage automatically while the target remains in range and visible.' },
          effect: 'Whenever the spell deals damage, you regain hit points equal to half the necrotic damage dealt. The spell ends if you use your action for anything else, the target moves out of range, or it gains total cover.',
          notes: 'At Higher Levels: Damage increases by 1d8 for each slot level above 5th. Spell Lists: Sorcerer, Warlock, Wizard.'
        },
        {
          name: 'Negative Energy Flood',
          level: 5,
          school: 'Necromancy',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V,M (a broken bone and a square of black silk)',
          duration: 'Instantaneous',
          save: 'Constitution (half damage on a success; undead instead gain temporary hit points equal to half the damage rolled)',
          damage: { roll: '5d12', type: 'necrotic' },
          effect: 'Ribbons of negative energy assault the target. A creature killed by this damage rises as a zombie at the start of your next turn and pursues the nearest creature it can see.',
          notes: 'Spell Lists: Warlock, Wizard.'
        }
      ]);
    }
  }

  function onUninstall(targetChar) {
    if (!targetChar) {
      return;
    }

    var charId = targetChar.id || (typeof targetChar.get === 'function' && targetChar.get('_id'));
    if (!charId) {
      return;
    }

    var rowId = getAttrCurrent(charId, PACT_ROW_ATTR);
    if (rowId) {
      setPactEquipped(charId, String(rowId).trim(), false);
    }

    removePactInventoryRow(charId);
    removeAttribute(charId, PACT_FLAG_ATTR);
    removeAttribute(charId, PACT_ROW_ATTR);
  }

  if (typeof on === 'function') {
    on('change:attribute', handleTempHpChange);
    on('ready', seedPactRows);
  }

  var _registered = false;

  function registerKit() {
    if (_registered) {
      return true;
    }

    if (typeof AncestorKits === 'undefined' || !AncestorKits || typeof AncestorKits.register !== 'function') {
      return false;
    }

    AncestorKits.register(KIT_KEY, {
      ancestor: KIT_NAME,
      prefix: KIT_KEY,
      sourceCharName: SOURCE_CHARACTER_NAME,
      sourceCharacterName: SOURCE_CHARACTER_NAME,
      abilities: [
        { name: 'Crimson Pact (Info)', action: buildCrimsonPactAction(), tokenAction: true },
        { name: 'Transfusion (Bonus)', action: buildTransfusionAction(), tokenAction: true },
        { name: 'Transfusion - Description', action: buildTransfusionDescriptionAction(), tokenAction: false },
        { name: 'Sanguine Pool (Reaction • 1/room)', action: buildSanguinePoolAction(), tokenAction: true },
        { name: 'Hemoplague (1/room)', action: buildHemoplagueAction(), tokenAction: true }
      ],
      onInstall: onInstall,
      onUninstall: onUninstall
    });

    _registered = true;
    return true;
  }

  if (!registerKit() && typeof on === 'function') {
    on('ready', function(){
      if (!registerKit()) {
        warn('Vladren kit failed to register – AncestorKits.register unavailable.');
      }
    });
  }

})();
