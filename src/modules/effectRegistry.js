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
    // === VLADREN — The Crimson Tide (Boons) ===
    // IDs match your deck data so BoonManager can apply by picked.id

    'vladren_thickened_vitae': {
      id: 'vladren_thickened_vitae',
      name: 'Thickened Vitae',
      source: 'Vladren Moroi (Common)',
      patches: [
        // False life 1/room w/o slot, +PB temp HP; +10 ft speed while you have temp HP
        { type: 'attr', name: 'hr_false_life_free_per_room', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_false_life_pb_bonus', op: 'set', value: '@{hr_pb}' }, // store as marker (informational)
        { type: 'attr', name: 'hr_speed_bonus_when_thp', op: 'set', value: 10 },
        { type: 'ability', name: '[Vladren] Thickened Vitae (Info)', token: true,
          action: '&{template:default} {{name=Thickened Vitae}} {{False Life=1/room without slot; add **+@{selected|hr_pb}** temp HP}} {{Pact Cap=Your Pact temp HP cap is [[ 5*@{selected|hr_pb} + @{selected|hr_spellmod} ]]}} {{Speed=While you have temp HP, gain **+10 ft** speed}}' },
        { type: 'note', text: 'False Life 1/room w/o slot; add +PB temp HP. +10 ft speed while you have temp HP.' }
      ]
    },

    'vladren_crimson_drip': {
      id: 'vladren_crimson_drip',
      name: 'Crimson Drip',
      source: 'Vladren Moroi (Common)',
      patches: [
        // Transfusion +1d8 necrotic; on a kill, refresh Transfusion
        { type: 'attr', name: 'hr_transfusion_bonus_die', op: 'set', value: '1d8' },
        { type: 'attr', name: 'hr_transfusion_refresh_on_kill', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Crimson Drip (Info)', token: true,
          action: '&{template:default} {{name=Crimson Drip}} {{Transfusion=Deals **+1d8 necrotic**; on a kill, Transfusion is refreshed and can be used again this turn}}' },
        { type: 'note', text: 'Transfusion +1d8 necrotic; refresh on kill (extra use this turn).' }
      ]
    },

    'vladren_tides_of_blood': {
      id: 'vladren_tides_of_blood',
      name: 'Tides of Blood',
      source: 'Vladren Moroi (Greater)',
      patches: [
        // Action 1/turn: 15-ft radius surge; Con save → 4d6+PB necrotic (half on success)
        // You may lose up to PBd6 HP to add that much necrotic; heal half total dealt.
        { type: 'ability', name: '[Vladren] Tides of Blood (Action)', token: true,
          action: '&{template:default} {{name=Tides of Blood (Action, 1/turn)}} {{Area=15-ft radius centered on you}} {{Save=Con save (DC [[ 8 + @{selected|hr_pb} + @{selected|hr_spellmod} ]])}} {{Damage=[[ 4d6 + @{selected|hr_pb} ]] necrotic (half on success)}} {{Empower=You may lose up to **@{selected|hr_pb}d6 HP** to add that much necrotic}} {{Heal=You heal **half** the total necrotic dealt}}' },
        { type: 'note', text: 'Action (1/turn). 15-ft surge; Con save. 4d6+PB necrotic; may lose up to PBd6 HP to add; heal half total dealt.' }
      ]
    },

    'vladren_sovereign_pool': {
      id: 'vladren_sovereign_pool',
      name: 'Sovereign Pool',
      source: 'Vladren Moroi (Greater)',
      patches: [
        // Sanguine Pool gains +15 ft move on enter; recharges on 5–6 if THP >=10
        { type: 'attr', name: 'hr_pool_bonus_move_on_enter', op: 'set', value: 15 },
        { type: 'attr', name: 'hr_pool_recharge_5_6_if_thp10', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Sovereign Pool (Info)', token: false,
          action: '&{template:default} {{name=Sovereign Pool}} {{Move=When you enter, gain **+15 ft** movement}} {{Recharge=At start of your turn, **recharges on 5–6** while you have **≥10 temp HP**}}' },
        { type: 'note', text: 'Pool: +15 ft move on enter; recharge on 5–6 while you have ≥10 temp HP.' }
      ]
    },

    'vladren_crimson_apotheosis': {
      id: 'vladren_crimson_apotheosis',
      name: 'Crimson Apotheosis',
      source: 'Vladren Moroi (Signature, 1/SR)',
      patches: [
        // 2 rounds: temp HP cap doubles; resistance to all; Transfusion twice/turn
        { type: 'attr', name: 'hr_pact_cap_multiplier', op: 'set', value: 2 },
        { type: 'attr', name: 'hr_resistance_all_active', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_transfusion_per_turn', op: 'set', value: 2 },
        { type: 'ability', name: '[Vladren] Crimson Apotheosis (1/SR)', token: true,
          action: '&{template:default} {{name=Crimson Apotheosis (1/SR)}} {{Duration=2 rounds}} {{Pact=Temp HP cap becomes [[ 2*(5*@{selected|hr_pb} + @{selected|hr_spellmod}) ]]}} {{Defense=**Resistance to all damage**}} {{Transfusion=Use **twice each turn** (still one Bonus Action each)}}' },
        { type: 'note', text: 'Apotheosis (1/SR): 2 rounds. THP cap ×2; resistance to all; Transfusion ×2/turn.' }
      ]
    },

    'vladren_hemarchs_decree': {
      id: 'vladren_hemarchs_decree',
      name: 'Hemarch\u2019s Decree',
      source: 'Vladren Moroi (Signature)',
      patches: [
        // Hemoplague upgrades: vuln to necrotic; +2d6 necrotic; +1 DC & advantage vs Plagued
        { type: 'attr', name: 'hr_hemo_plague_vuln_necrotic', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_hemo_plague_bonus_damage', op: 'set', value: '2d6' },
        { type: 'attr', name: 'hr_necrotic_dc_bonus', op: 'set', value: 1 },
        { type: 'attr', name: 'hr_adv_vs_plagued', op: 'set', value: 1 },
        { type: 'ability', name: '[Vladren] Hemarch\u2019s Decree (Info)', token: true,
          action: '&{template:default} {{name=Hemarch’s Decree}} {{Hemoplague=Targets are **vulnerable to necrotic** until the burst}} {{Burst=Burst deals **+2d6 necrotic**}} {{Targeting=You have **advantage** on attacks and **+1** to spell save DC vs **Plagued** creatures}}' },
        { type: 'note', text: 'Hemoplague: necrotic vuln; burst +2d6 necrotic; +1 DC & advantage vs Plagued.' }
      ]
    }
  };

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
