// ------------------------------------------------------------
// Effect Engine
// ------------------------------------------------------------
// What this does (in simple terms):
//   Applies EffectRegistry definitions to Roll20 characters.
//   Handles attribute tweaks, ability mirroring, and GM note
//   annotations when boons or relics are gained in a run.
// ------------------------------------------------------------

var EffectEngine = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('EffectEngine', message);
    } else {
      log('[Hoard Run] [EffectEngine] ⚠️ ' + message);
    }
  }

  function escapeHTML(text) {
    if (!text) {
      return '';
    }
    if (typeof _ !== 'undefined' && _.escape) {
      return _.escape(String(text));
    }
    return String(text).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function ensureAttribute(characterId, name) {
    if (!characterId || !name) {
      return null;
    }

    var attr = findObjs({
      _type: 'attribute',
      _characterid: characterId,
      name: name
    })[0];

    if (!attr) {
      attr = createObj('attribute', {
        _characterid: characterId,
        name: name,
        current: ''
      });
    }

    return attr || null;
  }

  function applyAttrPatch(characterId, patch) {
    var attr = ensureAttribute(characterId, patch.name);
    if (!attr) {
      return;
    }

    var op = (patch.op || 'set').toLowerCase();
    var value = patch.value;

    if (op === 'add' || op === 'increment') {
      var current = parseFloat(attr.get('current') || 0);
      var delta = parseFloat(value || 0);
      if (!isNaN(current) && !isNaN(delta)) {
        attr.set('current', current + delta);
      } else {
        attr.set('current', value);
      }
      return;
    }

    attr.set('current', value);
  }

  function upsertAbility(characterId, name, action, isTokenAction) {
    if (!characterId || !name) {
      return null;
    }

    var ability = findObjs({
      _type: 'ability',
      _characterid: characterId,
      name: name
    })[0];

    if (!ability) {
      ability = createObj('ability', {
        _characterid: characterId,
        name: name,
        action: action || '',
        istokenaction: !!isTokenAction
      });
    } else {
      ability.set({
        action: action || '',
        istokenaction: !!isTokenAction
      });
    }

    return ability || null;
  }

  function appendGMNote(character, effectName, text) {
    if (!character || !text) {
      return;
    }

    var existing = character.get('gmnotes') || '';
    var decoded;

    try {
      decoded = decodeURIComponent(existing);
    } catch (err) {
      decoded = existing;
    }

    var noteBlock = '<div><b>' + escapeHTML(effectName) + ':</b> ' + escapeHTML(text) + '</div>';
    var updated = decoded;

    if (updated.indexOf(noteBlock) === -1) {
      updated += noteBlock;
    }

    character.set('gmnotes', encodeURIComponent(updated));
  }

  function applyAbilityPatch(characterId, patch) {
    var name = patch.name || patch.label;
    var action = patch.action || '';
    var tokenAction = patch.token || false;
    upsertAbility(characterId, name, action, tokenAction);
  }

  function applyNotePatch(character, effect, patch) {
    appendGMNote(character, effect.name || effect.id || 'Effect', patch.text || '');
  }

  function apply(characterId, effect) {
    if (!characterId || !effect) {
      return;
    }

    var character = getObj('character', characterId);
    if (!character) {
      warn('Character ' + characterId + ' not found for effect ' + (effect.id || effect.name || '?') + '.');
      return;
    }

    var patches = effect.patches || [];
    for (var i = 0; i < patches.length; i++) {
      var patch = patches[i];
      if (!patch || !patch.type) {
        continue;
      }

      if (patch.type === 'attr') {
        applyAttrPatch(characterId, patch);
      }
      if (patch.type === 'ability') {
        applyAbilityPatch(characterId, patch);
      }
      if (patch.type === 'note') {
        applyNotePatch(character, effect, patch);
      }
    }

    info('Applied effect "' + (effect.name || effect.id) + '" to character ' + character.get('name') + '.');
  }

  function register() {
    info('EffectEngine ready.');
  }

  return {
    apply: apply,
    register: register
  };
})();
