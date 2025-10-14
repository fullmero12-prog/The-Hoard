// ------------------------------------------------------------
// Spellbook Helper
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Focuses on the repeating spell sections for the D&D5e by Roll20 sheet.
//   • Adds "Always Prepared" spells to a bound character when an Ancestor is chosen.
//   • Exposes patch helpers so boons can modify a specific spell later.
// ------------------------------------------------------------

var SpellbookHelper = (function () {
  'use strict';

  // --- Utilities ---
  function getAttrObj(charId, name)    { return findObjs({ _type:'attribute', _characterid: charId, name: name })[0] || null; }
  function setAttr(charId, name, val)  {
    if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.setAttributes === 'function') {
      var res = AttributeManager.setAttributes(charId, [{ name: name, current: val }]);
      if (res && res[0] && res[0].attribute) {
        return res[0].attribute;
      }
    }

    var a = getAttrObj(charId, name);
    if (!a) a = createObj('attribute', { _characterid: charId, name: name, current: val });
    else if (typeof a.setWithWorker === 'function') a.setWithWorker({ current: val });
    else a.set('current', val);
    return a;
  }
  function newRowId() {
    if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.generateRowId === 'function') {
      return AttributeManager.generateRowId();
    }
    // Roll20 UPPERCASE A–Z, 0–9 random id works fine for repeating rows
    var s='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', r='';
    for (var i=0;i<19;i++){ r+=s[Math.floor(Math.random()*s.length)]; }
    return r;
  }
  function hasOGL5eSignals(charId) {
    // lightweight sniff: OGL/5e by Roll20 tends to have these attrs around
    return !!(getAttrObj(charId, 'level') || getAttrObj(charId, 'class') || getAttrObj(charId, 'spellcasting_ability'));
  }

  function stripInlineRoll(expr) {
    if (!expr) return '';
    return expr.replace(/\[\[(.*?)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
  }

  function normalizeDamage(entry, defaultLabel) {
    if (!entry) return null;

    var info = {
      label: defaultLabel || 'Damage',
      roll: '',
      type: '',
      notes: ''
    };

    if (typeof entry === 'string') {
      info.roll = entry;
      return info;
    }

    if (typeof entry === 'object') {
      if (entry.label) info.label = entry.label;
      if (entry.roll) info.roll = entry.roll;
      else if (entry.value) info.roll = entry.value;
      if (entry.type) info.type = entry.type;
      if (entry.notes) info.notes = entry.notes;
      return info;
    }

    return null;
  }

  // --- Try to install as a repeating spell on OGL/5e (best-effort) ---
  function tryInstallOnOGL5e(charId, spell) {
    try {
      if (!hasOGL5eSignals(charId)) return false;

      var lvl    = spell.level || 0;
      var section = (lvl === 0) ? 'spell-cantrip' : ('spell-' + lvl);
      var damageInfo = normalizeDamage(spell.damage, 'Damage');
      var damageInfo2 = normalizeDamage(spell.damage2, 'Secondary Damage');

      var dmgType = '';
      if (damageInfo && damageInfo.type) {
        dmgType = damageInfo.type;
      } else if (spell.dmgtype) {
        dmgType = spell.dmgtype;
      } else if (damageInfo2 && damageInfo2.type) {
        dmgType = damageInfo2.type;
      }

      var dmgType2 = '';
      if (damageInfo2 && damageInfo2.type) {
        dmgType2 = damageInfo2.type;
      }

      var components = spell.components || '';
      var materialText = '';
      var ritual = false;
      if (components) {
        var materialMatch = components.match(/\(([^)]+)\)/);
        if (materialMatch && materialMatch[1]) {
          materialText = materialMatch[1];
        }
        if (spell.ritual === true || /ritual/i.test(components)) {
          ritual = true;
        }
      } else if (spell.ritual === true) {
        ritual = true;
      }

      var normalizedComponents = components.toUpperCase().replace(/\([^)]*\)/g, '');
      var hasV = normalizedComponents.indexOf('V') !== -1;
      var hasS = normalizedComponents.indexOf('S') !== -1;
      var hasM = normalizedComponents.indexOf('M') !== -1;

      var concentration = false;
      if (typeof spell.concentration === 'boolean') {
        concentration = spell.concentration;
      } else if (spell.duration && /concentration/i.test(spell.duration)) {
        concentration = true;
      }

      var saveSuccess = '';
      if (spell.saveSuccess) {
        saveSuccess = spell.saveSuccess;
      }

      var healingInfo = normalizeDamage(spell.healing, 'Healing');

      var descriptionPieces = [];
      if (spell.effect) descriptionPieces.push(spell.effect);
      if (spell.notes && spell.notes !== spell.effect) descriptionPieces.push(spell.notes);
      var description = descriptionPieces.join('\n\n');

      var fields = {
        spellname: spell.name,
        spelllevel: String(lvl),
        spellschool: spell.school || '',
        spellcastingtime: spell.castingTime || spell.castTime || spell.time || '',
        spellrange: spell.range || '',
        spelltarget: spell.target || '',
        spellduration: spell.duration || '',
        spellritual: ritual ? 'on' : '0',
        spellconcentration: concentration ? 'on' : '0',
        spellcomp_v: hasV ? 'on' : '0',
        spellcomp_s: hasS ? 'on' : '0',
        spellcomp_m: hasM ? 'on' : '0',
        spellcomp_materials: materialText,
        spellattack: spell.attack || '',
        spelloutput: spell.output || 'SPELLCARD',
        spelldamage: damageInfo ? stripInlineRoll(damageInfo.roll) : (spell.hit || ''),
        spelldamage2: damageInfo2 ? stripInlineRoll(damageInfo2.roll) : '',
        spelldamagetype: dmgType,
        spelldamagetype2: dmgType2,
        spellhealing: healingInfo ? stripInlineRoll(healingInfo.roll) : (spell.healing || ''),
        spellsave: spell.save || '',
        spellsavesuccess: saveSuccess,
        spellprepared: lvl === 0 ? '' : 'on',
        spellalwaysprepared: lvl === 0 ? '' : 'on',
        spelldescription: description || (spell.notes || spell.effect || '')
      };

      if (spell.spellclass) fields.spellclass = spell.spellclass;
      if (spell.source) fields.spellsource = spell.source;

      var created = null;
      if (typeof AttributeManager !== 'undefined' && AttributeManager && typeof AttributeManager.createRepeatingRow === 'function') {
        created = AttributeManager.createRepeatingRow(charId, section, fields);
      }

      var row = created && created.rowId ? created.rowId : newRowId();
      var base = 'repeating_' + section + '_' + row + '_';

      if (!created || !created.attributes || !created.attributes.length) {
        for (var key in fields) {
          if (fields.hasOwnProperty(key)) {
            setAttr(charId, base + key, fields[key]);
          }
        }
      }

      // We store a back-link so we can find it later by spell name
      // (helps us patch it when a boon modifies it)
      var tagName = 'hr_apspell_' + spell.name.toLowerCase().replace(/[^a-z0-9]+/g,'_');
      setAttr(charId, tagName, base); // base prefix lets us update the row fields later

      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Public: install a list of Always Prepared spells ---
  // spells: [{ name, level, school, range, components, duration, hit/save/effect/notes... }]
  function installAlwaysPrepared(charId, spells) {
    if (!charId || !spells || !spells.length) return;
    for (var i=0;i<spells.length;i++){
      var s = spells[i];
      tryInstallOnOGL5e(charId, s);
    }
  }

  // --- Public: apply a modifier to a specific AP spell (by name) ---
  // modify: { fields: {spelldamage: '2d8+PB', spelldescription: '...' }, macroNotes: 'adds +PB temp HP' }
  // macroNotes is appended to the repeating spell description when possible.
  function patchAPSpell(charId, spellName, modify) {
    if (!charId || !spellName || !modify) return false;
    var tagName = 'hr_apspell_' + spellName.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    var base = getAttrObj(charId, tagName);
    var patched = false;

    // Try patching sheet first if we have a base prefix
    if (base) {
      var prefix = base.get('current') || '';
      if (prefix) {
        var fields = modify.fields || {};
        for (var k in fields) {
          if (fields.hasOwnProperty(k)) {
            setAttr(charId, prefix + k, fields[k]);
            patched = true;
          }
        }
      }
    }

    if (modify.macroNotes && base) {
      var prefixAttr = base.get('current') || '';
      if (prefixAttr) {
        var descriptionAttr = getAttrObj(charId, prefixAttr + 'spelldescription');
        var existing = '';
        if (descriptionAttr) {
          existing = descriptionAttr.get('current') || descriptionAttr.get('max') || '';
        }
        var noteText = existing;
        if (noteText) {
          if (noteText.indexOf(modify.macroNotes) === -1) {
            noteText = noteText + '\n\n' + modify.macroNotes;
          }
        } else {
          noteText = modify.macroNotes;
        }
        setAttr(charId, prefixAttr + 'spelldescription', noteText);
        patched = true;
      }
    }

    return patched;
  }

  /**
   * Deletes all Always Prepared spells installed by Hoard Run on a character.
   * This removes the helper hr_apspell_* attributes and the repeating spell rows they reference.
   * @param {string} charId
   * @returns {{spellsRemoved:number, tagAttributesRemoved:number, spellAttributesRemoved:number}}
   */
  function deleteAlwaysPreparedSpells(charId) {
    var outcome = { spellsRemoved: 0, tagAttributesRemoved: 0, spellAttributesRemoved: 0 };
    if (!charId || typeof findObjs !== 'function') {
      return outcome;
    }

    var attrs = findObjs({ _type: 'attribute', _characterid: charId }) || [];
    var tagAttrs = [];
    var prefixes = [];
    var seenPrefixes = {};

    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var attrName = '';
      try {
        attrName = attr && typeof attr.get === 'function' ? attr.get('name') : '';
      } catch (nameErr) {
        attrName = '';
      }

      if (attrName && attrName.indexOf('hr_apspell_') === 0) {
        tagAttrs.push(attr);
        var prefix = '';
        try {
          prefix = attr.get('current') || '';
        } catch (prefixErr) {
          prefix = '';
        }
        if (prefix && !seenPrefixes[prefix]) {
          prefixes.push(prefix);
          seenPrefixes[prefix] = true;
        }
      }
    }

    for (var t = 0; t < tagAttrs.length; t += 1) {
      var tag = tagAttrs[t];
      try {
        tag.remove();
        outcome.tagAttributesRemoved += 1;
      } catch (removeTagErr) {}
    }

    for (var p = 0; p < prefixes.length; p += 1) {
      var prefix = prefixes[p];
      var removedAny = false;
      var rowAttrs = findObjs({ _type: 'attribute', _characterid: charId }) || [];
      for (var r = 0; r < rowAttrs.length; r += 1) {
        var rowAttr = rowAttrs[r];
        var rowName = '';
        try {
          rowName = rowAttr && typeof rowAttr.get === 'function' ? rowAttr.get('name') : '';
        } catch (rowNameErr) {
          rowName = '';
        }
        if (rowName && rowName.indexOf(prefix) === 0) {
          try {
            rowAttr.remove();
            outcome.spellAttributesRemoved += 1;
            removedAny = true;
          } catch (removeRowErr) {}
        }
      }
      if (removedAny) {
        outcome.spellsRemoved += 1;
      }
    }

    return outcome;
  }

  /**
   * Removes Hoard Run Always Prepared helpers from a specific character.
   * This clears the hr_apspell_* markers so future runs rebuild clean spells.
   * The abilitiesRemoved property is retained for legacy callers and will stay 0.
   * @param {string} charId
   * @returns {{abilitiesRemoved:number, attributesRemoved:number, spellsRemoved:number, spellAttributesRemoved:number}}
   */
  function removeAlwaysPreparedForCharacter(charId) {
    var result = { abilitiesRemoved: 0, attributesRemoved: 0, spellsRemoved: 0, spellAttributesRemoved: 0 };
    if (!charId || typeof findObjs !== 'function') {
      return result;
    }

    var cleanup = deleteAlwaysPreparedSpells(charId);
    result.attributesRemoved += cleanup.tagAttributesRemoved;
    result.spellsRemoved += cleanup.spellsRemoved;
    result.spellAttributesRemoved += cleanup.spellAttributesRemoved;
    return result;
  }

  /**
   * Clears Always Prepared helpers for every bound character in a run state.
   * Ensures each character is only processed once even if shared between players.
   * @param {{players:Object<string, {boundCharacterId:string}>}} runState
   * @returns {{abilitiesRemoved:number, attributesRemoved:number, spellsRemoved:number, spellAttributesRemoved:number}}
   */
  function clearAlwaysPreparedFromRunState(runState) {
    var totals = { abilitiesRemoved: 0, attributesRemoved: 0, spellsRemoved: 0, spellAttributesRemoved: 0 };
    var seen = {};

    if (runState && runState.players) {
      for (var pid in runState.players) {
        if (!runState.players.hasOwnProperty(pid)) {
          continue;
        }

        var ps = runState.players[pid];
        var charId = null;

        if (ps && ps.boundCharacterId) {
          charId = ps.boundCharacterId;
        } else if (ps && ps.bound_character_id) {
          // Legacy saves used snake_case; support it so resets stay thorough.
          charId = ps.bound_character_id;
        }

        if (!charId || seen[charId]) {
          continue;
        }

        seen[charId] = true;
        var removed = removeAlwaysPreparedForCharacter(charId);
        totals.abilitiesRemoved += removed.abilitiesRemoved;
        totals.attributesRemoved += removed.attributesRemoved;
        if (removed.spellsRemoved) {
          totals.spellsRemoved += removed.spellsRemoved;
        }
        if (removed.spellAttributesRemoved) {
          totals.spellAttributesRemoved += removed.spellAttributesRemoved;
        }
      }
    }

    return totals;
  }

  return {
    installAlwaysPrepared: installAlwaysPrepared,
    patchAPSpell: patchAPSpell,
    deleteAlwaysPreparedSpells: deleteAlwaysPreparedSpells,
    removeAlwaysPreparedForCharacter: removeAlwaysPreparedForCharacter,
    clearAlwaysPreparedFromRunState: clearAlwaysPreparedFromRunState
  };
})();
