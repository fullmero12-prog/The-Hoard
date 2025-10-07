// ------------------------------------------------------------
// Ancestor Registry
// ------------------------------------------------------------
// What this does (in simple terms):
//   Centralizes canonical data for every Hoard Run ancestor.
//   Stores weapon focus tags, kit blurbs, always-prepared spells,
//   boon decks, and other lookup metadata used across modules.
//   Exposes helpers so other modules can derive focus lists or
//   UI blurbs without duplicating the source data.
// ------------------------------------------------------------

var AncestorRegistry = (function () {

  var _entries = {};
  var _aliasIndex = {};

  function canon(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function clone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  function store(def) {
    if (!def || !def.name) {
      return;
    }

    var key = canon(def.name);
    var entry = clone(def) || {};

    entry.id = key;
    entry.displayName = def.name;
    entry.aliases = entry.aliases || [];
    entry.focusTags = entry.focusTags || [];
    entry.summary = entry.summary || '';
    entry.description = entry.description || entry.summary || '';
    entry.title = entry.title || def.name;
    entry.references = entry.references || '';
    entry.boonKey = entry.boonKey || def.name.replace(/[^A-Za-z0-9]/g, '');

    entry.baseKit = entry.baseKit || {};
    entry.baseKit.summary = entry.baseKit.summary || '';
    entry.baseKit.html = entry.baseKit.html || '';
    entry.baseKit.alwaysPreparedSpells = entry.baseKit.alwaysPreparedSpells || [];
    entry.baseKit.empowerments = entry.baseKit.empowerments || [];

    if (!entry.boons) {
      entry.boons = { Common: [], Greater: [], Signature: [] };
    }

    _entries[key] = entry;
    _aliasIndex[key] = key;
    _aliasIndex[canon(entry.displayName)] = key;

    if (entry.aliases && entry.aliases.length) {
      for (var i = 0; i < entry.aliases.length; i += 1) {
        _aliasIndex[canon(entry.aliases[i])] = key;
      }
    }
  }

  // ------------------------------------------------------------
  // Canonical Data Definitions
  // ------------------------------------------------------------

  store({
    name: 'Azuren',
    aliases: ['Azuren Stormheart'],
    focusTags: ['Orb'],
    title: 'Azuren, Ascendant of the Endless Bolt',
    summary: 'Master of wind and storm. Empowers mobility, deflection, and ranged control.',
    description: 'Lightning artillery with Charges, line/burst nukes, and long-range Barrages.',
    references: 'Azuren.md',
    baseKit: {
      summary: 'Charges build into sweeping arcane barrages that devastate distant foes.',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'azuren_stationary_battery',
          effectId: 'azuren_stationary_battery',
          name: 'Stationary Battery',
          text_in_run:
            'If you end your turn moving ≤5 ft, regain +1 extra Charge (total +2), and your next Arcanopulse before the end of your next turn deals +PB lightning.',
          hook: 'Charge'
        },
        {
          id: 'azuren_longshot_schema',
          effectId: 'azuren_longshot_schema',
          name: 'Longshot Schema',
          text_in_run:
            'While you have ≥2 Charges, your spell attacks vs. targets >60 ft get +1 to hit, and targets >60 ft have −1 to their saves vs your spells.',
          hook: 'Range'
        }
      ],
      Greater: [
        {
          id: 'azuren_overchannel_pulse',
          effectId: 'azuren_overchannel_pulse',
          name: 'Overchannel Pulse',
          text_in_run:
            'Arcanopulse loses Recharge (use it freely). It costs 1 Charge to fire; you may still spend up to 3 more to empower it as normal. Its width becomes 10 ft if you spend ≥2 Charges on it.',
          hook: 'Charge'
        },
        {
          id: 'azuren_eye_of_annihilation',
          effectId: 'azuren_eye_of_annihilation',
          name: 'Eye of Annihilation',
          text_in_run:
            'Eye of Destruction radius 15 ft; the center 5-ft deals +PBd6 lightning and imposes disadvantage on Dex saves until the end of the target’s next turn.',
          hook: 'Burst'
        },
        {
          id: 'azuren_conductive_mark',
          effectId: 'azuren_conductive_mark',
          name: 'Conductive Mark',
          text_in_run:
            'When lightning bolt damages a creature, it becomes Conductive until the end of your next turn; your next Arcanopulse or Barrage against a Conductive target deals +2d8.',
          hook: 'Team'
        }
      ],
      Signature: [
        {
          id: 'azuren_icon_of_ascension',
          effectId: 'azuren_icon_of_ascension',
          name: 'Icon of Ascension',
          text_in_run:
            'Max Charges 7; start each room with 4. Rite range becomes 600 ft and you gain a 4th Barrage.',
          hook: 'Charge'
        },
        {
          id: 'azuren_shocking_orb',
          effectId: 'azuren_shocking_orb',
          name: 'Shocking Orb (1/SR)',
          text_in_run:
            'Bonus Action; 90 ft. Make a ranged spell attack: on a hit, 3d8 lightning, and the target must make a Con save or be stunned until the end of its next turn.',
          hook: 'Summon'
        },
        {
          id: 'azuren_storm_conductor',
          effectId: 'azuren_storm_conductor',
          name: 'Storm Conductor',
          text_in_run:
            'Spell empowerments: guiding bolt — on hit, restore 1 Charge and the next Arcanopulse against that target has advantage (attack) or imposes disadvantage on its Dex save (your choice). storm sphere — while the sphere persists, you regain 1 Charge at the start of each of your turns.',
          hook: 'Control'
        }
      ]
    }
  });

  store({
    name: 'Sutra Vayla',
    aliases: ['Sutra', 'Vayla'],
    focusTags: ['Orb'],
    title: 'Sutra Vayla, the Harmonized Mantra',
    summary: 'Chronomancer who manipulates tempo and shields allies from fate.',
    description: 'Mantra forms (Bolt/Bond/Ward) that add radiant splash, tethers, or warding temp HP/speed.',
    references: 'Sutra Vayla.md',
    baseKit: {
      summary: 'Rotates between mantra forms to rebalance allies, shields, and radiant retaliation.',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'vayla_soulflare_echo',
          effectId: 'vayla_soulflare_echo',
          name: 'Soulflare Echo',
          text_in_run:
            'Bolt leaves a 10-ft zone at the target’s space until your next turn; creatures that enter/start there take PB radiant.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_safeguard',
          effectId: 'vayla_safeguard',
          name: 'Safeguard',
          text_in_run:
            'Ward also grants +1 AC until your next turn; if you Warded an ally, you gain temp HP = PB.',
          hook: 'Ward'
        },
        {
          id: 'vayla_fettering_thread',
          effectId: 'vayla_fettering_thread',
          name: 'Fettering Thread',
          text_in_run:
            'Bond range 40 ft; when it resolves, it deals an extra +PBd6 psychic.',
          hook: 'Bond'
        }
      ],
      Greater: [
        {
          id: 'vayla_radiant_bloom',
          effectId: 'vayla_radiant_bloom',
          name: 'Radiant Bloom',
          text_in_run:
            'Bolt adds +PBd8 to the main target and the secondary blast becomes 15-ft (Dex save) for PBd6; if the main target drops, deal max on the blast.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_twin_resolve',
          effectId: 'vayla_twin_resolve',
          name: 'Twin Resolve',
          text_in_run:
            'Bond may tether up to two creatures affected by the spell (each checks the tether separately). When either resolves, you also heal PB + spell level.',
          hook: 'Balance'
        },
        {
          id: 'vayla_bastion_mantra',
          effectId: 'vayla_bastion_mantra',
          name: 'Bastion Mantra',
          text_in_run:
            'Ward becomes a 10-ft-radius pulse around the chosen target, affecting up to PB creatures; each gains resistance to one damage type you choose until your next turn.',
          hook: 'Ward'
        }
      ],
      Signature: [
        {
          id: 'vayla_twin_mantra',
          effectId: 'vayla_twin_mantra',
          name: 'Twin Mantra',
          text_in_run: 'You can Mantra 2/Short Rest.',
          hook: 'Balance'
        },
        {
          id: 'vayla_harmony_mantra',
          effectId: 'vayla_harmony_mantra',
          name: 'Harmony Mantra',
          text_in_run: 'When you Mantra, you may apply two different Forms to that spell.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_ascendant_aegis',
          effectId: 'vayla_ascendant_aegis',
          name: 'Ascendant Aegis',
          text_in_run:
            'Ward grants its targets resistance to all damage and immunity to charmed & frightened until the start of your next turn.',
          hook: 'Ward'
        }
      ]
    }
  });

  store({
    name: 'Vladren Moroi',
    aliases: ['Vladren'],
    focusTags: ['Orb'],
    title: 'Vladren Moroi, the Crimson Tide',
    summary: 'Vampiric tactician who thrives on sacrifice and relentless aggression.',
    description: 'Temp-HP engine; necrotic drain (Transfusion), damage shunts (Pool), and burst heal/damage.',
    references: 'Vladren Moroi.md',
    baseKit: {
      summary: 'Crimson Pact temp HP and necrotic siphons sustain the Blood Regent on the front line.',
      html: '<div style="font-family:inherit;font-size:13px;line-height:1.25;"><h3 style="margin:0 0 6px 0;">Vladren Moroi — The Crimson Tide</h3><b>Crimson Pact.</b> Excess healing becomes <b>temp HP</b> (cap <b>5×PB + spell mod</b>). While you have Pact temp HP: <b>+1 AC</b>; your <b>necrotic ignores resistance</b> (treat immunity as resistance).<br><br><b>Transfusion (Bonus, 1/turn).</b> One creature within <b>60 ft</b> makes a <b>Con save</b>. Fail: <b>2d8 necrotic + PB</b> (success half). You <b>heal</b> for the damage dealt. If the target is <b>½ HP or less</b>, Transfusion deals <b>+1d8 necrotic</b>.<br><br><b>Sanguine Pool (Reaction, 1/SR).</b> When you take damage, become <b>blood mist</b> until the start of your next turn: <b>resistance to all</b>, you can <b>move through creatures</b>, you <b>can’t cast leveled spells or make attacks</b>, and <b>enemies can’t make OAs</b> against you.<br><br><b>Hemoplague (1/SR).</b> <b>20-ft radius</b> point within 60 ft, Con save → target is <b>Plagued</b> until end of next turn (<b>+PB damage</b> from all sources), then it takes <b>6d6 necrotic</b> (success <b>3d6</b>). You <b>heal</b> for the total necrotic; excess healing becomes <b>Pact temp HP</b>.</div>',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'vladren_thickened_vitae',
          effectId: 'vladren_thickened_vitae',
          name: 'Thickened Vitae',
          text_in_run:
            'false life on yourself is 1/room without a slot and grants +PB additional temp HP. While you have temp HP, +10 ft speed.',
          hook: 'Sustain'
        },
        {
          id: 'vladren_crimson_drip',
          effectId: 'vladren_crimson_drip',
          name: 'Crimson Drip',
          text_in_run:
            'Transfusion deals +1d8 necrotic and, on a kill, refreshes Transfusion (you can use it again this turn).',
          hook: 'Leech'
        }
      ],
      Greater: [
        {
          id: 'vladren_tides_of_blood',
          effectId: 'vladren_tides_of_blood',
          name: 'Tides of Blood',
          text_in_run:
            'Action (1/turn): a 15-ft radius surge centered on you; creatures Con save or take 4d6 necrotic + PB (half on success). You may lose up to PBd6 HP to add that much necrotic to the surge; you heal for half the total damage dealt.',
          hook: 'Sustain'
        },
        {
          id: 'vladren_sovereign_pool',
          effectId: 'vladren_sovereign_pool',
          name: 'Sovereign Pool',
          text_in_run:
            'Sanguine Pool gains +15 ft move when you enter it and recharges on 5–6 at the start of your turn while you have ≥10 temp HP.',
          hook: 'Resource'
        }
      ],
      Signature: [
        {
          id: 'vladren_crimson_apotheosis',
          effectId: 'vladren_crimson_apotheosis',
          name: 'Crimson Apotheosis (1/SR)',
          text_in_run:
            'For 2 rounds, your temp HP cap doubles, you have resistance to all damage, and Transfusion can be used twice each turn (still one Bonus Action each).',
          hook: 'Survival'
        },
        {
          id: 'vladren_hemarchs_decree',
          effectId: 'vladren_hemarchs_decree',
          name: 'Hemarch’s Decree',
          text_in_run:
            'Hemoplague also makes affected creatures vulnerable to necrotic until the burst resolves; the burst deals +2d6 necrotic, and you gain advantage on attacks and +1 to spell save DC against Plagued creatures.',
          hook: 'Control'
        }
      ]
    }
  });

  store({
    name: 'Lian Veilbinder',
    aliases: ['Lian'],
    focusTags: ['Staff'],
    title: 'Lian the Veilbinder, Mistress of Mirrors',
    summary: 'Weaver of illusions and blade, combining elegance with deadly precision.',
    description: 'Stack Veils via spells/hits; invis on demand; Detonate to blind/stun with psychic damage.',
    references: 'Lian Veilbinder.md',
    baseKit: {
      summary: 'Illusory veils mask movement while detonation punishes foes that crowd the duel.',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'lian_flicker_step',
          effectId: 'lian_flicker_step',
          name: 'Flicker Step',
          text_in_run:
            'When you Veilcloak or Shatter, you may teleport 10 ft to a space you can see.',
          hook: 'Mobility'
        },
        {
          id: 'lian_spreading_lies',
          effectId: 'lian_spreading_lies',
          name: 'Spreading Lies',
          text_in_run:
            'When a spell you cast damages 2+ creatures, you may Veil up to two of them (your choice) instead of only one.',
          hook: 'Illusion'
        },
        {
          id: 'lian_mirrored_guard',
          effectId: 'lian_mirrored_guard',
          name: 'Mirrored Guard',
          text_in_run:
            'mirror image: you conjure +1 extra duplicate, and the first creature that misses you each round while a duplicate remains gains 1 Veil (once per creature per round).',
          hook: 'Defense'
        }
      ],
      Greater: [
        {
          id: 'lian_pattern_weaver',
          effectId: 'lian_pattern_weaver',
          name: 'Pattern Weaver',
          text_in_run:
            'hypnotic pattern: all creatures who can see the pattern gain 1 Veil; those who fail the save gain 2 Veils instead.',
          hook: 'Control'
        },
        {
          id: 'lian_invisible_hand',
          effectId: 'lian_invisible_hand',
          name: 'Invisible Hand',
          text_in_run:
            'While Veilcloak is active, you don’t provoke opportunity attacks and gain +10 ft speed; casting cantrips still doesn’t break it.',
          hook: 'Utility'
        },
        {
          id: 'lian_mirrorbreak',
          effectId: 'lian_mirrorbreak',
          name: 'Mirrorbreak',
          text_in_run:
            'Shatter deals 2d12/stack + PB instead, and on a failed save the target is blinded and silenced until the end of its next turn (at 3 stacks, it’s stunned as well).',
          hook: 'Burst'
        }
      ],
      Signature: [
        {
          id: 'lian_everlasting_lies',
          effectId: 'lian_everlasting_lies',
          name: 'Everlasting Lies',
          text_in_run:
            'Your Veils no longer expire. You can maintain persistent Veils on up to PB different creatures at a time.',
          hook: 'Illusion'
        },
        {
          id: 'lian_cataclysmic_shatter',
          effectId: 'lian_cataclysmic_shatter',
          name: 'Cataclysmic Shatter (1/SR)',
          text_in_run:
            'This turn, Shatter is a Bonus Action and deals 3d8/stack + PB. Each time Shatter drops a creature this turn, all enemies within 10 ft of it gain 1 Veil.',
          hook: 'Burst'
        },
        {
          id: 'lian_static_scream',
          effectId: 'lian_static_scream',
          name: 'Static Scream',
          text_in_run:
            'synaptic static: adds +PB psychic, and creatures that fail the save gain 2 Veils (1 Veil on a success). While they remain Veiled, they have disadvantage on the end-of-turn save to end the spell’s debuff.',
          hook: 'Control'
        }
      ]
    }
  });

  store({
    name: 'Morvox, Tiny Tyrant',
    aliases: ['Morvox'],
    focusTags: ['Staff'],
    title: 'Morvox, Tiny Tyrant of the Umbral Staff',
    summary: 'Small body, massive ego. Commands minions, chaos, and unearned confidence.',
    description: 'Build Malice from spell hits/fails; Dark Star + Event Horizon control; big single-target burst.',
    references: 'Morvox, Tiny Tyrant.md',
    baseKit: {
      summary: 'Malice-fueled singularities and ego-driven spellcraft collapse the battlefield.',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'morvox_malevolent_study',
          effectId: 'morvox_malevolent_study',
          name: 'Malevolent Study',
          text_in_run:
            'Max Malice +3, and you start each room with 2 Malice.',
          hook: 'Malice'
        },
        {
          id: 'morvox_baleful_momentum',
          effectId: 'morvox_baleful_momentum',
          name: 'Baleful Momentum',
          text_in_run:
            'Once per turn, when a creature fails a save vs your Ancestor spell, gain +1 additional Malice.',
          hook: 'Damage'
        }
      ],
      Greater: [
        {
          id: 'morvox_collapsing_star',
          effectId: 'morvox_collapsing_star',
          name: 'Collapsing Star',
          text_in_run:
            'Dark Star falls at the end of this turn instead of next; radius 15 ft. If Dark Star lands while a creature is in your Event Horizon ring, creatures that fail are stunned instead of prone.',
          hook: 'Control'
        },
        {
          id: 'morvox_grand_horizon',
          effectId: 'morvox_grand_horizon',
          name: 'Grand Horizon',
          text_in_run:
            'Event Horizon radius 20 ft and lasts until the end of your next turn. The first time each round a creature is stunned by it, you gain 1 Malice.',
          hook: 'Range'
        }
      ],
      Signature: [
        {
          id: 'morvox_power_overwhelming',
          effectId: 'morvox_power_overwhelming',
          name: 'Power Overwhelming',
          text_in_run:
            'Max Malice 12; when you spend Malice on a spell, you may spend up to 5. On a takedown, refund 2 Malice.',
          hook: 'Burst'
        },
        {
          id: 'morvox_cataclysm',
          effectId: 'morvox_cataclysm',
          name: 'Cataclysm (1/SR)',
          text_in_run:
            'Primordial Burst becomes a Bonus Action and doesn’t consume Malice. Against targets at ½ HP or less, the save is made at disadvantage.',
          hook: 'Ultimate'
        }
      ]
    }
  });

  store({
    name: 'Seraphine Emberwright',
    aliases: ['Seraphine'],
    focusTags: ['Staff'],
    title: 'Seraphine Emberwright, Phoenix of the Nine Coals',
    summary: 'Radiant artist who channels flame into healing, renewal, and creative power.',
    description: 'Heat/Overheat loop, Vent nova + ignited terrain, and staff strings; fire boon escalations.',
    references: 'Seraphine Emberwright.md',
    baseKit: {
      summary: 'Build Heat with staff strings, Vent to nova, and overheat into phoenix rebirths.',
      alwaysPreparedSpells: [],
      empowerments: []
    },
    boons: {
      Common: [
        {
          id: 'seraphine_kindled_gaze',
          effectId: 'seraphine_kindled_gaze',
          name: 'Kindled Gaze',
          text_in_run:
            'When you Vent, choose a creature in the area; it takes +PB fire damage if it fails the save.',
          hook: 'Burn'
        },
        {
          id: 'seraphine_coalstrider',
          effectId: 'seraphine_coalstrider',
          name: 'Coalstrider',
          text_in_run:
            'While you have ≥20 Heat, ignore difficult terrain and you can move through spaces occupied by creatures without provoking OAs.',
          hook: 'Mobility'
        }
      ],
      Greater: [
        {
          id: 'seraphine_cinderstorm',
          effectId: 'seraphine_cinderstorm',
          name: 'Cinderstorm',
          text_in_run:
            'Fireball ignites the area into Cinder Terrain for 1 minute (1d6 fire on enter/start). Creatures that fail the save are also pushed 5 ft and take +PB fire.',
          hook: 'Zone'
        },
        {
          id: 'seraphine_rolling_furnace',
          effectId: 'seraphine_rolling_furnace',
          name: 'Rolling Furnace',
          text_in_run:
            'flaming sphere: Once per turn you may move the sphere up to 15 ft when you Vent (no extra action). The sphere deals +PB fire, and creatures that fail its save are pushed 5 ft.',
          hook: 'Heat'
        }
      ],
      Signature: [
        {
          id: 'seraphine_inferno_combo',
          effectId: 'seraphine_inferno_combo',
          name: 'Inferno Combo',
          text_in_run:
            'When you take the Attack action with the staff, make a third staff attack.',
          hook: 'Tempo'
        },
        {
          id: 'seraphine_phoenix_bloom',
          effectId: 'seraphine_phoenix_bloom',
          name: 'Phoenix Bloom (1/SR)',
          text_in_run:
            'Instantly Overheat and make two staff attacks. Then refund 25 Heat and move 10 ft without provoking.',
          hook: 'Revive'
        },
        {
          id: 'seraphine_phoenix_coronation',
          effectId: 'seraphine_phoenix_coronation',
          name: 'Phoenix Coronation (1/SR)',
          text_in_run:
            'Empower a major burn: Fireball — after it resolves, the 20-ft radius edge becomes a Cinder Ring for 1 minute (ignited terrain; 1d6 fire on enter/start). Immolation — if the target dies while burning, the flames jump to a new creature within 15 ft (new save; remaining duration). This casting ignores fire resistance and treats immunity as resistance.',
          hook: 'Ultimate'
        }
      ]
    }
  });

  // ------------------------------------------------------------
  // Public Helpers
  // ------------------------------------------------------------

  function resolveKey(name) {
    var key = canon(name);
    return _aliasIndex[key] || null;
  }

  function get(name) {
    var key = resolveKey(name);
    if (!key || !_entries[key]) {
      return null;
    }
    return clone(_entries[key]);
  }

  function getSummary(name) {
    var entry = get(name);
    if (!entry) {
      return null;
    }
    return {
      title: entry.title || entry.displayName,
      summary: entry.summary || entry.description || ''
    };
  }

  function list() {
    var keys = Object.keys(_entries);
    var list = [];
    for (var i = 0; i < keys.length; i += 1) {
      list.push(clone(_entries[keys[i]]));
    }
    return list;
  }

  function count() {
    return Object.keys(_entries).length;
  }

  function getFocusEntries(tag) {
    var focus = String(tag || '').toLowerCase();
    var results = [];
    var keys = Object.keys(_entries);
    for (var i = 0; i < keys.length; i += 1) {
      var entry = _entries[keys[i]];
      for (var j = 0; j < entry.focusTags.length; j += 1) {
        if (String(entry.focusTags[j] || '').toLowerCase() === focus) {
          results.push(clone(entry));
          break;
        }
      }
    }
    return results;
  }

  function getFocusNames(tag) {
    var entries = getFocusEntries(tag);
    var names = [];
    for (var i = 0; i < entries.length; i += 1) {
      names.push(entries[i].displayName);
    }
    return names;
  }

  function getUiBlurb(name) {
    var entry = get(name);
    if (!entry) {
      return null;
    }
    return {
      title: entry.title || entry.displayName,
      desc: entry.description || entry.summary || '',
      refs: entry.references || ''
    };
  }

  function getBoonDecks() {
    var decks = {};
    var keys = Object.keys(_entries);
    for (var i = 0; i < keys.length; i += 1) {
      var entry = _entries[keys[i]];
      decks[entry.boonKey] = clone(entry.boons);
    }
    return decks;
  }

  return {
    get: get,
    getSummary: getSummary,
    list: list,
    count: count,
    getFocusEntries: getFocusEntries,
    getFocusNames: getFocusNames,
    getUiBlurb: getUiBlurb,
    getBoonDecks: getBoonDecks
  };

})();

