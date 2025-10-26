// ------------------------------------------------------------
// Ancestor Kit Registration: Seraphine Emberwright
// ------------------------------------------------------------
// What this does (in simple terms):
//   • Registers the Seraphine kit with the shared AncestorKits core.
//   • Adds token actions to track Heat (+25 / +10), Vent, and Overheat helpers.
//   • Auto-triggers Overheat at ≥ Heat cap (default 100): temp HP = PB + spell mod; Heat resets to 0.
//   • Gives each controller a personal kit handout with rules.
//   • Uses sheet PB directly and derives spell mod from `spellcasting_ability` (no hr_* mirrors).
// ------------------------------------------------------------

(function(){
  'use strict';

  var root   = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function warn(message){
    if (logger && logger.warn) logger.warn('AncestorKits', message);
    else if (typeof log === 'function') log('[Hoard Run] [AncestorKits] ⚠️ ' + message);
  }

  // --- Sheet/Attr helpers ----------------------------------------------------

  function findAttr(charId, name){
    if (!charId || !name) return null;
    var m = findObjs({_type:'attribute', _characterid:charId, name:name}) || [];
    return m[0] || null;
  }

  function getAttrCurrent(charId, name){
    var a = findAttr(charId, name);
    return a ? a.get('current') : null;
  }

  function setAttr(charId, name, value){
    if (!charId || !name) return null;
    var attr = findAttr(charId, name);
    var payload = {current:value};
    try{
      if (attr){
        if (typeof attr.setWithWorker === 'function') attr.setWithWorker(payload);
        else attr.set('current', value);
        return attr;
      } else {
        return createObj('attribute', {_characterid:charId, name:name, current:value});
      }
    }catch(err){
      warn('Failed to set/create attr ' + name + ' for ' + charId + ': ' + (err.message||err));
      return null;
    }
  }

  function ensureAttrValue(charId, name, value){
    var cur = getAttrCurrent(charId, name);
    if (cur === null || String(cur) !== String(value)) return setAttr(charId, name, value);
    return findAttr(charId, name);
  }

  function ensureAbility(charId, abilityName, action, isTokenAction){
    if (!charId || !abilityName) return null;

    var ability = (findObjs({
      _type:'ability',
      _characterid:charId,
      name:abilityName
    }) || [])[0];

    try {
      if (!ability){
        ability = createObj('ability', {
          _characterid:charId,
          name:abilityName,
          action:action || '',
          istokenaction:!!isTokenAction
        });
      } else {
        ability.set({
          action:action || '',
          istokenaction:!!isTokenAction
        });
      }
    } catch (err) {
      return null;
    }

    return ability || null;
  }

  function getAttributeInt(characterId, names){
    if (!characterId) return null;
    var list = Array.isArray(names) ? names.slice() : [names];
    for (var i = 0; i < list.length; i++){
      var nm = list[i]; if (!nm) continue;
      var a = (findObjs({_type:'attribute', _characterid:characterId, name:nm}) || [])[0];
      if (!a) continue;
      var v = parseInt(a.get('current'), 10);
      if (!isNaN(v)) return v;
    }
    return null;
  }

  // --- Spell mod resolver (from spellcasting_ability) ------------------------

  function toInt(x){
    var n = parseInt(x, 10);
    return isNaN(n) ? 0 : n;
  }

  function buildStaffAttackMacro(charId){
    var toHit = toInt(getAttrByName(charId, 'spell_attack_bonus'));
    var pb    = getAttributeInt(charId, ['pb']) || 0;
    var sm    = getSpellModFromSheet(charId);

    if (!toHit) toHit = pb + sm;

    var ohActive = isOverheated(charId);
    var desc = 'Use your spellcasting ability for attack & damage. On hit: click the staff name above to roll damage, then press <b>Stoke +25</b> (cantrip hit = <b>Stoke +10</b>).';
    if (ohActive){
      desc += ' <b>Overheated:</b> Staff damage adds +2d8 fire and reach is 15 ft until your next turn.';
    } else {
      desc += ' Overheated hits add +2d8 fire and extend reach to 15 ft until your next turn.';
    }

    return (
      '&{template:atk} ' +
      '{{attack=1}} ' +
      '{{rname=[Emberwright’s Staff](~selected|Seraphine_Staff_Damage)}} {{rnamec=Emberwright’s Staff}} ' +
      '{{mod=' + toHit + '}} ' +
      '{{r1=[[ 1d20 + ' + toHit + ' ]]}} ' +
      '{{r2=[[ 1d20 + ' + toHit + ' ]]}} ' +
      '{{range=melee (reach 10 ft; 15 ft while Overheated)}} ' +
      '{{desc=' + desc + '}} ' +
      '{{always=1}}'
    );
  }

  function getSpellModFromSheet(charId){
    // Try to parse spellcasting_ability, which often looks like "@{intelligence_mod}" (sometimes with a trailing '+')
    var raw = (getAttrCurrent(charId, 'spellcasting_ability') || '').toString().trim();
    if (raw){
      // Case A: pointer like "@{intelligence_mod}" (possible trailing '+')
      var m = raw.match(/@{([^}]+)}/);
      var key = m ? m[1] : null;

      // Case B: plain ability name like "intelligence"/"wisdom"/"charisma" (or abbrev)
      if (!key){
        var t = raw.toLowerCase().replace(/[^a-z]/g, '');
        if (/^(int|intelligence)$/.test(t)) key = 'intelligence_mod';
        else if (/^(wis|wisdom)$/.test(t)) key = 'wisdom_mod';
        else if (/^(cha|charisma)$/.test(t)) key = 'charisma_mod';
        else if (/^(str|strength)$/.test(t)) key = 'strength_mod';
        else if (/^(dex|dexterity)$/.test(t)) key = 'dexterity_mod';
        else if (/^(con|constitution)$/.test(t)) key = 'constitution_mod';
      }

      if (key){
        var val = getAttributeInt(charId, [key]);
        if (val != null) return val;
      }
    }

    // Fallback: estimate from DC (DC = 8 + PB + mod)
    var dc = getAttributeInt(charId, ['spell_save_dc']);
    var pb = getAttributeInt(charId, ['pb']) || 0;
    if (dc != null){
      var est = dc - 8 - pb;
      if (!isNaN(est)) return est;
    }

    return 0;
  }

  // --- Seraphine constants ---------------------------------------------------

  var KIT_KEY   = 'Seraphine';
  var KIT_NAME  = 'Seraphine Emberwright';
  var SRC_NAME  = 'Ancestor — Seraphine Emberwright';

  var HEAT_ATTR      = 'hr_seraphine_heat';
  var HEAT_CAP_ATTR  = 'hr_seraphine_heat_cap';
  var OVERHEAT_FLAG  = 'hr_seraphine_overheat_active';

  // Handout content
  var TEXT_WRAPPER_START = '<div style="font-family:inherit;font-size:13px;line-height:1.25;">'
    + '<h3 style="margin:0 0 6px 0;">' + KIT_NAME + ' — Phoenix of the Nine Coals</h3>';
  var TEXT_WRAPPER_END = '</div>';

  var KIT_RULES_HTML = [
    '<b>Save DC (Seraphine).</b> 8 + PB + your spell mod.',
    '<b>Emberwright’s Staff (Corridor-only).</b> Magical quarterstaff; use your spellcasting ability for attack & damage. Reach 10 ft. When you take the Attack action with it, make two staff attacks.',
    '<b>Stoke the Coals (Heat).</b> Staff hit or leveled spell: <b>+25 Heat</b> (cantrip: <b>+10</b>).',
    '<b>Overheat (100 Heat).</b> The action that hit 100 gains Overheat benefits. Until the start of your next turn: staff attacks gain <b>+2d8 fire</b> and reach <b>15 ft</b>; your spells add <b>+1d8 fire</b> to one target they damage; you gain <b>temp HP = PB + your spell mod</b> and <b>speed −10 ft</b>. Then Heat resets to 0.',
    '<b>Vent (Bonus, 1/turn).</b> Drop all Heat. Each creature of your choice within 5 ft makes a Dex save; on a fail it takes <b>(Heat ÷ 25)d10 fire</b> (half on success). Ignite up to two 5-ft squares (difficult terrain; 1d6 fire on enter/start) until your next turn.'
  ].join('<br><br>');

  // --- Roll template helper --------------------------------------------------

  function rtDefault(title, rows){
    var p = ['&{template:default} {{name=' + title + '}}'];
    (rows||[]).forEach(function(r){
      if (!r) return;
      var k = r.key || r.label || 'info';
      p.push('{{' + k + '=' + (r.value||'') + '}}');
    });
    return p.join(' ');
  }

  // --- Heat management -------------------------------------------------------

  function getHeat(charId){
    var v = parseInt(getAttrCurrent(charId, HEAT_ATTR)||'0',10);
    return isNaN(v) ? 0 : Math.max(0,v);
  }
  function getHeatCap(charId){
    var v = parseInt(getAttrCurrent(charId, HEAT_CAP_ATTR)||'100',10);
    return (isNaN(v) || v<=0) ? 100 : v;
  }
  function setHeat(charId, value){
    return setAttr(charId, HEAT_ATTR, Math.max(0, Math.floor(value||0)));
  }
  function addHeat(charId, delta){
    var n = getHeat(charId) + Math.floor(delta||0);
    setHeat(charId, n);
    return n;
  }

  function setOverheatFlag(charId, on){
    ensureAttrValue(charId, OVERHEAT_FLAG, on ? 1 : 0);
  }
  function isOverheated(charId){
    var v = String(getAttrCurrent(charId, OVERHEAT_FLAG)||'0').trim().toLowerCase();
    return (v !== '0' && v !== 'false' && v !== 'off' && v !== '');
  }

  // Temp HP helper: set hp_temp to max(current, value)
  function applyTempHpMax(charId, tempAmount){
    var tempAttr = findAttr(charId, 'hp_temp');
    var cur = parseInt(tempAttr ? tempAttr.get('current') : '0', 10);
    if (isNaN(cur)) cur = 0;
    var next = Math.max(cur, Math.max(0, Math.floor(tempAmount||0)));

    if (tempAttr){
      if (typeof tempAttr.setWithWorker === 'function') tempAttr.setWithWorker({current: next});
      else tempAttr.set('current', next);
    } else {
      createObj('attribute', {_characterid:charId, name:'hp_temp', current: next});
    }
    return {before:cur, after:next};
  }

  // --- Overheat flow ---------------------------------------------------------

  function triggerOverheat(charId, who){
    var pb  = getAttributeInt(charId, ['pb']) || 0;
    var mod = getSpellModFromSheet(charId);
    var thp = pb + mod;

    setHeat(charId, 0);
    setOverheatFlag(charId, true);

    var tempRes = applyTempHpMax(charId, thp);

    var msg = rtDefault('🔥 OVERHEAT!', [
      {label:'Until your next turn', value:'Staff: +2d8 fire & reach 15 ft; Spells: +1d8 fire to one target; Speed −10 ft.'},
      {label:'Temp HP', value:'Gained <b>' + thp + '</b> (sheet now <b>' + tempRes.after + '</b>).'},
      {label:'Reminder', value:'Apply the benefits to the action that pushed Heat ≥ 100.'}
    ]);

    sendChat('Seraphine', '/w "' + (who||'GM') + '" ' + msg);
  }

  function maybeOverheat(charId, who){
    var cap = getHeatCap(charId);
    var cur = getHeat(charId);
    if (cur >= cap){
      triggerOverheat(charId, who);
      return true;
    }
    return false;
  }

  // --- Chat utils ------------------------------------------------------------

  function msgWho(msg){
    return (msg && msg.who) ? String(msg.who).replace(/\s*\(GM\)\s*$/,'') : 'GM';
  }

  function charFromMsgOrArg(msg, explicitCharId){
    if (explicitCharId) return explicitCharId;

    try{
      if (msg && msg.selected && msg.selected.length){
        var tok = getObj('graphic', msg.selected[0]._id);
        if (tok){
          var cid = tok.get('represents');
          if (cid) return cid;
        }
      }
    }catch(_){ }
    return null;
  }

  function parseOpts(args){
    var out = {char:null, rest:[]};
    for (var i=0;i<args.length;i++){
      var a = String(args[i]||'');
      if (a === '--char'){
        out.char = args[i+1] || null; i++;
      } else {
        out.rest.push(a);
      }
    }
    return out;
  }

  // --- API commands ----------------------------------------------------------

  // !seraphine-heat +25|+10|add <n>|set <n>|reset|show [--char <characterId>]
  function handleHeatCommand(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args||[]);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){ sendChat('Seraphine','/w "'+who+'" ⚠️ Select a token (or use --char <id>).'); return; }

    var rest = opts.rest;
    var verb = (rest[0]||'').toLowerCase();

    if (!verb){
      sendChat('Seraphine','/w "'+who+'" Heat: <b>' + getHeat(charId) + '</b> / ' + getHeatCap(charId));
      return;
    }

    var delta = 0, showAfter = true;

    if (verb === 'show'){
      // just show
    } else if (verb === 'reset'){
      setHeat(charId, 0);
      setOverheatFlag(charId, false);
      sendChat('Seraphine','/w "'+who+'" Heat reset to <b>0</b>. Overheat flag cleared.');
      showAfter = false;
    } else if (verb === 'set'){
      var v = parseInt(rest[1]||'0',10);
      if (isNaN(v)) v = 0;
      setHeat(charId, v);
      maybeOverheat(charId, who);
    } else if (verb === '+25' || verb === 'add25' || verb === '25'){
      delta = 25; addHeat(charId, delta); maybeOverheat(charId, who);
    } else if (verb === '+10' || verb === 'add10' || verb === '10'){
      delta = 10; addHeat(charId, delta); maybeOverheat(charId, who);
    } else if (verb === 'add'){
      var n = parseInt(rest[1]||'0',10); if (isNaN(n)) n=0;
      addHeat(charId, n); maybeOverheat(charId, who);
    } else {
      sendChat('Seraphine','/w "'+who+'" Usage: !seraphine-heat [+25|+10|add N|set N|reset|show] [--char id]');
      showAfter = false;
    }

    if (showAfter){
      sendChat('Seraphine','/w "'+who+'" Heat: <b>' + getHeat(charId) + '</b> / ' + getHeatCap(charId) + (delta?(' (+'+delta+')'):''));
    }
  }

  // !seraphine-vent [--char <id>]
  function handleVentCommand(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args||[]);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){ sendChat('Seraphine','/w "'+who+'" ⚠️ Select a token (or use --char <id>).'); return; }

    var heat = getHeat(charId);
    var steps = Math.floor(heat/25);
    var pb = getAttributeInt(charId, ['pb']) || 0;
    var sm = getSpellModFromSheet(charId);
    var dc = 8 + pb + sm;

    // Reset Heat
    setHeat(charId, 0);

    var desc = rtDefault('🌬️ Vent (Bonus • 1/turn)', [
      {label:'Save', value:'Dex save <b>DC ' + dc + '</b> (half on success)'},
      {label:'Damage', value: steps>0 ? ('Roll [['+ steps +'d10]] fire') : 'No damage (needed ≥25 Heat)'},
      {label:'Effect', value:'You drop all Heat (now 0). Ignite up to two 5-ft squares (difficult terrain; 1d6 fire on enter/start) until your next turn.'}
    ]);

    sendChat('Seraphine','/w "'+who+'" ' + desc);
  }

  // !seraphine-overheat-clear [--char <id>]
  function handleOverheatClear(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args||[]);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){ sendChat('Seraphine','/w "'+who+'" ⚠️ Select a token (or use --char <id>).'); return; }

    setOverheatFlag(charId, false);
    sendChat('Seraphine','/w "'+who+'" Overheat cleared. (Start of your turn reminder.)');
  }

  // !seraphine-staff-dmg [--char <id>] [--crit 0|1]
  function handleStaffDamageCommand(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args||[]);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){ sendChat('Seraphine','/w "'+who+'" ⚠️ Select a token (or use --char <id>).'); return; }

    var rest = opts.rest || [];
    var critFlag = 0;
    for (var i = 0; i < rest.length; i++){
      var raw = String(rest[i]||'');
      var low = raw.toLowerCase();
      if (low === '--crit'){
        var next = rest[i+1];
        critFlag = parseInt(next||'0', 10);
        if (isNaN(critFlag)) critFlag = 0;
        i++;
      } else if (low.indexOf('--crit=') === 0){
        var val = raw.split('=')[1];
        critFlag = parseInt(val||'0', 10);
        if (isNaN(critFlag)) critFlag = 0;
      }
    }
    critFlag = critFlag ? 1 : 0;

    var spellMod = getSpellModFromSheet(charId);
    var overheated = isOverheated(charId);

    var baseDice = critFlag ? 2 : 1;
    var dmgRoll = '[[ ' + baseDice + 'd8 + (' + spellMod + ') ]]';

    var tmpl = [
      '&{template:dmg}',
      '{{rname=Emberwright’s Staff}}',
      '{{range=melee}}',
      '{{damage=1}}',
      '{{dmg1flag=1}}',
      '{{dmg1=' + dmgRoll + '}}',
      '{{dmg1type=bludgeoning (magical)}}'
    ];

    if (overheated){
      var fireDice = critFlag ? 4 : 2;
      tmpl.push('{{dmg2flag=1}}');
      tmpl.push('{{dmg2=[[ ' + fireDice + 'd8 ]]}}');
      tmpl.push('{{dmg2type=fire (Overheat)}}');
      tmpl.push('{{desc=Overheated: Staff gains +2d8 fire (doubled on crit) and reach 15 ft until your next turn. Use !seraphine-overheat-clear at the start of your turn.}}');
    } else {
      tmpl.push('{{dmg2flag=0}}');
      tmpl.push('{{desc=On hit: Stoke +25 Heat (cantrip: +10). Overheated hits add +2d8 fire.}}');
    }

    tmpl.push('{{always=1}}');

    sendChat('Seraphine', tmpl.join(' '));
  }

  // !seraphine-staff-attack [--char <id>]
  function handleStaffAttackCommand(msg, args){
    var who = msgWho(msg);
    var opts = parseOpts(args||[]);
    var charId = charFromMsgOrArg(msg, opts.char);
    if (!charId){ sendChat('Seraphine','/w "'+who+'" ⚠️ Select a token (or use --char <id>).'); return; }

    var macro = buildStaffAttackMacro(charId);
    sendChat('Seraphine', macro);
  }

  if (typeof on === 'function'){
    on('chat:message', function(msg){
      if (msg.type !== 'api' || !msg.content) return;
      var parts = msg.content.trim().split(/\s+/);
      var cmd   = parts[0].toLowerCase();
      var args  = parts.slice(1);

      if (cmd === '!seraphine-heat')              handleHeatCommand(msg, args);
      else if (cmd === '!seraphine-vent')         handleVentCommand(msg, args);
      else if (cmd === '!seraphine-overheat-clear') handleOverheatClear(msg, args);
      else if (cmd === '!seraphine-staff-dmg')    handleStaffDamageCommand(msg, args);
      else if (cmd === '!seraphine-staff-attack') handleStaffAttackCommand(msg, args);
    });

    // Safety: if someone hand-edits Heat on the sheet, check the threshold.
    on('change:attribute', function(attr){
      try{
        if (!attr) return;
        if (attr.get('name') !== HEAT_ATTR) return;
        var charId = attr.get('_characterid');
        if (!charId) return;
        var newVal = parseInt(attr.get('current')||'0',10);
        if (newVal >= getHeatCap(charId) && !isOverheated(charId)){
          triggerOverheat(charId, 'GM');
        }
      }catch(e){ warn('Heat watcher error: ' + (e.message||e)); }
    });
  }

  // --- Action builders (token actions) --------------------------------------

  function actionStaffAttack(){
    return '!seraphine-staff-attack --char @{selected|character_id}';
  }
  function actionHeatAdd(n){
    return '!seraphine-heat +' + n + ' --char @{selected|character_id}';
  }
  function actionHeatShow(){
    return '!seraphine-heat show --char @{selected|character_id}';
  }
  function actionVent(){
    return '!seraphine-vent --char @{selected|character_id}';
  }
  function actionOverheatClear(){
    return '!seraphine-overheat-clear --char @{selected|character_id}';
  }
  function actionOverheatDetails(){
    return rtDefault('Overheat — Details', [
      {label:'Until your next turn', value:'Staff +2d8 fire & reach 15 ft; Spells +1d8 fire to one target; Speed −10 ft.'},
      {label:'Temp HP', value:'Gain PB + spell mod; Heat resets to 0.'},
      {label:'Trigger', value:'The action that pushed Heat ≥ 100 benefits.'}
    ]);
  }
  function actionOverheatStaffFire(){
    return rtDefault('Overheat: Staff +2d8 Fire', [{label:'+2d8 fire', value:'[[ 2d8 ]]'}]);
  }
  function actionOverheatSpellFire(){
    return rtDefault('Overheat: Spell +1d8 Fire', [{label:'+1d8 fire', value:'[[ 1d8 ]]'}]);
  }

  // --- Install / Handouts ----------------------------------------------------

  function ensureHandoutForPlayer(playerId, playerName){
    var title = KIT_NAME + ' — Kit (' + (playerName||'Unknown Player') + ')';
    var hand  = findObjs({_type:'handout', name:title})[0];
    var perms = playerId || '';
    if (!hand){
      hand = createObj('handout', {name:title, archived:false, inplayerjournals:perms, controlledby:perms});
    } else {
      hand.set({archived:false, inplayerjournals:perms, controlledby:perms});
    }
    hand.set('notes', TEXT_WRAPPER_START + KIT_RULES_HTML + TEXT_WRAPPER_END);
    return hand;
  }

  function gatherPlayerIds(targetChar, opts){
    var ids = {};
    var controlled = (targetChar.get('controlledby')||'').split(',');
    controlled.forEach(function(entry){
      var id = (entry||'').trim();
      if (!id || id === 'all') return;
      ids[id] = true;
    });
    if (opts && opts.by && !ids[opts.by]) ids[opts.by] = true;
    return Object.keys(ids);
  }

  function onInstall(targetChar, opts){
    var ids = gatherPlayerIds(targetChar, opts||{});
    var charId = targetChar && (targetChar.id || targetChar.get('_id'));

    ids.forEach(function(pid){
      var p = getObj('player', pid);
      ensureHandoutForPlayer(pid, p ? p.get('_displayname') : 'Unknown Player');
    });

    if (!charId) return;

    // Heat baseline only (no hr_pb/hr_spellmod mirrors)
    ensureAttrValue(charId, HEAT_ATTR, 0);
    ensureAttrValue(charId, HEAT_CAP_ATTR, 100);
    ensureAttrValue(charId, OVERHEAT_FLAG, 0);
    ensureAbility(charId, 'Seraphine_Staff_Damage', '!seraphine-staff-dmg --char @{selected|character_id} --crit ?{Critical hit?|No,0|Yes,1}', false);

    // Install Seraphine's Always Prepared list
    if (typeof SpellbookHelper !== 'undefined'){
      SpellbookHelper.installAlwaysPrepared(charId, [
        {
          name: 'Absorb Elements',
          level: 1,
          school: 'Abjuration',
          castingTime: '1 reaction (when you take acid, cold, fire, lightning, or thunder damage)',
          range: 'Self',
          components: 'S',
          duration: '1 round',
          effect: 'The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack. You have resistance to the triggering damage type until the start of your next turn. Also, the first time you hit with a melee attack on your next turn, the target takes an extra 1d6 damage of the triggering type, and the spell ends.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each slot level above 1st. Spell Lists: Artificer, Druid, Ranger, Sorcerer, Wizard. Source: Xanathar\'s Guide to Everything.'
        },
        {
          name: 'Burning Hands',
          level: 1,
          school: 'Evocation',
          castingTime: '1 action',
          range: 'Self (15-foot cone)',
          components: 'V,S',
          duration: 'Instantaneous',
          save: 'Dexterity',
          damage: { roll: '3d6', type: 'fire' },
          effect: 'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw. A creature takes 3d6 fire damage on a failed save, or half as much damage on a successful one. The fire ignites any flammable objects in the area that aren’t being worn or carried.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st. Spell Lists: Sorcerer, Wizard. Source: Player\'s Handbook.'
        },
        {
          name: 'Flaming Sphere',
          level: 2,
          school: 'Conjuration',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V,S,M (a bit of tallow, a pinch of brimstone, and a dusting of powdered iron)',
          duration: 'Concentration, up to 1 minute',
          save: 'Dexterity',
          damage: { roll: '2d6', type: 'fire' },
          effect: 'A 5-foot-diameter sphere of fire appears in an unoccupied space of your choice within range and lasts for the duration. Any creature that ends its turn within 5 feet of the sphere must make a Dexterity saving throw, taking 2d6 fire damage on a failed save, or half as much on a success. As a bonus action, you can move the sphere up to 30 feet. If you ram the sphere into a creature, it must make the saving throw against the sphere’s damage, and the sphere stops moving this turn. You can move it over barriers up to 5 feet tall and jump it across pits up to 10 feet wide. The sphere ignites flammable objects not being worn or carried and sheds bright light in a 20-foot radius and dim light for an additional 20 feet.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d6 for each slot level above 2nd. Spell Lists: Druid, Sorcerer (Optional), Wizard. Source: Player\'s Handbook.'
        },
        {
          name: 'Scorching Ray',
          level: 2,
          school: 'Evocation',
          castingTime: '1 action',
          range: '120 feet',
          components: 'V,S',
          duration: 'Instantaneous',
          hit: 'Make a ranged spell attack for each ray.',
          damage: { roll: '2d6', type: 'fire', notes: 'per ray' },
          effect: 'You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several. On a hit, the target takes 2d6 fire damage.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 3rd level or higher, you create one additional ray for each slot level above 2nd. Spell Lists: Sorcerer, Wizard. Source: Player\'s Handbook.'
        },
        {
          name: 'Fireball',
          level: 3,
          school: 'Evocation',
          castingTime: '1 action',
          range: '150 feet',
          components: 'V,S,M (a tiny ball of bat guano and sulfur)',
          duration: 'Instantaneous',
          save: 'Dexterity',
          damage: { roll: '8d6', type: 'fire' },
          effect: 'A bright streak flashes from your pointing finger to a point you choose within range then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot radius must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one. The fire spreads around corners and ignites flammable objects in the area that aren’t being worn or carried.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd. Spell Lists: Sorcerer, Wizard. Source: Player\'s Handbook.'
        },
        {
          name: 'Wall of Fire',
          level: 4,
          school: 'Evocation',
          castingTime: '1 action',
          range: '120 feet',
          components: 'V,S,M (a small piece of phosphorus)',
          duration: 'Concentration, up to 1 minute',
          save: 'Dexterity',
          damage: { roll: '5d8', type: 'fire' },
          effect: 'You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick. The wall is opaque and lasts for the duration. When the wall appears, each creature within its area must make a Dexterity saving throw, taking 5d8 fire damage on a failed save, or half as much on a success. One side of the wall, selected by you when you cast this spell, deals 5d8 fire damage to each creature that ends its turn within 10 feet of that side or inside the wall. A creature takes the same damage when it enters the wall for the first time on a turn or ends its turn there. The other side of the wall deals no damage.',
          notes: 'At Higher Levels: When you cast this spell using a spell slot of 5th level or higher, the damage increases by 1d8 for each slot level above 4th. Spell Lists: Druid, Sorcerer, Wizard. Source: Player\'s Handbook.'
        },
        {
          name: 'Immolation',
          level: 5,
          school: 'Evocation',
          castingTime: '1 action',
          range: '90 feet',
          components: 'V',
          duration: 'Concentration, up to 1 minute',
          save: 'Dexterity',
          damage: { roll: '8d6', type: 'fire', notes: 'initial' },
          damage2: { label: 'Ongoing', roll: '4d6', type: 'fire', notes: 'at end of each of its turns on failed save; spell ends on a success' },
          effect: 'Flames wreathe one creature you can see within range. The target must make a Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a success. On a failed save, the target also burns for the spell’s duration, shedding bright light in a 30-foot radius and dim light for an additional 30 feet. At the end of each of its turns, the target repeats the saving throw; it takes 4d6 fire damage on a failed save, and the spell ends on a successful one. These magical flames can’t be extinguished by nonmagical means. If damage from this spell kills a target, the target is turned to ash.',
          notes: 'Spell Lists: Sorcerer, Wizard. Source: Xanathar\'s Guide to Everything.'
        }
      ]);
    }
  }

  function onUninstall(targetChar){
    if (!targetChar) return;
    var charId = targetChar.id || (typeof targetChar.get === 'function' && targetChar.get('_id'));
    if (!charId) return;
    ensureAttrValue(charId, OVERHEAT_FLAG, 0);
  }

  // --- Registration ----------------------------------------------------------

  var _registered = false;
  function registerKit(){
    if (_registered) return true;
    if (typeof AncestorKits === 'undefined' || !AncestorKits || typeof AncestorKits.register !== 'function'){
      return false;
    }

    AncestorKits.register(KIT_KEY, {
      ancestor: KIT_NAME,
      prefix: KIT_KEY,
      sourceCharName: SRC_NAME,
      sourceCharacterName: SRC_NAME,
      abilities: [
        {name:'Emberwright’s Staff (Attack)',     action: actionStaffAttack(),       tokenAction:true},

        {name:'Stoke +25 (Hit/Leveled)',          action: actionHeatAdd(25),         tokenAction:true},
        {name:'Stoke +10 (Cantrip)',              action: actionHeatAdd(10),         tokenAction:true},
        {name:'Heat: Show',                        action: actionHeatShow(),          tokenAction:false},

        {name:'Vent (Bonus • 1/turn)',            action: actionVent(),              tokenAction:true},

        {name:'Overheat — Details',                action: actionOverheatDetails(),   tokenAction:false},
        {name:'Overheat: Staff +2d8 Fire',         action: actionOverheatStaffFire(), tokenAction:false},
        {name:'Overheat: Spell +1d8 Fire',         action: actionOverheatSpellFire(), tokenAction:false},
        {name:'Overheat — Clear (Start Turn)',     action: actionOverheatClear(),     tokenAction:false}
      ],
      onInstall: onInstall,
      onUninstall: onUninstall
    });

    _registered = true;
    return true;
  }

  if (!registerKit() && typeof on === 'function'){
    on('ready', function(){
      if (!registerKit()){
        warn('Seraphine kit failed to register – AncestorKits.register unavailable.');
      }
    });
  }

})();
