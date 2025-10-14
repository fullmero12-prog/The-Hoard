// ------------------------------------------------------------
// Ancestor Kit Registration: Vladren Moroi
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Registers the Vladren kit with the shared AncestorKits core.
//   • Supplies roll template actions for Vladren's four abilities.
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
    '<b>Sanguine Pool (Reaction, 1/room).</b> When you take damage, become <b>blood mist</b> until the start of your next turn: <b>resistance to all</b>, you can <b>move through creatures</b>, you <b>can’t cast leveled spells or make attacks</b>, and <b>enemies can’t make OAs</b> against you.',
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
    return buildRollTemplate('Transfusion (Bonus; 60 ft; Con save)', [
      { label: 'Save DC', value: '[[ @{selected|spell_save_dc} ]]' },
      { label: 'Damage', value: '[[ 2d8 + @{selected|hr_pb} ]] necrotic (half on success)' },
      { label: 'Bloodied bonus', value: 'If target ≤ 1/2 HP, add [[ 1d8 ]] necrotic' },
      { label: 'Heal yourself', value: 'Equal to total necrotic dealt' }
    ]);
  }

  function buildSanguinePoolAction() {
    return buildRollTemplate('Sanguine Pool (Reaction • 1/room)', [
      { label: 'Effect', value: 'Until the start of your next turn you are blood mist: resistance to all damage; move through creatures; cannot cast leveled spells or make attacks; enemies cannot make OAs against you.' }
    ]);
  }

  function buildHemoplagueAction() {
    return buildRollTemplate('Hemoplague (1/room; 20-ft; 60 ft; Con save)', [
      { label: 'Plagued', value: 'Target is <b>Plagued</b> until end of its next turn (takes <b>+@{selected|hr_pb}</b> damage from all sources).' },
      { label: 'Then', value: 'Take [[ 6d6 ]] necrotic (success [[ 3d6 ]] necrotic).' },
      { label: 'Heal yourself', value: 'Equal to necrotic dealt; excess becomes Pact temp HP.' }
    ]);
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

    // Install Vladren's Always Prepared spell list and token actions when available.
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
        { name: 'Sanguine Pool (Reaction • 1/room)', action: buildSanguinePoolAction(), tokenAction: true },
        { name: 'Hemoplague (1/room)', action: buildHemoplagueAction(), tokenAction: true }
      ],
      onInstall: onInstall
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
