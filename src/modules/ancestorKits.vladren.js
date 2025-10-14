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

    // Install Vladren's Always Prepared spell list via repeating spell entries when available.
    if (typeof SpellbookHelper !== 'undefined') {
      SpellbookHelper.installAlwaysPrepared(charId, [
        { name: 'False Life', level: 1, school: 'Necromancy', range: 'Self', components: 'V,S,M', duration: '1 hour', effect: 'Gain [[ 1d4 + 4 + @{selected|hr_spellmod} + @{selected|hr_false_life_pb_bonus} ]] temp HP as per spell.' },
        { name: 'Ray of Sickness', level: 1, school: 'Necromancy', range: '60 ft', components: 'V,S', duration: 'Instant', hit: 'Ranged spell attack; poison on failed Con save.', damage: { roll: '2d8 + @{selected|hr_spellmod}', type: 'poison', notes: 'On a failed Con save the target is poisoned until the end of your next turn.' } },
        { name: 'Ray of Enfeeblement', level: 2, school: 'Necromancy', range: '60 ft', components: 'V,S', duration: '1 minute (Concentration)', effect: 'Target deals half damage with Str attacks (save ends).' },
        { name: 'Mirror Image', level: 2, school: 'Illusion', range: 'Self', components: 'V,S', duration: '1 minute', effect: 'Creates illusory duplicates (no concentration).' },
        { name: 'Vampiric Touch', level: 3, school: 'Necromancy', range: 'Self', components: 'V,S', duration: '1 minute (Concentration)', hit: 'Melee spell attack; necrotic; heal half the damage dealt each hit.', damage: { roll: '3d6 + @{selected|hr_spellmod}', type: 'necrotic', notes: 'Heal for half the necrotic damage dealt.' } },
        { name: 'Blight', level: 4, school: 'Necromancy', range: '30 ft', components: 'V,S', duration: 'Instant', damage: { roll: '8d8 + @{selected|hr_spellmod}', type: 'necrotic', notes: 'Plant creatures make the save at disadvantage and take maximum damage.' } },
        { name: 'Enervation', level: 5, school: 'Necromancy', range: '60 ft', components: 'V,S', duration: '1 minute (Concentration)', damage: { roll: '4d8 + @{selected|hr_spellmod}', type: 'necrotic', notes: 'On a hit, you heal for half the necrotic damage.' }, damage2: { label: 'Sustain', roll: '4d8 + @{selected|hr_spellmod}', type: 'necrotic', notes: 'Each subsequent action while you maintain the beam.' }, effect: 'Ray drains 4d8 necrotic; repeat 4d8 each turn while maintained.' },
        { name: 'Negative Energy Flood', level: 5, school: 'Necromancy', range: '60 ft', components: 'V,M', duration: 'Instant', damage: { roll: '5d12 + @{selected|hr_spellmod}', type: 'necrotic', notes: 'Humanoid reduced to 0 HP may rise as a zombie under your control.' } }
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
