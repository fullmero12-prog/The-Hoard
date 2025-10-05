// ------------------------------------------------------------
// Boon Deck Data — Ancestors of the Hoard Run
// ------------------------------------------------------------
// Purpose:
//   Defines all Boon cards grouped by Ancestor and rarity.
//   This file is pure data and should be loaded before
//   BoonManager.register() so that decks are ready in memory.
// ------------------------------------------------------------

var BoonDataLoader = (function () {

  var BoonDecks = {
    // ⚡️ AZUREN — Ascendant of the Endless Bolt
    Azuren: {
      Common: [
        {
          id: 'azuren_stationary_battery',
          name: 'Stationary Battery',
          text_in_run: 'When you end your turn without moving, gain +1 to spell attack rolls until the start of your next turn.',
          hook: 'Charge'
        },
        {
          id: 'azuren_longshot_schema',
          name: 'Longshot Schema',
          text_in_run: 'Increase range of all ranged spells by 10 ft.',
          hook: 'Range'
        }
      ],
      Greater: [
        {
          id: 'azuren_overchannel_pulse',
          name: 'Overchannel Pulse',
          text_in_run: 'When you spend 3 or more Charges in a round, deal 1d8 lightning damage to all enemies within 10 ft of your target.',
          hook: 'Charge'
        },
        {
          id: 'azuren_eye_of_annihilation',
          name: 'Eye of Annihilation',
          text_in_run: 'Your first spell each room deals maximum lightning damage once per run.',
          hook: 'Burst'
        },
        {
          id: 'azuren_conductive_mark',
          name: 'Conductive Mark',
          text_in_run: 'Enemies damaged by your lightning spells grant +2 damage to the next ally who hits them this turn.',
          hook: 'Team'
        }
      ],
      Signature: [
        {
          id: 'azuren_icon_of_ascension',
          name: 'Icon of Ascension',
          text_in_run: 'While stationary for 2 consecutive rounds, your lightning spells ignore resistance.',
          hook: 'Charge'
        },
        {
          id: 'azuren_shocking_orb',
          name: 'Shocking Orb',
          text_in_run: 'Summon a floating orb that repeats your last lightning cantrip at half damage for 3 rounds.',
          hook: 'Summon'
        },
        {
          id: 'azuren_storm_conductor',
          name: 'Storm Conductor',
          text_in_run: 'Gain +1 Charge capacity and +1 to spell save DC for lightning spells.',
          hook: 'Control'
        }
      ]
    },

    // ☯️ SUTRA VAYLA — Harmonized Mantra
    SutraVayla: {
      Common: [
        {
          id: 'vayla_soulflare_echo',
          name: 'Soulflare Echo',
          text_in_run: 'When you cast a radiant spell, deal 1 radiant damage to all tethered allies\' targets.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_safeguard',
          name: 'Safeguard',
          text_in_run: 'Once per room, redirect the next 5 damage an ally would take to yourself.',
          hook: 'Ward'
        },
        {
          id: 'vayla_fettering_thread',
          name: 'Fettering Thread',
          text_in_run: 'Your tethers reduce target speed by 10 ft.',
          hook: 'Bond'
        }
      ],
      Greater: [
        {
          id: 'vayla_radiant_bloom',
          name: 'Radiant Bloom',
          text_in_run: 'Whenever you cast a spell on an ally, that ally regains 1d4 HP.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_twin_resolve',
          name: 'Twin Resolve',
          text_in_run: 'When you end concentration on a spell, immediately start a 2nd concentration spell for free (1/room).',
          hook: 'Balance'
        },
        {
          id: 'vayla_bastion_mantra',
          name: 'Bastion Mantra',
          text_in_run: 'Allies within 10 ft of you gain +1 AC while you maintain a Ward effect.',
          hook: 'Ward'
        }
      ],
      Signature: [
        {
          id: 'vayla_twin_mantra',
          name: 'Twin Mantra',
          text_in_run: 'Maintain two concentration spells simultaneously (they share saves).',
          hook: 'Balance'
        },
        {
          id: 'vayla_harmony_mantra',
          name: 'Harmony Mantra',
          text_in_run: 'All radiant damage you deal heals allies in range for half the amount.',
          hook: 'Radiant'
        },
        {
          id: 'vayla_ascendant_aegis',
          name: 'Ascendant Aegis',
          text_in_run: 'Once per run, negate all damage to allies within 10 ft for one round.',
          hook: 'Ward'
        }
      ]
    },

    // 🩸 VLADREN MOROI — The Crimson Tide
    VladrenMoroi: {
      Common: [
        {
          id: 'vladren_thickened_vitae',
          name: 'Thickened Vitae',
          text_in_run: 'Gain +5 temporary HP at the start of each room.',
          hook: 'Sustain'
        },
        {
          id: 'vladren_crimson_drip',
          name: 'Crimson Drip',
          text_in_run: 'When you damage a foe with a spell, regain 1 HP.',
          hook: 'Leech'
        }
      ],
      Greater: [
        {
          id: 'vladren_tides_of_blood',
          name: 'Tides of Blood',
          text_in_run: 'When you reduce an enemy to 0 HP, allies heal for 1d6 HP.',
          hook: 'Sustain'
        },
        {
          id: 'vladren_sovereign_pool',
          name: 'Sovereign Pool',
          text_in_run: 'Spend 10 HP to regain a spell slot of level 1 (once per room).',
          hook: 'Resource'
        }
      ],
      Signature: [
        {
          id: 'vladren_crimson_apotheosis',
          name: 'Crimson Apotheosis',
          text_in_run: 'When you drop below half HP, gain resistance to all damage for one round.',
          hook: 'Survival'
        },
        {
          id: 'vladren_hemarchs_decree',
          name: 'Hemarch’s Decree',
          text_in_run: 'Once per run, raise a slain enemy as a blood-thrall under your control.',
          hook: 'Control'
        }
      ]
    },

    // 🪞 LIAN VEILBINDER — Weaver of Lies
    LianVeilbinder: {
      Common: [
        {
          id: 'lian_flicker_step',
          name: 'Flicker Step',
          text_in_run: 'Teleport 5 ft as a bonus action. Once per room.',
          hook: 'Mobility'
        },
        {
          id: 'lian_spreading_lies',
          name: 'Spreading Lies',
          text_in_run: 'Enemies affected by your illusions have disadvantage on Insight checks.',
          hook: 'Illusion'
        },
        {
          id: 'lian_mirrored_guard',
          name: 'Mirrored Guard',
          text_in_run: 'Gain +2 AC while you have an active Veil.',
          hook: 'Defense'
        }
      ],
      Greater: [
        {
          id: 'lian_pattern_weaver',
          name: 'Pattern Weaver',
          text_in_run: 'You may sustain two minor illusions simultaneously.',
          hook: 'Control'
        },
        {
          id: 'lian_invisible_hand',
          name: 'Invisible Hand',
          text_in_run: 'Invisible Mage Hand gains 30 ft range and can shove or pull (STR +2).',
          hook: 'Utility'
        },
        {
          id: 'lian_mirrorbreak',
          name: 'Mirrorbreak',
          text_in_run: 'Once per room, shatter all illusions to deal 1d8 psychic damage to nearby enemies.',
          hook: 'Burst'
        }
      ],
      Signature: [
        {
          id: 'lian_everlasting_lies',
          name: 'Everlasting Lies',
          text_in_run: 'Illusions you create persist for 1 minute after losing concentration.',
          hook: 'Illusion'
        },
        {
          id: 'lian_cataclysmic_shatter',
          name: 'Cataclysmic Shatter',
          text_in_run: 'Destroy all Veils to blind enemies within 15 ft (CON save DC 15). Once per run.',
          hook: 'Burst'
        },
        {
          id: 'lian_static_scream',
          name: 'Static Scream',
          text_in_run: 'Enemies who fail their save against your illusions are deafened for 1 minute.',
          hook: 'Control'
        }
      ]
    },

    // 🌑 MORVOX — Tiny Tyrant of the Umbral Staff
    Morvox: {
      Common: [
        {
          id: 'morvox_malevolent_study',
          name: 'Malevolent Study',
          text_in_run: 'At the start of each room, gain 1 Malice stack.',
          hook: 'Malice'
        },
        {
          id: 'morvox_baleful_momentum',
          name: 'Baleful Momentum',
          text_in_run: 'Your first attack each room deals +1d4 necrotic damage.',
          hook: 'Damage'
        }
      ],
      Greater: [
        {
          id: 'morvox_collapsing_star',
          name: 'Collapsing Star',
          text_in_run: 'When you reach 5 Malice, create a 10 ft radius gravitational pull for 1 round.',
          hook: 'Control'
        },
        {
          id: 'morvox_grand_horizon',
          name: 'Grand Horizon',
          text_in_run: 'Your spells have advantage on attacks beyond 30 ft range.',
          hook: 'Range'
        }
      ],
      Signature: [
        {
          id: 'morvox_power_overwhelming',
          name: 'Power Overwhelming',
          text_in_run: 'At 5 Malice, double your spell damage for one round, then reset Malice to 0.',
          hook: 'Burst'
        },
        {
          id: 'morvox_cataclysm',
          name: 'Cataclysm',
          text_in_run: 'Once per run, consume all Malice to unleash a 20 ft radius void dealing 6d8 force damage (DEX save half).',
          hook: 'Ultimate'
        }
      ]
    },

    // 🔥 SERAPHINE EMBERWRIGHT — Phoenix of the Nine Coals
    SeraphineEmberwright: {
      Common: [
        {
          id: 'seraphine_coalstorm_vent',
          name: 'Coalstorm Vent',
          text_in_run: 'When you Overheat, deal 1d4 fire damage to all enemies within 10 ft.',
          hook: 'Overheat'
        },
        {
          id: 'seraphine_ember_rebound',
          name: 'Ember Rebound',
          text_in_run: 'When you take fire damage, your next fire spell deals +1d6 damage.',
          hook: 'Heat'
        }
      ],
      Greater: [
        {
          id: 'seraphine_aegis_of_embers',
          name: 'Aegis of Embers',
          text_in_run: 'Gain resistance to fire damage and +2 AC while Heated.',
          hook: 'Defense'
        },
        {
          id: 'seraphine_conflagration',
          name: 'Conflagration',
          text_in_run: 'When you Vent, leave behind a 10 ft fire zone that lasts 1 round.',
          hook: 'Overheat'
        },
        {
          id: 'seraphine_rolling_furnace',
          name: 'Rolling Furnace',
          text_in_run: 'Your fire spells ignore cover bonuses to AC.',
          hook: 'Heat'
        }
      ],
      Signature: [
        {
          id: 'seraphine_inferno_combo',
          name: 'Inferno Combo',
          text_in_run: 'When you cast a fire spell, you may immediately cast a cantrip as a bonus action (1/room).',
          hook: 'Tempo'
        },
        {
          id: 'seraphine_phoenix_bloom',
          name: 'Phoenix Bloom',
          text_in_run: 'When reduced to 0 HP, rise with half HP and emit a 10 ft healing burst (1/run).',
          hook: 'Revive'
        },
        {
          id: 'seraphine_phoenix_coronation',
          name: 'Phoenix Coronation',
          text_in_run: 'While at full Heat, gain advantage on all attack rolls and saving throws for 1 round.',
          hook: 'Ultimate'
        }
      ]
    }
  };

  function register() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }
    state.HoardRun.boons = BoonDecks;
    log('[BoonDataLoader] Loaded ' + Object.keys(BoonDecks).length + ' ancestor decks.');
  }

  return {
    register: register
  };
})();

