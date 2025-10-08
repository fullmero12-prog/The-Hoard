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
    var charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var output = '-';
    for (var i = 0; i < 19; i++) {
      var idx = Math.floor(Math.random() * charset.length);
      output += charset.charAt(idx);
    }
    return output;
  }

  function setAttr(charId, name, value) {
    var attr = findObjs({
      _type: 'attribute',
      _characterid: charId,
      name: name
    })[0];

    if (!attr) {
      attr = createObj('attribute', {
        _characterid: charId,
        name: name,
        current: value
      });
    } else {
      attr.set('current', value);
    }

    return attr;
  }

  function getAttr(charId, name) {
    var attr = findObjs({
      _type: 'attribute',
      _characterid: charId,
      name: name
    })[0];

    if (!attr) {
      return '';
    }

    var current = attr.get('current');
    return typeof current === 'undefined' || current === null ? '' : current;
  }

  function addNumber(charId, name, delta) {
    var attr = findObjs({
      _type: 'attribute',
      _characterid: charId,
      name: name
    })[0];

    if (!attr) {
      attr = createObj('attribute', {
        _characterid: charId,
        name: name,
        current: 0
      });
    }

    var current = parseFloat(attr.get('current'));
    if (isNaN(current)) {
      current = 0;
    }

    var change = parseFloat(delta);
    if (isNaN(change)) {
      change = 0;
    }

    attr.set('current', current + change);
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
      _characterid: charId
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
  }

  function ensureGlobalRow(charId, section, fields, rememberKey) {
    try {
      var rowId = randRowId();
      for (var field in fields) {
        if (fields.hasOwnProperty(field)) {
          var attrName = 'repeating_' + section + '_' + rowId + '_' + field;
          setAttr(charId, attrName, fields[field]);
        }
      }
      if (rememberKey) {
        rememberRowId(charId, rememberKey, rowId);
      }
      return { ok: true, rowId: rowId };
    } catch (err) {
      sendChat('Adapter', '/w gm Failed to create repeating_' + section + ' row: ' + err.message);
      return { ok: false };
    }
  }

  function applyPatch(charId, patch) {
    if (!patch || patch.type !== 'adapter' || !patch.op) {
      return false;
    }

    if (patch.op === 'add_ac_misc') {
      addNumber(charId, 'hr_adapter_ac_misc_total', patch.value || 0);
      return true;
    }

    if (patch.op === 'add_speed_bonus') {
      addNumber(charId, 'hr_speed_bonus_total', patch.value || 0);
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
        _characterid: charId,
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
        _characterid: charId,
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
        _characterid: charId,
        name: 'hr_on_kill_hooks'
      })[0];

      if (!list) {
        list = createObj('attribute', {
          _characterid: charId,
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

    return false;
  }

  function removePatch(charId, patch) {
    if (!patch || patch.type !== 'adapter' || !patch.op) {
      return false;
    }

    if (patch.op === 'add_ac_misc') {
      var acAttr = findObjs({
        _type: 'attribute',
        _characterid: charId,
        name: 'hr_adapter_ac_misc_total'
      })[0];
      if (acAttr) {
        acAttr.set('current', 0);
      }
      return true;
    }

    if (patch.op === 'add_speed_bonus') {
      var speedAttr = findObjs({
        _type: 'attribute',
        _characterid: charId,
        name: 'hr_speed_bonus_total'
      })[0];
      if (speedAttr) {
        speedAttr.set('current', 0);
      }
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
        _characterid: charId,
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
        _characterid: charId,
        name: 'hr_spell_dc_bonus_total'
      })[0];
      if (saveTotal) {
        saveTotal.set('current', 0);
      }
      return true;
    }

    if (patch.op === 'add_resource_counter') {
      var baseName = 'hr_res_' + String(patch.name || 'resource').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      var suffixes = ['_max', '_cur', '_cadence'];
      for (var k = 0; k < suffixes.length; k++) {
        var attr = findObjs({
          _type: 'attribute',
          _characterid: charId,
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
        _characterid: charId,
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

  EffectAdapters.registerAdapter({
    name: 'dnd5e-roll20',
    detect: function (character) {
      var charId = character ? character.id : null;
      if (!charId) {
        return false;
      }
      var pb = findObjs({
        _type: 'attribute',
        _characterid: charId,
        name: 'pb'
      })[0];
      var sca = findObjs({
        _type: 'attribute',
        _characterid: charId,
        name: 'spellcasting_ability'
      })[0];
      return !!(pb || sca);
    },
    apply: function (charId, patch) {
      return applyPatch(charId, patch);
    },
    remove: function (charId, patch) {
      return removePatch(charId, patch);
    }
  });
})();
