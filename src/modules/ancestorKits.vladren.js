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

  if (typeof AncestorKits === 'undefined' || !AncestorKits || typeof AncestorKits.register !== 'function') {
    return;
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
    '<b>Sanguine Pool (Reaction, 1/SR).</b> When you take damage, become <b>blood mist</b> until the start of your next turn: <b>resistance to all</b>, you can <b>move through creatures</b>, you <b>can’t cast leveled spells or make attacks</b>, and <b>enemies can’t make OAs</b> against you.',
    '<b>Hemoplague (1/SR).</b> <b>20-ft radius</b> point within 60 ft, Con save → target is <b>Plagued</b> until end of next turn (<b>+PB damage</b> from all sources), then it takes <b>6d6 necrotic</b> (success <b>3d6</b>). You <b>heal</b> for the total necrotic; excess healing becomes <b>Pact temp HP</b>.'
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
    return buildRollTemplate('Crimson Pact (Info)', [
      { label: 'Cap', value: '[[ 5*?{PB|3} + ?{Spell Mod|4} ]]' },
      { label: 'While active', value: '+1 AC; your necrotic ignores resistance (treat immunity as resistance).' },
      { label: 'Convert healing to temp HP?', value: '[[?{Healed Amount|0}]] (apply up to cap)' }
    ]);
  }

  function buildTransfusionAction() {
    return buildRollTemplate('Transfusion (Bonus; 60 ft; Con save)', [
      { label: 'Save DC', value: '[[ 8 + ?{PB|3} + ?{Spell Mod|4} ]]' },
      { label: 'Damage', value: '[[ 2d8 + ?{PB|3} ]] necrotic (half on success)' },
      { label: 'Bloodied bonus', value: 'If target ≤ 1/2 HP, add [[ 1d8 ]] necrotic' },
      { label: 'Heal yourself', value: 'Equal to total necrotic dealt' }
    ]);
  }

  function buildSanguinePoolAction() {
    return buildRollTemplate('Sanguine Pool (Reaction • 1/SR)', [
      { label: 'Effect', value: 'Until the start of your next turn you are blood mist: resistance to all damage; move through creatures; cannot cast leveled spells or make attacks; enemies cannot make OAs against you.' }
    ]);
  }

  function buildHemoplagueAction() {
    return buildRollTemplate('Hemoplague (1/SR; 20-ft; 60 ft; Con save)', [
      { label: 'Plagued', value: 'Target is <b>Plagued</b> until end of its next turn (takes <b>+?{PB|3}</b> damage from all sources).' },
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

    if (!ids.length) {
      return;
    }

    ids.forEach(function(playerId){
      var player = getObj('player', playerId);
      var name = player ? player.get('_displayname') : 'Unknown Player';
      ensureHandoutForPlayer(playerId, name);
    });
  }

  AncestorKits.register(KIT_KEY, {
    ancestor: KIT_NAME,
    prefix: KIT_KEY,
    sourceCharName: SOURCE_CHARACTER_NAME,
    sourceCharacterName: SOURCE_CHARACTER_NAME,
    abilities: [
      { name: 'Crimson Pact (Info)', action: buildCrimsonPactAction(), tokenAction: true },
      { name: 'Transfusion (Bonus)', action: buildTransfusionAction(), tokenAction: true },
      { name: 'Sanguine Pool (Reaction • 1/SR)', action: buildSanguinePoolAction(), tokenAction: true },
      { name: 'Hemoplague (1/SR)', action: buildHemoplagueAction(), tokenAction: true }
    ],
    onInstall: onInstall
  });

})();
