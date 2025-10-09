// ------------------------------------------------------------
// Spellbook Helper
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Adds "Always Prepared" spells to a bound character when an Ancestor is chosen.
//   • Creates token-action macros for those spells (reliable casting buttons).
//   • If the sheet looks like D&D5e by Roll20, it tries to also create/update
//     the underlying repeating spell entries (nice-to-have).
//   • Tags each Always Prepared spell with bound player/focus info.
//   • Exposes patch helpers so boons can modify a specific spell later.
// ------------------------------------------------------------

var SpellbookHelper = (function () {
  'use strict';

  // --- Utilities ---
  function getChar(charId)             { return getObj('character', charId); }
  function getAttrObj(charId, name)    { return findObjs({ _type:'attribute', _characterid: charId, name: name })[0] || null; }
  function setAttr(charId, name, val)  {
    var a = getAttrObj(charId, name);
    if (!a) a = createObj('attribute', { _characterid: charId, name: name, current: val });
    else a.set('current', val);
    return a;
  }
  function newRowId() {
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

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function unique(list) {
    var seen = {};
    var result = [];
    if (!list || !list.length) {
      return result;
    }
    for (var i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (!entry || seen[entry]) {
        continue;
      }
      seen[entry] = true;
      result.push(entry);
    }
    return result;
  }

  function playerDisplayName(playerId) {
    if (!playerId) {
      return 'Unknown Player';
    }
    if (typeof getObj === 'function') {
      var player = getObj('player', playerId);
      if (player && typeof player.get === 'function') {
        var display = player.get('_displayname') || player.get('displayname') || player.get('name');
        if (display) {
          return display;
        }
      }
    }
    return 'Player ' + playerId;
  }

  function resolveAncestorLabel(name) {
    if (!name) {
      return '';
    }
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.get === 'function') {
      var entry = AncestorRegistry.get(name);
      if (entry && entry.displayName) {
        return entry.displayName;
      }
    }
    return name;
  }

  function readPlayerState(playerId) {
    if (typeof state === 'undefined' || !state || !state.HoardRun || !state.HoardRun.players) {
      return null;
    }
    if (state.HoardRun.players.hasOwnProperty(playerId)) {
      return state.HoardRun.players[playerId];
    }
    return null;
  }

  function gatherBoundPlayerIds(charId, options) {
    var ids = [];
    var opts = options || {};
    var targetId = charId ? String(charId) : '';

    if (opts.boundPlayerIds && opts.boundPlayerIds.length) {
      for (var i = 0; i < opts.boundPlayerIds.length; i += 1) {
        var pid = String(opts.boundPlayerIds[i] || '');
        if (!pid || pid === 'all') {
          continue;
        }
        ids.push(pid);
      }
    } else if (typeof state !== 'undefined' && state && state.HoardRun && state.HoardRun.players) {
      for (var key in state.HoardRun.players) {
        if (!state.HoardRun.players.hasOwnProperty(key)) {
          continue;
        }
        var ps = state.HoardRun.players[key];
        if (!ps || !ps.boundCharacterId) {
          continue;
        }
        if (targetId && String(ps.boundCharacterId) !== targetId) {
          continue;
        }
        ids.push(key);
      }
    }

    return unique(ids);
  }

  function buildBoundLines(charId, options) {
    var lines = [];
    var opts = options || {};
    var ids = gatherBoundPlayerIds(charId, opts);

    for (var i = 0; i < ids.length; i += 1) {
      var playerId = ids[i];
      var name = playerDisplayName(playerId);
      var stateEntry = readPlayerState(playerId);
      var ancestorName = '';
      var focusName = '';

      if (stateEntry && stateEntry.ancestor_id) {
        ancestorName = stateEntry.ancestor_id;
      } else if (opts.ancestorName) {
        ancestorName = opts.ancestorName;
      }

      if (stateEntry && stateEntry.focus) {
        focusName = stateEntry.focus;
      } else if (opts.focusName) {
        focusName = opts.focusName;
      }

      var meta = [];
      if (ancestorName) {
        meta.push(resolveAncestorLabel(ancestorName));
      }
      if (focusName) {
        meta.push('Focus: ' + focusName);
      }

      var label = '<b>' + escapeHTML(name) + '</b>';
      if (meta.length) {
        var safeMeta = [];
        for (var m = 0; m < meta.length; m += 1) {
          safeMeta.push(escapeHTML(meta[m]));
        }
        label += ' (' + safeMeta.join('; ') + ')';
      }

      lines.push(label);
    }

    return lines;
  }

  // --- Build a safe cast macro (works regardless of sheet) ---
  function buildCastCard(spell, boundLines) {
    var rows = [];
    if (boundLines && boundLines.length) {
      rows.push('{{Bound To=' + boundLines.join('<br>') + '}}');
    }
    if (spell.school) rows.push('{{School=' + spell.school + '}}');
    if (spell.level !== undefined) rows.push('{{Level=' + (spell.level===0 ? 'Cantrip' : spell.level) + '}}');
    if (spell.range) rows.push('{{Range=' + spell.range + '}}');
    if (spell.components) rows.push('{{Components=' + spell.components + '}}');
    if (spell.duration) rows.push('{{Duration=' + spell.duration + '}}');
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
      var secKey = (lvl === 0) ? 'repeating_spell-cantrip' : ('repeating_spell' + lvl);
      var row    = newRowId();
      var base   = secKey + '_' + row + '_';

      // Minimum viable fields for the sheet to render it
      setAttr(charId, base + 'spellname', spell.name);
      setAttr(charId, base + 'spelllevel', lvl);
      setAttr(charId, base + 'spellschool', spell.school || '');
      setAttr(charId, base + 'spellrange', spell.range || '');
      setAttr(charId, base + 'spellduration', spell.duration || '');
      setAttr(charId, base + 'spellcomponents', spell.components || '');
      setAttr(charId, base + 'spellattack', spell.attack || '');
      setAttr(charId, base + 'spelldamage', spell.damage || spell.hit || '');
      setAttr(charId, base + 'spelldamage2', spell.damage2 || '');
      setAttr(charId, base + 'spelldamagetype', spell.dmgtype || '');
      setAttr(charId, base + 'spellritual', '0');

      // Prepared + always prepared
      setAttr(charId, base + 'spellprepared', 'on');
      setAttr(charId, base + 'spellalwaysprepared', 'on');

      // Description (sheet uses this for the card)
      setAttr(charId, base + 'spelldescription', (spell.effect || spell.notes || ''));

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
  // options: { boundPlayerIds: [], ancestorName: '', focusName: '' }
  function installAlwaysPrepared(charId, spells, options) {
    if (!charId || !spells || !spells.length) return;
    var boundLines = buildBoundLines(charId, options);
    for (var i=0;i<spells.length;i++){
      var s = spells[i];

      // 1) Always create a token-action cast macro so it Just Works™
      upsertAbility(charId, '[AP] ' + s.name, buildCastCard(s, boundLines), true);

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

  return {
    installAlwaysPrepared: installAlwaysPrepared,
    patchAPSpell: patchAPSpell
  };
})();
