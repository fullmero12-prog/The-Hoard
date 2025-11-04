// ------------------------------------------------------------
// Ancestor Kit Registration: Morvox, Tiny Tyrant
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Registers Morvox’s Staff kit with AncestorKits so it can be bound in runs.
//   • Mirrors token actions that track Phenomenal Malice and cast Dark Star, Event Horizon, and Primordial Burst.
//   • Provides helper API commands to add/spend Malice stacks and to report the current pool.
//   • Seeds sheet attributes (Malice, PB, spell DC/mod/attack) and keeps them synced when stats change.
//   • Hands each controller a personalized kit handout and installs Morvox’s Always Prepared spell list.
//   • Cleans up on uninstall so re-binding the kit starts fresh.
// ------------------------------------------------------------

(function(){
  'use strict';

  var root   = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function warn(message){
    if (logger && logger.warn){
      logger.warn('AncestorKits', message);
    } else if (typeof log === 'function') {
      log('[Hoard Run] [AncestorKits] ⚠️ ' + message);
    }
  }

  function info(message){
    if (logger && logger.info){
      logger.info('AncestorKits', message);
    } else if (typeof log === 'function') {
      log('[Hoard Run] [AncestorKits] ℹ️ ' + message);
    }
  }

  var KIT_KEY  = 'Morvox';
  var KIT_NAME = 'Morvox, Tiny Tyrant';
  var SOURCE_CHARACTER_NAME = 'Ancestor — Morvox, Tiny Tyrant';

  var MALICE_ATTR      = 'hr_morvox_malice';
  var MALICE_MAX_ATTR  = 'hr_morvox_malice_max';
  var SPELL_DC_ATTR    = 'hr_morvox_spell_dc';
  var SPELL_MOD_ATTR   = 'hr_morvox_spell_mod';
  var PB_ATTR          = 'hr_morvox_pb';
  var SPELL_ATK_ATTR   = 'hr_morvox_spell_attack';
  var DEFAULT_MALICE_MAX = 6;

  var TEXT_WRAPPER_START = '<div style="font-family:inherit;font-size:13px;line-height:1.25;">'
    + '<h3 style="margin:0 0 6px 0;">' + KIT_NAME + ' — Tiny Tyrant of the Umbral Staff</h3>';
  var TEXT_WRAPPER_END = '</div>';

  var MALICE_TABLE_HTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="background:#1b1b1b;color:#f0f0f0;"><th style="border:1px solid #444;padding:4px;">Spend</th>'
    + '<th style="border:1px solid #444;padding:4px;">Benefit</th></tr></thead>'
    + '<tbody>'
    + '<tr><td style="border:1px solid #444;padding:4px;">1 Malice</td><td style="border:1px solid #444;padding:4px;">+PB force damage; pull the target 10 ft closer.</td></tr>'
    + '<tr><td style="border:1px solid #444;padding:4px;">2 Malice</td><td style="border:1px solid #444;padding:4px;">+2×PB force; targets that fail saves are slowed until the end of their next turn.</td></tr>'
    + '<tr><td style="border:1px solid #444;padding:4px;">3 Malice</td><td style="border:1px solid #444;padding:4px;">+3×PB force and increase the area by 5 ft; prone creatures become restrained until they stand.</td></tr>'
    + '</tbody></table>';

  var KIT_RULES_HTML = [
    '<b>Phenomenal Malice.</b> Start each room at <b>0/' + DEFAULT_MALICE_MAX + ' Malice</b>. Gain 1 whenever an Ancestor spell damages a creature or forces a failed save (once per target per turn) and when an elite/boss drops inside Event Horizon. Malice resets at the end of the room.',
    '<b>Malice Management.</b> Spend Malice before rolling to amplify spells. Use the kit macros to add/spend stacks and keep <b>@{selected|' + MALICE_ATTR + '}</b> within the displayed max.',
    '<b>Malice Options.</b><br>' + MALICE_TABLE_HTML,
    '<b>Dark Star (Action).</b> 120-ft ranged spell attack for <b>4d10 force + spell mod</b>. On a hit, drag the target 10 ft toward the singularity and grant advantage on the next attack made against it before your next turn ends. Spend Malice to boost the damage (see table).',
    '<b>Event Horizon (Action).</b> Create a 15-ft ring (10-ft hollow center) within 60 ft until the start of your next turn. Creatures entering or starting in the ring make a Strength save vs your DC or are dragged to the center, knocked prone, and have halved speed until your next turn. Success halves Malice riders.',
    '<b>Primordial Burst (1/room).</b> 20-ft radius within 60 ft makes a Con save. Fail: <b>8d6 force + spell mod</b>, spend Malice for +2×PB per stack, and targets at ≤½ HP take +PB force and lose reactions until your next turn. Success: half damage and no rider.'
  ].join('<br><br>');

  var ALWAYS_PREPARED_SPELLS = [
    {
      name: 'Dark Star',
      level: 5,
      school: 'Evocation',
      castingTime: '1 action',
      range: '120 feet',
      components: 'V,S',
      duration: 'Instantaneous',
      hit: 'Make a ranged spell attack against a creature within range.',
      damage: { roll: '4d10', type: 'force' },
      effect: 'On a hit the target is dragged 10 feet toward the point of impact and sheds dim light (attackers gain advantage on the next attack against it before your turn ends).',
      notes: 'Spend Malice before rolling: +PB force per Malice spent and apply the corresponding rider from Phenomenal Malice.'
    },
    {
      name: 'Event Horizon',
      level: 4,
      school: 'Conjuration',
      castingTime: '1 action',
      range: '60 feet',
      components: 'V,S',
      duration: 'Concentration, up to 1 round',
      save: 'Strength (creatures choose to enter or start their turn in the ring)',
      effect: 'Create a 15-foot radius ring with a 10-foot hollow center. Creatures that enter or start their turn in the ring must make a Strength save. On a failure they are pulled to the center, knocked prone, and their speed is halved until the start of your next turn. On a success they resist the pull and halve Malice rider effects.',
      notes: 'The area counts as difficult terrain for hostile creatures pulled by the effect.'
    },
    {
      name: 'Primordial Burst',
      level: 6,
      school: 'Evocation',
      castingTime: '1 action',
      range: '60 feet',
      components: 'V,S',
      duration: 'Instantaneous',
      area: '20-foot radius sphere',
      save: 'Constitution (half damage on a success)',
      damage: { roll: '8d6', type: 'force' },
      effect: 'Spend Malice before rolling: add +2×PB force per Malice spent. Creatures at half hit points or fewer take an extra +PB force on a failed save and cannot take reactions until the start of your next turn.',
      notes: 'Once per room ability. Success halves damage and negates the half-HP rider.'
    }
  ];

  // ------------------------------------------------------------
  // Attribute helpers
  // ------------------------------------------------------------

  function findAttr(charId, name){
    if (!charId || !name || typeof findObjs !== 'function') return null;
    var matches = findObjs({ _type:'attribute', _characterid:charId, name:name }) || [];
    return matches[0] || null;
  }

  function getAttrCurrent(charId, name){
    var attr = findAttr(charId, name);
    return attr ? attr.get('current') : null;
  }

  function setAttr(charId, name, value){
    if (!charId || !name) return null;
    var attr = findAttr(charId, name);
    var payload = { current: value };
    try {
      if (attr){
        if (typeof attr.setWithWorker === 'function') attr.setWithWorker(payload);
        else attr.set('current', value);
        return attr;
      }
      return createObj('attribute', { _characterid: charId, name: name, current: value });
    } catch (err){
      warn('Failed to set attribute ' + name + ' for ' + charId + ': ' + (err && err.message ? err.message : err));
      return null;
    }
  }

  function ensureAttrValue(charId, name, value){
    var current = getAttrCurrent(charId, name);
    if (current !== null && String(current) === String(value)){
      return findAttr(charId, name);
    }
    return setAttr(charId, name, value);
  }

  function removeAttribute(charId, name){
    var attr = findAttr(charId, name);
    if (attr){
      try { attr.remove(); } catch(_){ }
    }
  }

  function toInt(value, fallback){
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)){ return (typeof fallback === 'number') ? fallback : 0; }
    return parsed;
  }

  function getAttributeInt(charId, names){
    if (!charId || typeof findObjs !== 'function') return null;
    var list = Array.isArray(names) ? names.slice() : [names];
    for (var i = 0; i < list.length; i += 1){
      var name = list[i];
      if (!name) continue;
      var attr = findAttr(charId, name);
      if (!attr) continue;
      var val = parseInt(attr.get('current'), 10);
      if (!isNaN(val)) return val;
    }
    return null;
  }

  function abilityModNames(){
    return ['strength_mod','dexterity_mod','constitution_mod','intelligence_mod','wisdom_mod','charisma_mod'];
  }

  function isAbilityModName(name){
    if (!name) return false;
    var mods = abilityModNames();
    for (var i = 0; i < mods.length; i += 1){
      if (mods[i] === name) return true;
    }
    return false;
  }

  function parseSpellcastingAbility(charId){
    var raw = (getAttrCurrent(charId, 'spellcasting_ability') || '').toString().trim();
    if (!raw) return null;

    var pointer = raw.match(/@{([^}]+)}/);
    if (pointer && pointer[1]){
      return pointer[1];
    }

    var lowered = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (/^(int|intelligence)$/.test(lowered)) return 'intelligence_mod';
    if (/^(wis|wisdom)$/.test(lowered)) return 'wisdom_mod';
    if (/^(cha|charisma)$/.test(lowered)) return 'charisma_mod';
    if (/^(str|strength)$/.test(lowered)) return 'strength_mod';
    if (/^(dex|dexterity)$/.test(lowered)) return 'dexterity_mod';
    if (/^(con|constitution)$/.test(lowered)) return 'constitution_mod';
    return null;
  }

  function getSpellModFromSheet(charId){
    var abilityAttr = parseSpellcastingAbility(charId);
    if (abilityAttr){
      var abilityVal = getAttributeInt(charId, [abilityAttr]);
      if (abilityVal !== null) return abilityVal;
    }

    var dc = getAttributeInt(charId, ['spell_save_dc']);
    var pb = getAttributeInt(charId, ['pb']) || 0;
    if (dc !== null){
      var estimate = dc - 8 - pb;
      if (!isNaN(estimate)) return estimate;
    }

    return 0;
  }

  function getSpellSaveDC(charId){
    var dc = getAttributeInt(charId, ['spell_save_dc']);
    if (dc !== null) return dc;
    var pb = getAttributeInt(charId, ['pb']) || 0;
    return 8 + pb + getSpellModFromSheet(charId);
  }

  function getSpellAttackBonus(charId){
    var atk = getAttributeInt(charId, ['spell_attack_bonus']);
    if (atk !== null) return atk;
    var pb = getAttributeInt(charId, ['pb']) || 0;
    return pb + getSpellModFromSheet(charId);
  }

  // ------------------------------------------------------------
  // Handout helpers
  // ------------------------------------------------------------

  function gatherPlayerIds(targetChar, opts){
    opts = opts || {};
    var ids = {};
    if (targetChar && typeof targetChar.get === 'function'){
      var controlledBy = (targetChar.get('controlledby') || '').split(',');
      for (var i = 0; i < controlledBy.length; i += 1){
        var id = (controlledBy[i] || '').trim();
        if (id && id !== 'all'){ ids[id] = true; }
      }
    }
    if (opts.by){ ids[opts.by] = true; }
    return Object.keys(ids);
  }

  function ensureHandoutForPlayer(playerId, playerName){
    if (!playerName) playerName = 'Unknown Player';
    var title = KIT_NAME + ' — Kit (' + playerName + ')';
    var handout = (typeof findObjs === 'function') ? findObjs({ _type:'handout', name:title })[0] : null;
    var permissions = playerId || '';
    try {
      if (!handout){
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
    } catch (err) {
      warn('Failed to ensure Morvox handout for player ' + playerId + ': ' + (err && err.message ? err.message : err));
    }
  }

  // ------------------------------------------------------------
  // Malice state helpers
  // ------------------------------------------------------------

  function ensureMaliceAttributes(charId){
    ensureAttrValue(charId, MALICE_MAX_ATTR, DEFAULT_MALICE_MAX);
    var current = toInt(getAttrCurrent(charId, MALICE_ATTR), 0);
    var max = toInt(getAttrCurrent(charId, MALICE_MAX_ATTR), DEFAULT_MALICE_MAX);
    if (current < 0) current = 0;
    if (current > max) current = max;
    ensureAttrValue(charId, MALICE_ATTR, current);
  }

  function getMalice(charId){
    return toInt(getAttrCurrent(charId, MALICE_ATTR), 0);
  }

  function getMaliceMax(charId){
    return toInt(getAttrCurrent(charId, MALICE_MAX_ATTR), DEFAULT_MALICE_MAX);
  }

  function setMalice(charId, value){
    var max = getMaliceMax(charId);
    var clamped = Math.max(0, Math.min(max, toInt(value, 0)));
    ensureAttrValue(charId, MALICE_ATTR, clamped);
    return clamped;
  }

  function adjustMalice(charId, delta){
    var current = getMalice(charId);
    return setMalice(charId, current + delta);
  }

  function setMaliceMax(charId, value){
    var max = Math.max(1, toInt(value, DEFAULT_MALICE_MAX));
    ensureAttrValue(charId, MALICE_MAX_ATTR, max);
    var current = getMalice(charId);
    if (current > max){
      ensureAttrValue(charId, MALICE_ATTR, max);
    }
    return max;
  }

  // ------------------------------------------------------------
  // Mirror helpers
  // ------------------------------------------------------------

  function syncMirrorsForChar(charId){
    if (!charId) return;
    ensureMaliceAttributes(charId);

    var pb = getAttributeInt(charId, ['pb']);
    if (pb === null) pb = 0;
    ensureAttrValue(charId, PB_ATTR, pb);

    var spellMod = getSpellModFromSheet(charId);
    ensureAttrValue(charId, SPELL_MOD_ATTR, spellMod);

    var spellDc = getSpellSaveDC(charId);
    ensureAttrValue(charId, SPELL_DC_ATTR, spellDc);

    var spellAttack = getSpellAttackBonus(charId);
    ensureAttrValue(charId, SPELL_ATK_ATTR, spellAttack);
  }

  function isMorvoxCharacter(charId){
    if (!charId) return false;
    return !!findAttr(charId, MALICE_MAX_ATTR);
  }

  // ------------------------------------------------------------
  // Chat helpers
  // ------------------------------------------------------------

  function msgWho(msg){
    return (msg && msg.who) ? String(msg.who).replace(/\s*\(GM\)\s*$/, '') : 'GM';
  }

  function charFromMsgOrArg(msg, explicitCharId){
    if (explicitCharId) return explicitCharId;
    try {
      if (msg && msg.selected && msg.selected.length){
        var token = getObj('graphic', msg.selected[0]._id);
        if (token){
          var cid = token.get('represents');
          if (cid) return cid;
        }
      }
    } catch (_){ }
    return null;
  }

  function parseOpts(args){
    var out = { char: null, rest: [] };
    for (var i = 0; i < args.length; i += 1){
      var raw = String(args[i] || '');
      if (raw === '--char'){ out.char = args[i + 1] || null; i += 1; }
      else out.rest.push(raw);
    }
    return out;
  }

  function sendWhisper(target, html){
    if (typeof sendChat === 'function'){
      sendChat('Morvox', '/w "' + target + '" ' + html);
    }
  }

  function handleMaliceCommand(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args || []);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){
      sendWhisper(who, '⚠️ Select a token representing the character (or use `--char <id>`).');
      return;
    }

    if (!isMorvoxCharacter(charId)){
      ensureMaliceAttributes(charId);
    }

    var rest = opts.rest || [];
    var verb = (rest[0] || 'show').toLowerCase();
    var amount = rest.length > 1 ? toInt(rest[1], 0) : 0;
    var response = '';

    if (verb === 'show'){
      // nothing extra
    } else if (verb === 'add' || verb === '+'){
      if (!amount) amount = 1;
      var afterAdd = adjustMalice(charId, amount);
      response = 'Gained <b>' + amount + '</b> Malice. ';
      response += 'Current: <b>' + afterAdd + '</b> / ' + getMaliceMax(charId) + '.';
    } else if (verb === 'spend' || verb === 'remove' || verb === '-'){
      if (!amount) amount = 1;
      var afterSpend = adjustMalice(charId, -Math.abs(amount));
      response = 'Spent <b>' + Math.abs(amount) + '</b> Malice. ';
      response += 'Current: <b>' + afterSpend + '</b> / ' + getMaliceMax(charId) + '.';
    } else if (verb === 'set'){
      var setValue = toInt(rest[1], 0);
      var setAfter = setMalice(charId, setValue);
      response = 'Malice set to <b>' + setAfter + '</b> / ' + getMaliceMax(charId) + '.';
    } else if (verb === 'setmax' || verb === 'max'){
      var newMax = setMaliceMax(charId, rest.length > 1 ? rest[1] : DEFAULT_MALICE_MAX);
      response = 'Max Malice set to <b>' + newMax + '</b>. Current: <b>' + getMalice(charId) + '</b> / ' + newMax + '.';
    } else if (verb === 'reset'){
      var resetAfter = setMalice(charId, 0);
      response = 'Malice reset to <b>' + resetAfter + '</b> / ' + getMaliceMax(charId) + '.';
    } else {
      sendWhisper(who, 'Usage: `!morvox-malice [add|spend|set <N>|setmax <N>|reset|show]` (select the character token).');
      return;
    }

    if (!response){
      response = 'Malice: <b>' + getMalice(charId) + '</b> / ' + getMaliceMax(charId) + '.';
    }

    sendWhisper(who, response);
  }

  // ------------------------------------------------------------
  // Token actions
  // ------------------------------------------------------------

  function buildRollTemplate(title, rows){
    var parts = ['&{template:default} {{name=' + title + '}}'];
    (rows || []).forEach(function(row){
      if (!row) return;
      var key = row.key || row.label || '';
      if (!key) return;
      var value = row.value || '';
      parts.push('{{' + key + '=' + value + '}}');
    });
    return parts.join(' ');
  }

  function buildMaliceOverviewAction(){
    return buildRollTemplate('Phenomenal Malice', [
      { label: 'Passive', value: 'Gain 1 Malice when Ancestor spells hit or force failed saves (per target/turn). Reset at end of room.' },
      { label: 'Tracking', value: 'Current [[@{selected|' + MALICE_ATTR + '}]] / [[@{selected|' + MALICE_MAX_ATTR + '}]]. Use Gain/Spend actions or `!morvox-malice` to adjust.' },
      { label: 'Spend Table', value: '1 ⇒ +PB force & pull; 2 ⇒ +2×PB force & slow; 3 ⇒ +3×PB force, +5 ft area, restrain prone foes.' }
    ]);
  }

  function buildDarkStarAction(){
    var maliceInline = '[[?{Malice to spend?|0}]]'; // roll 0
    var damage = '[[ 4d10 + @{selected|' + SPELL_MOD_ATTR + '} + ($[[0]] * @{selected|' + PB_ATTR + '}) ]]';
    return (
      '&{template:atk} '
      + '{{attack=1}} '
      + '{{rname=🌑 Dark Star}} '
      + '{{malice=Spending ' + maliceInline + ' Malice}} '
      + '{{mod=@{selected|' + SPELL_ATK_ATTR + '}}} '
      + '{{r1=[[ 1d20 + @{selected|' + SPELL_ATK_ATTR + '} ]]}} '
      + '{{r2=[[ 1d20 + @{selected|' + SPELL_ATK_ATTR + '} ]]}} '
      + '{{range=Ranged spell attack (120 ft)}} '
      + '{{dmg1flag=1}} '
      + '{{damage=1}} '
      + '{{dmg1=' + damage + '}} '
      + '{{dmg1type=force}} '
      + '{{desc=On hit: pull target 10 ft and grant advantage to the next attack before your turn ends. Remember to spend Malice with the helper macro.}}'
    );
  }

  function buildEventHorizonAction(){
    return buildRollTemplate('Event Horizon', [
      { label: 'Save', value: 'Strength save DC [[@{selected|' + SPELL_DC_ATTR + '}]] (half Malice riders on success).' },
      { label: 'Area', value: '15-ft ring (10-ft hollow center) within 60 ft; lasts until the start of your next turn.' },
      { label: 'Effect', value: 'Fail ⇒ pulled to center, prone, speed halved. Success ⇒ resist pull. Gain 1 Malice when elites/bosses fall inside.' }
    ]);
  }

  function buildPrimordialBurstAction(){
    var maliceInline = '[[?{Malice to spend?|0}]]'; // roll 0
    var halfInline = '[[?{Targets at or below half HP?|0}]]'; // roll 1
    var damage = '[[ 8d6 + @{selected|' + SPELL_MOD_ATTR + '} + ($[[0]] * 2 * @{selected|' + PB_ATTR + '}) + ($[[1]] * @{selected|' + PB_ATTR + '}) ]]';
    return (
      '&{template:spell} '
      + '{{spell=1}} '
      + '{{name=🌌 Primordial Burst}} '
      + '{{school=Evocation}} '
      + '{{level=1/room}} '
      + '{{castingtime=1 action}} '
      + '{{range=60 ft (20-ft radius)}} '
      + '{{malice=Spending ' + maliceInline + ' Malice}} '
      + '{{targets=Half-HP targets noted: ' + halfInline + '}} '
      + '{{save=Constitution}} '
      + '{{savedc=@{selected|' + SPELL_DC_ATTR + '}}} '
      + '{{effect=Creatures that fail take full damage and lose reactions if at ≤½ HP. Success ⇒ half damage, no rider.}} '
      + '{{dmg1flag=1}} '
      + '{{dmg1=' + damage + '}} '
      + '{{dmg1type=force}}'
    );
  }

  function actionGainMalice(){
    return '!morvox-malice add ?{Gain how much Malice?|1}';
  }

  function actionSpendMalice(){
    return '!morvox-malice spend ?{Spend how much Malice?|1}';
  }

  function actionShowMalice(){
    return buildRollTemplate('Morvox — Malice Tracker', [
      { label: 'Current', value: '[[ @{selected|' + MALICE_ATTR + '} ]] / [[ @{selected|' + MALICE_MAX_ATTR + '} ]]' },
      { label: 'Reminder', value: 'Use Gain/Spend macros or `!morvox-malice` to update the pool.' }
    ]);
  }

  // ------------------------------------------------------------
  // Install / Uninstall
  // ------------------------------------------------------------

  function onInstall(targetChar, opts){
    if (!targetChar) return;
    var charId = targetChar.id || (typeof targetChar.get === 'function' && targetChar.get('_id'));
    var playerIds = gatherPlayerIds(targetChar, opts || {});

    for (var i = 0; i < playerIds.length; i += 1){
      var pid = playerIds[i];
      if (!pid) continue;
      var player = getObj && getObj('player', pid);
      var name = player ? player.get('_displayname') : 'Unknown Player';
      ensureHandoutForPlayer(pid, name);
    }

    if (!charId) return;

    ensureMaliceAttributes(charId);
    syncMirrorsForChar(charId);

    if (typeof SpellbookHelper !== 'undefined' && SpellbookHelper && typeof SpellbookHelper.installAlwaysPrepared === 'function'){
      SpellbookHelper.installAlwaysPrepared(charId, ALWAYS_PREPARED_SPELLS);
    }
  }

  function onUninstall(targetChar){
    if (!targetChar) return;
    var charId = targetChar.id || (typeof targetChar.get === 'function' && targetChar.get('_id'));
    if (!charId) return;

    removeAttribute(charId, MALICE_ATTR);
    removeAttribute(charId, MALICE_MAX_ATTR);
    removeAttribute(charId, SPELL_DC_ATTR);
    removeAttribute(charId, SPELL_MOD_ATTR);
    removeAttribute(charId, PB_ATTR);
    removeAttribute(charId, SPELL_ATK_ATTR);

    if (typeof SpellbookHelper !== 'undefined' && SpellbookHelper && typeof SpellbookHelper.removeAlwaysPreparedForCharacter === 'function'){
      SpellbookHelper.removeAlwaysPreparedForCharacter(charId);
    }
  }

  // ------------------------------------------------------------
  // Event hooks
  // ------------------------------------------------------------

  function handleAttributeChange(attr){
    if (!attr) return;
    var charId = attr.get('_characterid');
    if (!charId || !isMorvoxCharacter(charId)) return;

    var name = attr.get('name');
    if (!name) return;

    if (name === 'pb'){
      ensureAttrValue(charId, PB_ATTR, toInt(attr.get('current'), 0));
      syncMirrorsForChar(charId);
      return;
    }

    if (name === 'spell_save_dc'){
      ensureAttrValue(charId, SPELL_DC_ATTR, toInt(attr.get('current'), getSpellSaveDC(charId)));
      return;
    }

    if (name === 'spell_attack_bonus'){
      ensureAttrValue(charId, SPELL_ATK_ATTR, toInt(attr.get('current'), getSpellAttackBonus(charId)));
      return;
    }

    if (name === MALICE_MAX_ATTR){
      setMaliceMax(charId, toInt(attr.get('current'), DEFAULT_MALICE_MAX));
      return;
    }

    if (name === 'spellcasting_ability' || isAbilityModName(name)){
      syncMirrorsForChar(charId);
    }
  }

  if (typeof on === 'function'){
    on('chat:message', function(msg){
      if (!msg || msg.type !== 'api') return;
      var parts = (msg.content || '').trim().split(/\s+/);
      if (!parts.length) return;
      var command = parts[0];
      if (command === '!morvox-malice'){
        handleMaliceCommand(msg, parts.slice(1));
      }
    });

    on('change:attribute', handleAttributeChange);
  }

  // ------------------------------------------------------------
  // Registration
  // ------------------------------------------------------------

  var _registered = false;

  function registerKit(){
    if (_registered) return true;
    if (typeof AncestorKits === 'undefined' || !AncestorKits || typeof AncestorKits.register !== 'function'){
      return false;
    }

    AncestorKits.register(KIT_KEY, {
      ancestor: KIT_NAME,
      prefix: KIT_KEY,
      sourceCharacterName: SOURCE_CHARACTER_NAME,
      abilities: [
        { name: 'Phenomenal Malice (Info)', action: buildMaliceOverviewAction(), tokenAction: true },
        { name: 'Dark Star', action: buildDarkStarAction(), tokenAction: true },
        { name: 'Event Horizon', action: buildEventHorizonAction(), tokenAction: true },
        { name: 'Primordial Burst (1/room)', action: buildPrimordialBurstAction(), tokenAction: true },
        { name: 'Gain Malice (+)', action: actionGainMalice(), tokenAction: true },
        { name: 'Spend Malice (-)', action: actionSpendMalice(), tokenAction: true },
        { name: 'Show Malice', action: actionShowMalice(), tokenAction: true }
      ],
      onInstall: onInstall,
      onUninstall: onUninstall
    });

    _registered = true;
    info('Registered Morvox ancestor kit.');
    return true;
  }

  if (!registerKit() && typeof on === 'function'){
    on('ready', function(){
      if (!registerKit()){
        warn('Morvox kit failed to register – AncestorKits.register unavailable.');
      }
    });
  }

})();

