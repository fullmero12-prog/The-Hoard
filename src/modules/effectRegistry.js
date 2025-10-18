// ------------------------------------------------------------
// Effect Registry
// ------------------------------------------------------------
// What this does (in simple terms):
//   Centralizes Hoard Run effect definitions so other modules can
//   look up token actions, attribute patches, and notes when a
//   player gains a boon or relic. The data is stored in a simple
//   object and exposed through helper functions so the rest of the
//   system can fetch immutable copies without duplicating data.
// ------------------------------------------------------------

var EffectRegistry = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('EffectRegistry', message);
    } else {
      log('[Hoard Run] [EffectRegistry] ℹ️ ' + message);
    }
  }

  function clone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  var effects = {};

  function buildAbilityTemplate(header, fields) {
    var template = '&{template:default} {{name=' + header + '}}';
    var parts = fields || [];
    for (var i = 0; i < parts.length; i++) {
      var field = parts[i];
      if (!field || !field.label) {
        continue;
      }
      var value = typeof field.value === 'undefined' ? '' : field.value;
      template += ' {{' + field.label + '=' + value + '}}';
    }
    return template;
  }

  function createAbilityPatch(name, header, fields, options) {
    var opts = options || {};
    return {
      type: 'ability',
      name: name,
      token: opts.hasOwnProperty('token') ? !!opts.token : true,
      action: buildAbilityTemplate(header || name, fields),
      macro: opts.macro === true
    };
  }

  function createNotePatch(text) {
    return { type: 'note', text: text };
  }

  function createAttrPatch(name, value, op) {
    return { type: 'attr', name: name, value: value, op: op || 'set' };
  }

  function createResourcePatch(label, max, cadence) {
    return {
      type: 'adapter',
      op: 'add_resource_counter',
      name: label,
      max: max,
      cadence: cadence || 'per_room'
    };
  }

  function buildRelicEffect(id, config) {
    if (!config) {
      return null;
    }

    var rarity = config.rarity || 'Common';
    var category = config.category || 'Relic';
    var displayName = config.displayName || (config.name + ' (' + rarity + ')');
    var abilityName = config.abilityName || ('[Relic] ' + displayName);
    var source = config.source || ('Relic — ' + category + ' (' + rarity + ')');

    var patches = [];

    if (config.resource) {
      patches.push(createResourcePatch(
        config.resource.name,
        config.resource.max,
        config.resource.cadence
      ));
    }

    if (config.attrs && config.attrs.length) {
      for (var a = 0; a < config.attrs.length; a++) {
        var attr = config.attrs[a];
        if (attr && attr.name) {
          patches.push(createAttrPatch(attr.name, attr.value, attr.op));
        }
      }
    }

    if (config.adapters && config.adapters.length) {
      for (var ad = 0; ad < config.adapters.length; ad++) {
        var adapterPatch = config.adapters[ad];
        if (adapterPatch) {
          patches.push(adapterPatch);
        }
      }
    }

    var shouldCreateMacro = config.hasOwnProperty('macro') ? !!config.macro : true;

    if (config.fields && config.fields.length) {
      patches.push(createAbilityPatch(
        abilityName,
        displayName,
        config.fields,
        { token: config.tokenAction !== false, macro: shouldCreateMacro }
      ));
    }

    if (config.extraAbilities && config.extraAbilities.length) {
      for (var e = 0; e < config.extraAbilities.length; e++) {
        var ability = config.extraAbilities[e];
        if (ability) {
          if (!Object.prototype.hasOwnProperty.call(ability, 'macro')) {
            ability.macro = shouldCreateMacro;
          }
          patches.push(ability);
        }
      }
    }

    if (config.note) {
      patches.push(createNotePatch(config.note));
    }

    return {
      id: id,
      name: displayName,
      source: source,
      rarity: rarity,
      category: category,
      patches: patches
    };
  }

  function registerEffect(def) {
    if (!def || !def.id) {
      return;
    }

    var key = String(def.id).toLowerCase();
    effects[key] = clone(def);
    effects[key].key = key;
  }

  function get(id) {
    var key = String(id || '').toLowerCase();
    return effects[key] ? clone(effects[key]) : null;
  }

  function list() {
    var output = [];
    for (var key in effects) {
      if (effects.hasOwnProperty(key)) {
        output.push(clone(effects[key]));
      }
    }
    return output;
  }

  // ------------------------------------------------------------
  // Effect Definitions
  // ------------------------------------------------------------
  var initialEffects = {
    // Metadata helpers:
    //   - meta.syncStats: Array of hr_* attributes to mirror from core sheet values before
    //     any ancestor ability buttons fire. Keeps macros portable across ancestors without
    //     editing EffectEngine when more kits need the same primitives.
    // === VLADREN — The Crimson Tide (Boons) ===
    // IDs match your deck data so BoonManager can apply by picked.id

    'vladren_thickened_vitae': {
      id: 'vladren_thickened_vitae',
      name: 'Thickened Vitae',
      source: 'Vladren Moroi (Common)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // False life 1/room w/o slot, +PB temp HP; +10 ft speed while you have temp HP
        { type: 'attr', name: 'hr_false_life_free_per_room', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_false_life_pb_bonus', op: 'set', value: '@{hr_pb}' }, // store as marker (informational)
        { type: 'attr', name: 'hr_speed_bonus_when_thp', op: 'set', value: 10 },
        { type: 'ability', name: '[Vladren] Thickened Vitae (Info)', token: true, macro: true,
          action: '&{template:default} {{name=Thickened Vitae}} {{False Life=1/room without slot; add **+@{selected|hr_pb}** temp HP}} {{Pact Cap=Your Pact temp HP cap is [[ 5*@{selected|hr_pb} + @{selected|hr_spellmod} ]]}} {{Speed=While you have temp HP, gain **+10 ft** speed}}' },
        { type: 'note', text: 'False Life 1/room w/o slot; add +PB temp HP. +10 ft speed while you have temp HP.' }
      ]
    },

    'vladren_crimson_drip': {
      id: 'vladren_crimson_drip',
      name: 'Crimson Drip',
      source: 'Vladren Moroi (Common)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // Transfusion +1d8 necrotic; on a kill, refresh Transfusion
        { type: 'attr', name: 'hr_transfusion_bonus_die', op: 'set', value: '1d8' },
        { type: 'attr', name: 'hr_transfusion_refresh_on_kill', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Transfusion (Bonus)', token: true, macro: true,
          action: '&{template:default} {{name=Transfusion (Bonus; 60 ft; Con save)}} {{Save DC=[[ @{selected|spell_save_dc} ]]}} {{Damage=[[ 2d8 + @{selected|hr_pb} + 1d8 ]] necrotic (half on success)}} {{Bloodied bonus=If target ≤ 1/2 HP, add [[ 1d8 ]] necrotic (stacks with this boon)}} {{Refresh=On a kill, refresh Transfusion; use it again this turn.}} {{Heal yourself=Equal to total necrotic dealt}}' },
        { type: 'ability', name: '[Vladren] Crimson Drip (Info)', token: true, macro: true,
          action: '&{template:default} {{name=Crimson Drip}} {{Transfusion=Deals **+1d8 necrotic**; on a kill, Transfusion is refreshed and can be used again this turn}}' },
        { type: 'note', text: 'Transfusion +1d8 necrotic; refresh on kill (extra use this turn).' }
      ]
    },

    'vladren_tides_of_blood': {
      id: 'vladren_tides_of_blood',
      name: 'Tides of Blood',
      source: 'Vladren Moroi (Greater)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // Action 1/turn: 15-ft radius surge; Con save → 4d6+PB necrotic (half on success)
        // You may lose up to PBd6 HP to add that much necrotic; heal half total dealt.
        { type: 'ability', name: '[Vladren] Tides of Blood (Action)', token: true, macro: true,
          action: '&{template:default} {{name=Tides of Blood (Action, 1/turn)}} {{Area=15-ft radius centered on you}} {{Save=Con save (DC [[ 8 + @{selected|hr_pb} + @{selected|hr_spellmod} ]])}} {{Damage=[[ 4d6 + @{selected|hr_pb} ]] necrotic (half on success)}} {{Empower=You may lose up to **@{selected|hr_pb}d6 HP** to add that much necrotic}} {{Heal=You heal **half** the total necrotic dealt}}' },
        { type: 'note', text: 'Action (1/turn). 15-ft surge; Con save. 4d6+PB necrotic; may lose up to PBd6 HP to add; heal half total dealt.' }
      ]
    },

    'vladren_sovereign_pool': {
      id: 'vladren_sovereign_pool',
      name: 'Sovereign Pool',
      source: 'Vladren Moroi (Greater)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // Sanguine Pool gains +15 ft move on enter; recharges on 5–6 if THP >=10
        { type: 'attr', name: 'hr_pool_bonus_move_on_enter', op: 'set', value: 15 },
        { type: 'attr', name: 'hr_pool_recharge_5_6_if_thp10', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Sanguine Pool (Reaction • 1/room)', token: true, macro: true,
          action: '&{template:default} {{name=Sanguine Pool (Reaction • 1/room)}} {{Effect=Until the start of your next turn you are blood mist: resistance to all damage; move through creatures; cannot cast leveled spells or make attacks; enemies cannot make OAs against you.}} {{On enter=When you enter the Pool, gain **+15 ft** movement.}} {{Recharge=At the start of your turn, recharge on a **5–6** while you have **≥10 temp HP**.}}' },
        { type: 'ability', name: '[Vladren] Sovereign Pool (Info)', token: false,
          action: '&{template:default} {{name=Sovereign Pool}} {{Move=When you enter, gain **+15 ft** movement}} {{Recharge=At start of your turn, **recharges on 5–6** while you have **≥10 temp HP**}}' },
        { type: 'note', text: 'Pool: +15 ft move on enter; recharge on 5–6 while you have ≥10 temp HP.' }
      ]
    },

    'vladren_crimson_apotheosis': {
      id: 'vladren_crimson_apotheosis',
      name: 'Crimson Apotheosis',
      source: 'Vladren Moroi (Signature, 1/room)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // 2 rounds: temp HP cap doubles; resistance to all; Transfusion twice/turn
        { type: 'attr', name: 'hr_pact_cap_multiplier', op: 'set', value: 2 },
        { type: 'attr', name: 'hr_resistance_all_active', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_transfusion_per_turn', op: 'set', value: 2 },
        { type: 'ability', name: '[Vladren] Crimson Apotheosis (1/room)', token: true, macro: true,
          action: '&{template:default} {{name=Crimson Apotheosis (1/room)}} {{Duration=2 rounds}} {{Pact=Temp HP cap becomes [[ 2*(5*@{selected|hr_pb} + @{selected|hr_spellmod}) ]]}} {{Defense=**Resistance to all damage**}} {{Transfusion=Use **twice each turn** (still one Bonus Action each)}}' },
        { type: 'note', text: 'Apotheosis (1/room): 2 rounds. THP cap ×2; resistance to all; Transfusion ×2/turn.' }
      ]
    },

    'vladren_hemarchs_decree': {
      id: 'vladren_hemarchs_decree',
      name: 'Hemarch\u2019s Decree',
      source: 'Vladren Moroi (Signature)',
      meta: { syncStats: ['hr_pb', 'hr_spellmod'] },
      patches: [
        // Hemoplague upgrades: vuln to necrotic; +2d6 necrotic; +1 DC & advantage vs Plagued
        { type: 'attr', name: 'hr_hemo_plague_vuln_necrotic', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_hemo_plague_bonus_damage', op: 'set', value: '2d6' },
        { type: 'attr', name: 'hr_necrotic_dc_bonus', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_adv_vs_plagued', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Hemoplague (1/room)', token: true, macro: true,
          action: '&{template:default} {{name=Hemoplague (1/room; 20-ft; 60 ft; Con save)}} {{Plagued=Target is <b>Plagued</b> until end of its next turn (takes <b>+@{selected|hr_pb}</b> damage from all sources) and is <b>vulnerable to necrotic</b> until the burst resolves.}} {{Burst=Then take [[ 6d6 + 2d6 ]] necrotic (success [[ 3d6 + 2d6 ]] necrotic).}} {{Dominance=While a creature is Plagued, you have advantage on attacks and +1 to spell save DC against it.}} {{Heal yourself=Equal to necrotic dealt; excess becomes Pact temp HP.}}' },
        { type: 'ability', name: '[Vladren] Hemarch\u2019s Decree (Info)', token: true, macro: true,
          action: '&{template:default} {{name=Hemarch’s Decree}} {{Hemoplague=Targets are **vulnerable to necrotic** until the burst}} {{Burst=Burst deals **+2d6 necrotic**}} {{Targeting=You have **advantage** on attacks and **+1** to spell save DC vs **Plagued** creatures}}' },
        { type: 'note', text: 'Hemoplague: necrotic vuln; burst +2d6 necrotic; +1 DC & advantage vs Plagued.' }
      ]
    }
  };

  // === RELICS ===
  var relicConfigs = {
    'relic_quickcast_signet_C': {
      name: 'Quickcast Signet',
      displayName: 'Quickcast Signet (Common)',
      rarity: 'Common',
      category: 'Tempo',
      resource: { name: 'Relic Quickcast Signet C', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Cast a cantrip you know as a bonus action.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_quickcast_signet_c_cur}/@{selected|hr_res_relic_quickcast_signet_c_max} per room.' },
        { label: 'Recharge', value: 'Resets when a new room begins.' }
      ],
      note: 'Quickcast Signet (Common): 1/room bonus action to cast a cantrip.'
    },
    'relic_quickcast_signet_G': {
      name: 'Quickcast Signet',
      displayName: 'Quickcast Signet (Greater)',
      rarity: 'Greater',
      category: 'Tempo',
      resource: { name: 'Relic Quickcast Signet G', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Cast a 1st–3rd-level spell you know as a bonus action.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_quickcast_signet_g_cur}/@{selected|hr_res_relic_quickcast_signet_g_max} per room.' },
        { label: 'Reminder', value: 'Spell slot and concentration rules still apply.' }
      ],
      note: 'Quickcast Signet (Greater): 1/room bonus action to cast a 1st–3rd-level spell.'
    },
    'relic_quickcast_signet_S': {
      name: 'Quickcast Signet',
      displayName: 'Quickcast Signet (Signature)',
      rarity: 'Signature',
      category: 'Tempo',
      resource: { name: 'Relic Quickcast Signet S', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Cast any spell you know as a bonus action.' },
        { label: 'Rule', value: 'Ignore the no-second-leveled-spell rule for that turn.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_quickcast_signet_s_cur}/@{selected|hr_res_relic_quickcast_signet_s_max} per room.' }
      ],
      note: 'Quickcast Signet (Signature): 1/room bonus action to cast any spell; ignore the second leveled spell restriction.'
    },
    'relic_surge_anklet_C': {
      name: 'Surge Anklet',
      displayName: 'Surge Anklet (Common)',
      rarity: 'Common',
      category: 'Tempo',
      resource: { name: 'Relic Surge Anklet C', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Make one weapon attack.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_surge_anklet_c_cur}/@{selected|hr_res_relic_surge_anklet_c_max} per room.' },
        { label: 'Reminder', value: 'Use your normal attack modifiers.' }
      ],
      note: 'Surge Anklet (Common): 1/room bonus action to make one weapon attack.'
    },
    'relic_surge_anklet_G': {
      name: 'Surge Anklet',
      displayName: 'Surge Anklet (Greater)',
      rarity: 'Greater',
      category: 'Tempo',
      resource: { name: 'Relic Surge Anklet G', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Make two weapon attacks.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_surge_anklet_g_cur}/@{selected|hr_res_relic_surge_anklet_g_max} per room.' },
        { label: 'Reminder', value: 'Attacks follow your normal rules and modifiers.' }
      ],
      note: 'Surge Anklet (Greater): 1/room bonus action to make two weapon attacks.'
    },
    'relic_surge_anklet_S': {
      name: 'Surge Anklet',
      displayName: 'Surge Anklet (Signature)',
      rarity: 'Signature',
      category: 'Tempo',
      resource: { name: 'Relic Surge Anklet S', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Gain haste (no concentration) until your next turn.' },
        { label: 'Benefits', value: '+2 AC, advantage on Dex saves, speed ×2, one extra limited action.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_surge_anklet_s_cur}/@{selected|hr_res_relic_surge_anklet_s_max} per room.' }
      ],
      note: 'Surge Anklet (Signature): 1/room bonus action to gain haste (+2 AC, adv. Dex saves, speed ×2, extra action until your next turn).' 
    },
    'relic_reserve_snap_C': {
      name: 'Reserve Snap',
      displayName: 'Reserve Snap (Common)',
      rarity: 'Common',
      category: 'Tempo',
      resource: { name: 'Relic Reserve Snap C', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Teleport 10 ft and immediately Disengage.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_reserve_snap_c_cur}/@{selected|hr_res_relic_reserve_snap_c_max} per room.' },
        { label: 'Movement', value: 'Choose the teleport direction before moving.' }
      ],
      note: 'Reserve Snap (Common): 1/room bonus action teleport 10 ft and Disengage.'
    },
    'relic_reserve_snap_G': {
      name: 'Reserve Snap',
      displayName: 'Reserve Snap (Greater)',
      rarity: 'Greater',
      category: 'Tempo',
      resource: { name: 'Relic Reserve Snap G', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Teleport 20 ft; attacks of opportunity against you fail until your turn ends.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_reserve_snap_g_cur}/@{selected|hr_res_relic_reserve_snap_g_max} per room.' },
        { label: 'Position', value: 'Teleport before resolving further movement.' }
      ],
      note: 'Reserve Snap (Greater): 1/room teleport 20 ft as a bonus action; you avoid opportunity attacks until your turn ends.'
    },
    'relic_reserve_snap_S': {
      name: 'Reserve Snap',
      displayName: 'Reserve Snap (Signature)',
      rarity: 'Signature',
      category: 'Tempo',
      resource: { name: 'Relic Reserve Snap S', max: 1 },
      fields: [
        { label: 'Use', value: 'Bonus action or reaction to teleport 30 ft.' },
        { label: 'Defense', value: 'Triggering attack/save automatically misses or fails; avoid opportunity attacks until your next turn starts.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_reserve_snap_s_cur}/@{selected|hr_res_relic_reserve_snap_s_max} per room.' }
      ],
      note: 'Reserve Snap (Signature): 1/room BA or reaction teleport 30 ft; trigger auto-misses/fails and avoid opportunity attacks until your next turn.'
    },
    'relic_second_wind_flask_C': {
      name: 'Second Wind Flask',
      displayName: 'Second Wind Flask (Common)',
      rarity: 'Common',
      category: 'Defense',
      resource: { name: 'Relic Second Wind Flask C', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Heal [[ 2d8 + @{selected|pb} ]] HP.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_second_wind_flask_c_cur}/@{selected|hr_res_relic_second_wind_flask_c_max} per room.' },
        { label: 'Reminder', value: 'Use after rolling damage for best timing.' }
      ],
      note: 'Second Wind Flask (Common): 1/room bonus action heal 2d8 + PB.'
    },
    'relic_second_wind_flask_G': {
      name: 'Second Wind Flask',
      displayName: 'Second Wind Flask (Greater)',
      rarity: 'Greater',
      category: 'Defense',
      resource: { name: 'Relic Second Wind Flask G', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Heal [[ 4d8 + @{selected|pb} ]] HP.' },
        { label: 'Temp HP', value: 'Gain @{selected|pb} temp HP after healing.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_second_wind_flask_g_cur}/@{selected|hr_res_relic_second_wind_flask_g_max} per room.' }
      ],
      note: 'Second Wind Flask (Greater): 1/room bonus action heal 4d8 + PB and gain temp HP equal to PB.'
    },
    'relic_second_wind_flask_S': {
      name: 'Second Wind Flask',
      displayName: 'Second Wind Flask (Signature)',
      rarity: 'Signature',
      category: 'Defense',
      resource: { name: 'Relic Second Wind Flask S', max: 1 },
      fields: [
        { label: 'Bonus Action', value: 'Heal [[ 5d8 + @{selected|pb} ]] HP.' },
        { label: 'Temp HP', value: 'Gain @{selected|pb} + @{selected|spell_mod} temp HP.' },
        { label: 'Cleanse', value: 'End one: blinded, charmed, deafened, frightened, paralyzed, poisoned, or stunned.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_second_wind_flask_s_cur}/@{selected|hr_res_relic_second_wind_flask_s_max} per room.' }
      ],
      note: 'Second Wind Flask (Signature): 1/room bonus action heal 5d8 + PB, gain temp HP equal PB + spell mod, and cleanse one listed condition.'
    },
    'relic_phoenix_bead_C': {
      name: 'Phoenix Bead',
      displayName: 'Phoenix Bead (Common)',
      rarity: 'Common',
      category: 'Defense',
      resource: { name: 'Relic Phoenix Bead C', max: 1 },
      fields: [
        { label: 'Trigger', value: 'When you would drop to 0 HP, drop to 1 HP instead.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_phoenix_bead_c_cur}/@{selected|hr_res_relic_phoenix_bead_c_max} per room.' },
        { label: 'Reminder', value: 'Declare after damage is resolved.' }
      ],
      note: 'Phoenix Bead (Common): 1/room, when reduced to 0 HP, stay at 1 HP instead.'
    },
    'relic_phoenix_bead_G': {
      name: 'Phoenix Bead',
      displayName: 'Phoenix Bead (Greater)',
      rarity: 'Greater',
      category: 'Defense',
      resource: { name: 'Relic Phoenix Bead G', max: 1 },
      fields: [
        { label: 'Trigger', value: 'When you would drop to 0 HP, stay at 1 HP instead.' },
        { label: 'Aftermath', value: 'Gain temp HP equal to @{selected|pb} + @{selected|spell_mod} and stand up without movement.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_phoenix_bead_g_cur}/@{selected|hr_res_relic_phoenix_bead_g_max} per room.' }
      ],
      note: 'Phoenix Bead (Greater): 1/room avoid 0 HP, gain temp HP equal PB + spell mod, and stand up for free.'
    },
    'relic_phoenix_bead_S': {
      name: 'Phoenix Bead',
      displayName: 'Phoenix Bead (Signature)',
      rarity: 'Signature',
      category: 'Defense',
      resource: { name: 'Relic Phoenix Bead S', max: 1 },
      fields: [
        { label: 'Trigger', value: 'When you would drop to 0 HP, instead set HP to @{selected|pb} + @{selected|spell_mod}.' },
        { label: 'Cleanse', value: 'End all conditions on you.' },
        { label: 'Movement', value: 'Move up to your speed without provoking opportunity attacks.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_phoenix_bead_s_cur}/@{selected|hr_res_relic_phoenix_bead_s_max} per room.' }
      ],
      note: 'Phoenix Bead (Signature): 1/room instead of 0 HP, clear all conditions, set HP to PB + spell mod, and move your speed without provoking.'
    },
    'relic_guardians_band_C': {
      name: 'Guardian\'s Band',
      displayName: 'Guardian\'s Band (Common)',
      rarity: 'Common',
      category: 'Defense',
      fields: [
        { label: 'Passive', value: 'Gain a +1 bonus to AC while worn.' },
        { label: 'Reminder', value: 'Stacks with shields, armor, and other bonuses unless noted.' }
      ],
      note: 'Guardian\'s Band (Common): Passive +1 bonus to AC.'
    },
    'relic_counterglyph_C': {
      name: 'Counterglyph',
      displayName: 'Counterglyph (Common)',
      rarity: 'Common',
      category: 'Defense',
      resource: { name: 'Relic Counterglyph C', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Gain +2 AC and advantage on one save until your next turn.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_counterglyph_c_cur}/@{selected|hr_res_relic_counterglyph_c_max} per room.' },
        { label: 'Timing', value: 'Use after seeing the attack or save trigger.' }
      ],
      note: 'Counterglyph (Common): 1/room reaction for +2 AC and advantage on one save until your next turn.'
    },
    'relic_counterglyph_G': {
      name: 'Counterglyph',
      displayName: 'Counterglyph (Greater)',
      rarity: 'Greater',
      category: 'Defense',
      resource: { name: 'Relic Counterglyph G', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Gain +5 AC against one attack and Evasion on your next Dex save.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_counterglyph_g_cur}/@{selected|hr_res_relic_counterglyph_g_max} per room.' },
        { label: 'Reminder', value: 'Evasion: half damage on fail, none on success.' }
      ],
      note: 'Counterglyph (Greater): 1/room reaction for +5 AC vs one attack and Evasion on your next Dex save.'
    },
    'relic_counterglyph_S': {
      name: 'Counterglyph',
      displayName: 'Counterglyph (Signature)',
      rarity: 'Signature',
      category: 'Defense',
      resource: { name: 'Relic Counterglyph S', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Negate one attack or single-target spell entirely.' },
        { label: 'Aftermath', value: 'Gain +2 AC until your next turn.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_counterglyph_s_cur}/@{selected|hr_res_relic_counterglyph_s_max} per room.' }
      ],
      note: 'Counterglyph (Signature): 1/room reaction to negate one attack/spell and gain +2 AC until your next turn.'
    },
    'relic_escapists_step_C': {
      name: 'Escapist\'s Step',
      displayName: 'Escapist\'s Step (Common)',
      rarity: 'Common',
      category: 'Control',
      resource: { name: 'Relic Escapists Step C', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Before an attack resolves, teleport 10 ft; the attack misses.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_escapists_step_c_cur}/@{selected|hr_res_relic_escapists_step_c_max} per room.' },
        { label: 'Reminder', value: 'Teleport must be to an unoccupied space you can see.' }
      ],
      note: 'Escapist\'s Step (Common): 1/room reaction teleport 10 ft before an attack; the attack misses.'
    },
    'relic_escapists_step_G': {
      name: 'Escapist\'s Step',
      displayName: 'Escapist\'s Step (Greater)',
      rarity: 'Greater',
      category: 'Control',
      resource: { name: 'Relic Escapists Step G', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Teleport 20 ft; the triggering attack misses.' },
        { label: 'Stealth', value: 'End behind cover to remain hidden from that attacker until you move or act.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_escapists_step_g_cur}/@{selected|hr_res_relic_escapists_step_g_max} per room.' }
      ],
      note: 'Escapist\'s Step (Greater): 1/room reaction teleport 20 ft, attack misses, and you can stay hidden behind cover.'
    },
    'relic_escapists_step_S': {
      name: 'Escapist\'s Step',
      displayName: 'Escapist\'s Step (Signature)',
      rarity: 'Signature',
      category: 'Control',
      resource: { name: 'Relic Escapists Step S', max: 1 },
      fields: [
        { label: 'Reaction', value: 'Teleport 30 ft; the attack misses.' },
        { label: 'Invisibility', value: 'Become invisible until your next turn, then move 10 ft without provoking.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_escapists_step_s_cur}/@{selected|hr_res_relic_escapists_step_s_max} per room.' }
      ],
      note: 'Escapist\'s Step (Signature): 1/room reaction teleport 30 ft, become invisible until next turn, then move 10 ft without provoking.'
    },
    'relic_gravitas_seal_C': {
      name: 'Gravitas Seal',
      displayName: 'Gravitas Seal (Common)',
      rarity: 'Common',
      category: 'Control',
      resource: { name: 'Relic Gravitas Seal C', max: 1 },
      fields: [
        { label: 'Use', value: 'Mark one creature; its first save against your next spell is at disadvantage.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_gravitas_seal_c_cur}/@{selected|hr_res_relic_gravitas_seal_c_max} per room.' },
        { label: 'Reminder', value: 'Declare before casting the spell.' }
      ],
      note: 'Gravitas Seal (Common): 1/room impose disadvantage on one creature\'s first save against your next spell.'
    },
    'relic_gravitas_seal_G': {
      name: 'Gravitas Seal',
      displayName: 'Gravitas Seal (Greater)',
      rarity: 'Greater',
      category: 'Control',
      resource: { name: 'Relic Gravitas Seal G', max: 1 },
      fields: [
        { label: 'Use', value: 'Up to two creatures make their first save vs your next spell at disadvantage.' },
        { label: 'DC Boost', value: 'Your next spell gains +1 to its save DC.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_gravitas_seal_g_cur}/@{selected|hr_res_relic_gravitas_seal_g_max} per room.' }
      ],
      note: 'Gravitas Seal (Greater): 1/room two targets have disadvantage on the first save vs your next spell; spell gains +1 DC.'
    },
    'relic_gravitas_seal_S': {
      name: 'Gravitas Seal',
      displayName: 'Gravitas Seal (Signature)',
      rarity: 'Signature',
      category: 'Control',
      resource: { name: 'Relic Gravitas Seal S', max: 1 },
      fields: [
        { label: 'Use', value: 'Choose one creature: it automatically fails the first save against your next spell.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_gravitas_seal_s_cur}/@{selected|hr_res_relic_gravitas_seal_s_max} per room.' },
        { label: 'Reminder', value: 'Declare before you cast the spell.' }
      ],
      note: 'Gravitas Seal (Signature): 1/room force a creature to automatically fail the first save vs your next spell.'
    },
    'relic_encore_coin_C': {
      name: 'Encore Coin',
      displayName: 'Encore Coin (Common)',
      rarity: 'Common',
      category: 'Reroll',
      resource: { name: 'Relic Encore Coin C', max: 1 },
      fields: [
        { label: 'Use', value: 'Reroll one attack roll, save, or ability check you make.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_encore_coin_c_cur}/@{selected|hr_res_relic_encore_coin_c_max} per room.' },
        { label: 'Reminder', value: 'Keep either result after the reroll.' }
      ],
      note: 'Encore Coin (Common): 1/room reroll one of your d20 tests.'
    },
    'relic_encore_coin_G': {
      name: 'Encore Coin',
      displayName: 'Encore Coin (Greater)',
      rarity: 'Greater',
      category: 'Reroll',
      resource: { name: 'Relic Encore Coin G', max: 1 },
      fields: [
        { label: 'Self', value: 'Reroll one of your d20s.' },
        { label: 'Control', value: 'Or force an enemy within 60 ft to reroll one attack against you or an ally.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_encore_coin_g_cur}/@{selected|hr_res_relic_encore_coin_g_max} per room.' }
      ],
      note: 'Encore Coin (Greater): 1/room reroll your d20 or force an enemy reroll within 60 ft.'
    },
    'relic_encore_coin_S': {
      name: 'Encore Coin',
      displayName: 'Encore Coin (Signature)',
      rarity: 'Signature',
      category: 'Reroll',
      resource: { name: 'Relic Encore Coin S', max: 1 },
      fields: [
        { label: 'Self', value: 'Turn one of your d20s into a 20 (declare before the roll).' },
        { label: 'Control', value: 'Or force an enemy\'s d20 into a 1 (declare before the roll).' },
        { label: 'Uses', value: '@{selected|hr_res_relic_encore_coin_s_cur}/@{selected|hr_res_relic_encore_coin_s_max} per room.' }
      ],
      note: 'Encore Coin (Signature): 1/room set your d20 to 20 or an enemy\'s to 1 (declare before rolling).'
    },
    'relic_curators_token_C': {
      name: 'Curator\'s Token',
      displayName: 'Curator\'s Token (Common)',
      rarity: 'Common',
      category: 'Reroll',
      attrs: [
        { name: 'hr_relic_curators_token_free_slot_rerolls', value: 1 }
      ],
      fields: [
        { label: 'Shop Bonus', value: 'Each shop visit grants 1 free slot reroll.' },
        { label: 'Reminder', value: 'Applies to Bing, Bang & Bongo when you open the shop.' }
      ],
      tokenAction: false,
      note: 'Curator\'s Token (Common): Each shop grants one free slot reroll.'
    },
    'relic_curators_token_G': {
      name: 'Curator\'s Token',
      displayName: 'Curator\'s Token (Greater)',
      rarity: 'Greater',
      category: 'Reroll',
      attrs: [
        { name: 'hr_relic_curators_token_free_slot_rerolls', value: 1 },
        { name: 'hr_relic_curators_token_extra_options', value: 1 }
      ],
      fields: [
        { label: 'Shop Bonus', value: 'Each shop visit grants 1 free slot reroll.' },
        { label: 'Selection', value: 'Roll +1 extra option for each stocked slot; choose one to keep.' }
      ],
      tokenAction: false,
      note: 'Curator\'s Token (Greater): Free slot reroll each shop and +1 extra option per slot before you choose.'
    },
    'relic_curators_token_S': {
      name: 'Curator\'s Token',
      displayName: 'Curator\'s Token (Signature)',
      rarity: 'Signature',
      category: 'Reroll',
      attrs: [
        { name: 'hr_relic_curators_token_free_slot_rerolls', value: 1 },
        { name: 'hr_relic_curators_token_free_full_refresh', value: 1 },
        { name: 'hr_relic_curators_token_upgrade_slot', value: 1 }
      ],
      fields: [
        { label: 'Shop Bonus', value: 'Each shop visit grants 1 free full refresh.' },
        { label: 'Upgrade', value: 'Upgrade one stocked item by one rarity step (max Signature).' }
      ],
      tokenAction: false,
      note: 'Curator\'s Token (Signature): Each shop grants one free full refresh and upgrades one stocked item by one rarity step.'
    },
    'relic_storm_dial_C': {
      name: 'Storm Dial',
      displayName: 'Storm Dial (Common)',
      rarity: 'Common',
      category: 'Resource',
      resource: { name: 'Relic Storm Dial C', max: 1 },
      fields: [
        { label: 'Use', value: 'Treat one Recharge ability as if you rolled a 6.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_storm_dial_c_cur}/@{selected|hr_res_relic_storm_dial_c_max} per room.' },
        { label: 'Reminder', value: 'Choose the ability when you spend the Dial.' }
      ],
      note: 'Storm Dial (Common): 1/room treat one Recharge ability as if you rolled a 6.'
    },
    'relic_storm_dial_G': {
      name: 'Storm Dial',
      displayName: 'Storm Dial (Greater)',
      rarity: 'Greater',
      category: 'Resource',
      resource: { name: 'Relic Storm Dial G', max: 1 },
      fields: [
        { label: 'Use', value: 'Refresh up to two different Recharge abilities as if you rolled 6.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_storm_dial_g_cur}/@{selected|hr_res_relic_storm_dial_g_max} per room.' },
        { label: 'Reminder', value: 'Each ability must be different.' }
      ],
      note: 'Storm Dial (Greater): 1/room refresh up to two different Recharge abilities as if you rolled 6.'
    },
    'relic_storm_dial_S': {
      name: 'Storm Dial',
      displayName: 'Storm Dial (Signature)',
      rarity: 'Signature',
      category: 'Resource',
      resource: { name: 'Relic Storm Dial S', max: 1 },
      fields: [
        { label: 'Use', value: 'Refresh all Recharge abilities as if you rolled 6.' },
        { label: 'Short Rest', value: 'Set one short-rest feature of your choice to available.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_storm_dial_s_cur}/@{selected|hr_res_relic_storm_dial_s_max} per room.' }
      ],
      note: 'Storm Dial (Signature): 1/room refresh all Recharge abilities and restore one short-rest feature.'
    },
    'relic_arcane_battery_C': {
      name: 'Arcane Battery',
      displayName: 'Arcane Battery (Common)',
      rarity: 'Common',
      category: 'Resource',
      resource: { name: 'Relic Arcane Battery C', max: 1 },
      fields: [
        { label: 'Use', value: 'Take one additional bonus action on your turn.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_arcane_battery_c_cur}/@{selected|hr_res_relic_arcane_battery_c_max} per room.' },
        { label: 'Reminder', value: 'You still cannot take the same bonus action twice unless allowed.' }
      ],
      note: 'Arcane Battery (Common): 1/room take an extra bonus action on your turn.'
    },
    'relic_arcane_battery_G': {
      name: 'Arcane Battery',
      displayName: 'Arcane Battery (Greater)',
      rarity: 'Greater',
      category: 'Resource',
      resource: { name: 'Relic Arcane Battery G', max: 1 },
      fields: [
        { label: 'Use', value: 'Gain one additional action (Attack—one attack, Dash, Disengage, Use an Object, or cast a cantrip).' },
        { label: 'Uses', value: '@{selected|hr_res_relic_arcane_battery_g_cur}/@{selected|hr_res_relic_arcane_battery_g_max} per room.' },
        { label: 'Reminder', value: 'Declare which option you take when you spend the Battery.' }
      ],
      note: 'Arcane Battery (Greater): 1/room gain an extra action (Attack—one attack, Dash, Disengage, Use an Object, or cast a cantrip).' 
    },
    'relic_arcane_battery_S': {
      name: 'Arcane Battery',
      displayName: 'Arcane Battery (Signature)',
      rarity: 'Signature',
      category: 'Resource',
      resource: { name: 'Relic Arcane Battery S', max: 1 },
      fields: [
        { label: 'Use', value: 'Gain an additional action and bonus action this turn.' },
        { label: 'Spellcasting', value: 'The extra action may cast a 1st–3rd-level spell and ignores the no-second-leveled-spell rule.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_arcane_battery_s_cur}/@{selected|hr_res_relic_arcane_battery_s_max} per room.' }
      ],
      note: 'Arcane Battery (Signature): 1/room gain an extra action and bonus action; extra action may cast a 1st–3rd-level spell ignoring the second leveled spell rule.'
    },
    'relic_midas_marker_C': {
      name: 'Midas Marker',
      displayName: 'Midas Marker (Common)',
      rarity: 'Common',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_midas_marker_room_bonus', value: 5 }
      ],
      fields: [
        { label: 'Room Reward', value: 'Gain +5 Scrip each time you clear a room.' },
        { label: 'Scope', value: 'Applies to standard, miniboss, and boss rooms.' }
      ],
      tokenAction: false,
      note: 'Midas Marker (Common): +5 Scrip on every room clear.'
    },
    'relic_midas_marker_G': {
      name: 'Midas Marker',
      displayName: 'Midas Marker (Greater)',
      rarity: 'Greater',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_midas_marker_room_bonus', value: 10 },
        { name: 'hr_relic_midas_marker_boss_bonus', value: 10 }
      ],
      fields: [
        { label: 'Room Reward', value: 'Gain +10 Scrip each time you clear a room.' },
        { label: 'Boss Rooms', value: 'Gain an additional +10 Scrip on miniboss or boss rooms.' }
      ],
      tokenAction: false,
      note: 'Midas Marker (Greater): +10 Scrip per room and +10 more on miniboss/boss clears.'
    },
    'relic_midas_marker_S': {
      name: 'Midas Marker',
      displayName: 'Midas Marker (Signature)',
      rarity: 'Signature',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_midas_marker_multiplier', value: 2 }
      ],
      fields: [
        { label: 'Room Reward', value: 'Double all Scrip gained from room rewards for the rest of the run.' },
        { label: 'Reminder', value: 'Stacks multiplicatively with other bonuses that modify the base reward.' }
      ],
      tokenAction: false,
      note: 'Midas Marker (Signature): Double all Scrip from room rewards.'
    },
    'relic_hags_chit_C': {
      name: 'Hag\'s Chit',
      displayName: 'Hag\'s Chit (Common)',
      rarity: 'Common',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_hags_chit_discount_percent', value: 10 },
        { name: 'hr_relic_hags_chit_discount_floor', value: 5 }
      ],
      fields: [
        { label: 'Discount', value: 'Shops cost 10% less (minimum 5 Scrip discount).' },
        { label: 'Scope', value: 'Applies to relics, boons, rerolls, and trades.' }
      ],
      tokenAction: false,
      note: 'Hag\'s Chit (Common): 10% shop discount (minimum 5 Scrip).' 
    },
    'relic_hags_chit_G': {
      name: 'Hag\'s Chit',
      displayName: 'Hag\'s Chit (Greater)',
      rarity: 'Greater',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_hags_chit_discount_percent', value: 20 },
        { name: 'hr_relic_hags_chit_discount_floor', value: 10 },
        { name: 'hr_relic_hags_chit_refresh_cost', value: 25 }
      ],
      fields: [
        { label: 'Discount', value: 'Shops cost 20% less (minimum 10 Scrip discount).' },
        { label: 'Refresh', value: 'Vendor full refresh costs 25 Scrip.' }
      ],
      tokenAction: false,
      note: 'Hag\'s Chit (Greater): 20% shop discount (minimum 10) and full refresh costs 25 Scrip.'
    },
    'relic_hags_chit_S': {
      name: 'Hag\'s Chit',
      displayName: 'Hag\'s Chit (Signature)',
      rarity: 'Signature',
      category: 'Economy',
      attrs: [
        { name: 'hr_relic_hags_chit_discount_percent', value: 30 },
        { name: 'hr_relic_hags_chit_discount_floor', value: 10 },
        { name: 'hr_relic_hags_chit_free_slot_reroll', value: 1 },
        { name: 'hr_relic_hags_chit_half_price', value: 1 }
      ],
      fields: [
        { label: 'Discount', value: 'Shops cost 30% less (minimum 10 Scrip discount).' },
        { label: 'Per Visit', value: 'First slot reroll each vendor is free; buy one item per visit at half price.' }
      ],
      tokenAction: false,
      note: 'Hag\'s Chit (Signature): 30% shop discount (minimum 10), first slot reroll free, and one item per visit at half price.'
    },
    'relic_edge_sight_C': {
      name: 'Edge Sight',
      displayName: 'Edge Sight (Common)',
      rarity: 'Common',
      category: 'Momentum',
      resource: { name: 'Relic Edge Sight C', max: 1 },
      fields: [
        { label: 'Use', value: 'Declare Keen—your next weapon attack crits on 19–20.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_edge_sight_c_cur}/@{selected|hr_res_relic_edge_sight_c_max} per room.' },
        { label: 'Reminder', value: 'Declare before rolling the attack.' }
      ],
      note: 'Edge Sight (Common): 1/room declare Keen; next weapon attack crits on 19–20.'
    },
    'relic_edge_sight_G': {
      name: 'Edge Sight',
      displayName: 'Edge Sight (Greater)',
      rarity: 'Greater',
      category: 'Momentum',
      resource: { name: 'Relic Edge Sight G', max: 1 },
      fields: [
        { label: 'Use', value: 'Next weapon attack crits on 18–20 and gains +@{selected|pb} to hit.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_edge_sight_g_cur}/@{selected|hr_res_relic_edge_sight_g_max} per room.' },
        { label: 'Reminder', value: 'Declare before rolling the attack.' }
      ],
      note: 'Edge Sight (Greater): 1/room next weapon attack crits on 18–20 and gains +PB to hit.'
    },
    'relic_edge_sight_S': {
      name: 'Edge Sight',
      displayName: 'Edge Sight (Signature)',
      rarity: 'Signature',
      category: 'Momentum',
      resource: { name: 'Relic Edge Sight S', max: 1 },
      fields: [
        { label: 'Use', value: 'Declare a Perfect Strike—your next weapon attack this turn is an automatic critical on a hit.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_edge_sight_s_cur}/@{selected|hr_res_relic_edge_sight_s_max} per room.' },
        { label: 'Reminder', value: 'Still requires a successful attack roll.' }
      ],
      note: 'Edge Sight (Signature): 1/room declare a Perfect Strike; next weapon attack is an automatic critical on a hit.'
    },
    'relic_spell_keystone_C': {
      name: 'Spell Keystone',
      displayName: 'Spell Keystone (Common)',
      rarity: 'Common',
      category: 'Momentum',
      resource: { name: 'Relic Spell Keystone C', max: 1 },
      fields: [
        { label: 'Option 1', value: 'Your next spell attack has advantage.' },
        { label: 'Option 2', value: 'Or one target takes −2 on its first save versus your next spell.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_spell_keystone_c_cur}/@{selected|hr_res_relic_spell_keystone_c_max} per room.' }
      ],
      note: 'Spell Keystone (Common): 1/room give your next spell attack advantage or impose −2 on one target\'s first save vs your next spell.'
    },
    'relic_spell_keystone_G': {
      name: 'Spell Keystone',
      displayName: 'Spell Keystone (Greater)',
      rarity: 'Greater',
      category: 'Momentum',
      resource: { name: 'Relic Spell Keystone G', max: 1 },
      fields: [
        { label: 'Option 1', value: 'Your next spell attack has advantage and +@{selected|pb} to hit.' },
        { label: 'Option 2', value: 'Or up to two targets take −2 on their first save versus your next spell.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_spell_keystone_g_cur}/@{selected|hr_res_relic_spell_keystone_g_max} per room.' }
      ],
      note: 'Spell Keystone (Greater): 1/room grant your next spell attack advantage and +PB, or impose −2 on two targets\' first save vs your next spell.'
    },
    'relic_spell_keystone_S': {
      name: 'Spell Keystone',
      displayName: 'Spell Keystone (Signature)',
      rarity: 'Signature',
      category: 'Momentum',
      resource: { name: 'Relic Spell Keystone S', max: 1 },
      fields: [
        { label: 'Option 1', value: 'Your next spell attack hits automatically.' },
        { label: 'Option 2', value: 'Or one creature automatically fails the first save versus your next spell.' },
        { label: 'Uses', value: '@{selected|hr_res_relic_spell_keystone_s_cur}/@{selected|hr_res_relic_spell_keystone_s_max} per room.' }
      ],
      note: 'Spell Keystone (Signature): 1/room auto-hit a spell attack or force one creature to auto-fail the first save vs your next spell.'
    }
  };

  for (var relicId in relicConfigs) {
    if (relicConfigs.hasOwnProperty(relicId)) {
      var relicEffect = buildRelicEffect(relicId, relicConfigs[relicId]);
      if (relicEffect) {
        initialEffects[relicId] = relicEffect;
      }
    }
  }

  for (var effectKey in initialEffects) {
    if (initialEffects.hasOwnProperty(effectKey)) {
      registerEffect(initialEffects[effectKey]);
    }
  }

  function register() {
    var count = 0;
    for (var key in effects) {
      if (effects.hasOwnProperty(key)) {
        count += 1;
      }
    }
    info('Effect registry initialized with ' + count + ' entries.');
  }

  return {
    register: register,
    get: get,
    list: list
  };
})();
