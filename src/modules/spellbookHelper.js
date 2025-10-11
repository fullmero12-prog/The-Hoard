// ------------------------------------------------------------
// Spellbook Helper
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Adds "Always Prepared" spells to a bound character when an Ancestor is chosen.
//   • Creates token-action macros for those spells (reliable casting buttons).
//   • If the sheet looks like D&D5e by Roll20, it tries to also create/update
//     the underlying repeating spell entries (nice-to-have).
//   • Exposes patch helpers so boons can modify a specific spell later.
// ------------------------------------------------------------

var SpellbookHelper = (function () {
  'use strict';

  // --- Utilities ---
  function getChar(charId)             { return getObj('character', charId); }
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
  function upsertAbility(charId, name, action, token) {
    var a = findObjs({ _type:'ability', _characterid: charId, name: name })[0];
    if (!a) a = createObj('ability', { _characterid: charId, name: name, action: action, istokenaction: !!token });
    else a.set({ action: action, istokenaction: !!token });
    return a;
  }
  function hasOGL5eSignals(charId) {
    // lightweight sniff: OGL/5e by Roll20 tends to have these attrs around
    return !!(getAttrObj(charId, 'level') || getAttrObj(charId, 'class') || getAttrObj(charId, 'spellcasting_ability'));
  }

  function ensureInlineRoll(expr) {
    if (!expr) return '';
    if (expr.indexOf('[[') !== -1) return expr;
    return '[[ ' + expr + ' ]]';
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

  function renderDamageRow(rows, entry, defaultLabel) {
    var info = normalizeDamage(entry, defaultLabel);
    if (!info) return;

    var pieces = [];
    if (info.roll) {
      pieces.push(ensureInlineRoll(info.roll));
    }
    if (info.type) {
      pieces.push(info.type);
    }
    if (info.notes) {
      pieces.push(info.notes);
    }

    if (pieces.length) {
      rows.push('{{' + info.label + '=' + pieces.join(' — ') + '}}');
    }
  }

  // --- Build a safe cast macro (works regardless of sheet) ---
  function buildCastCard(spell) {
    var rows = [];
    if (spell.school) rows.push('{{School=' + spell.school + '}}');
    if (spell.level !== undefined) rows.push('{{Level=' + (spell.level===0 ? 'Cantrip' : spell.level) + '}}');
    if (spell.range) rows.push('{{Range=' + spell.range + '}}');
    if (spell.components) rows.push('{{Components=' + spell.components + '}}');
    if (spell.duration) rows.push('{{Duration=' + spell.duration + '}}');
    renderDamageRow(rows, spell.damage, 'Damage');
    renderDamageRow(rows, spell.damage2, 'Secondary Damage');
    if (spell.hit) rows.push('{{On Hit=' + spell.hit + '}}');
    if (spell.save) rows.push('{{Save=' + spell.save + '}}');
    if (spell.effect) rows.push('{{Effect=' + spell.effect + '}}');
    if (spell.notes) rows.push('{{Notes=' + spell.notes + '}}');

    return '&{template:default} {{name=' + spell.name + '}} ' + rows.join(' ');
  }

  // --- Try to install as a repeating spell on OGL/5e (best-effort) ---
  function tryInstallOnOGL5e(charId, spell) {
    try {
      if (!hasOGL5eSignals(charId)) return false;

      var lvl    = spell.level || 0;
      var section = (lvl === 0) ? 'spell-cantrip' : ('spell' + lvl);
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

      var fields = {
        spellname: spell.name,
        spelllevel: lvl,
        spellschool: spell.school || '',
        spellrange: spell.range || '',
        spellduration: spell.duration || '',
        spellcomponents: spell.components || '',
        spellattack: spell.attack || '',
        spelldamage: damageInfo ? stripInlineRoll(damageInfo.roll) : (spell.hit || ''),
        spelldamage2: damageInfo2 ? stripInlineRoll(damageInfo2.roll) : '',
        spelldamagetype: dmgType,
        spellritual: '0',
        spellprepared: 'on',
        spellalwaysprepared: 'on',
        spelldescription: (spell.effect || spell.notes || '')
      };

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

      // 1) Always create a token-action cast macro so it Just Works™
      upsertAbility(charId, '[AP] ' + s.name, buildCastCard(s), true);

      // 2) Best-effort: add to OGL5e repeating spell list as prepared
      tryInstallOnOGL5e(charId, s);
    }
  }

  // --- Public: apply a modifier to a specific AP spell (by name) ---
  // modify: { fields: {spelldamage: '2d8+PB', spelldescription: '...' }, macroNotes: 'adds +PB temp HP' }
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

    // Always update the token-action macro, so the casting button reflects changes
    var a = findObjs({ _type:'ability', _characterid: charId, name: '[AP] ' + spellName })[0];
    if (a) {
      var note = modify.macroNotes ? (' {{Boon=' + modify.macroNotes + '}}') : '';
      var current = a.get('action') || '';
      // naive approach: append a Boon line (idempotent-ish in testing contexts)
      a.set('action', current + note);
      patched = true;
    }

    return patched;
  }

  /**
   * Removes Hoard Run Always Prepared helpers from a specific character.
   * This clears the token action abilities and any hr_apspell_* markers
   * so future runs can rebuild a clean set of spells.
   * @param {string} charId
   * @returns {{abilitiesRemoved:number, attributesRemoved:number}}
   */
  function removeAlwaysPreparedForCharacter(charId) {
    var result = { abilitiesRemoved: 0, attributesRemoved: 0 };
    if (!charId || typeof findObjs !== 'function') {
      return result;
    }

    var abilities = findObjs({ _type: 'ability', _characterid: charId }) || [];
    for (var i = 0; i < abilities.length; i += 1) {
      var ability = abilities[i];
      try {
        var name = ability && typeof ability.get === 'function' ? ability.get('name') : '';
        if (name && name.indexOf('[AP] ') === 0) {
          ability.remove();
          result.abilitiesRemoved += 1;
        }
      } catch (err) {
        // Swallow errors so a stubborn ability does not block cleanup.
      }
    }

    var attrs = findObjs({ _type: 'attribute', _characterid: charId }) || [];
    for (var j = 0; j < attrs.length; j += 1) {
      var attr = attrs[j];
      try {
        var attrName = attr && typeof attr.get === 'function' ? attr.get('name') : '';
        if (attrName && attrName.indexOf('hr_apspell_') === 0) {
          attr.remove();
          result.attributesRemoved += 1;
        }
      } catch (attrErr) {
        // Ignore sandbox hiccups when removing helper attributes.
      }
    }

    return result;
  }

  /**
   * Clears Always Prepared helpers for every bound character in a run state.
   * Ensures each character is only processed once even if shared between players.
   * @param {{players:Object<string, {boundCharacterId:string}>}} runState
   * @returns {{abilitiesRemoved:number, attributesRemoved:number}}
   */
  function clearAlwaysPreparedFromRunState(runState) {
    var totals = { abilitiesRemoved: 0, attributesRemoved: 0 };
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
      }
    }

    // Safety net: if a character still has AP token actions but no player entry,
    // sweep the campaign for orphaned abilities. This covers cases where
    // `state.HoardRun` was partially wiped or legacy data used different shapes.
    if (typeof findObjs === 'function') {
      var abilities = findObjs({ _type: 'ability' }) || [];
      for (var i = 0; i < abilities.length; i += 1) {
        var ability = abilities[i];
        var abilityName = '';
        var abilityCharId = null;

        try {
          abilityName = ability && typeof ability.get === 'function' ? ability.get('name') : '';
          abilityCharId = ability && typeof ability.get === 'function' ? ability.get('_characterid') : null;
        } catch (abilityErr) {
          abilityName = '';
          abilityCharId = null;
        }

        if (!abilityName || abilityName.indexOf('[AP] ') !== 0) {
          continue;
        }

        if (!abilityCharId || seen[abilityCharId]) {
          continue;
        }

        seen[abilityCharId] = true;
        var orphanRemoval = removeAlwaysPreparedForCharacter(abilityCharId);
        totals.abilitiesRemoved += orphanRemoval.abilitiesRemoved;
        totals.attributesRemoved += orphanRemoval.attributesRemoved;
      }
    }

    return totals;
  }

  return {
    installAlwaysPrepared: installAlwaysPrepared,
    patchAPSpell: patchAPSpell,
    removeAlwaysPreparedForCharacter: removeAlwaysPreparedForCharacter,
    clearAlwaysPreparedFromRunState: clearAlwaysPreparedFromRunState
  };
})();
