// ------------------------------------------------------------
// Relic Data Bundle
// ------------------------------------------------------------
// What this does (in simple terms):
//   Provides the static relic catalog for Roll20 to consume.
//   The Roll20 sandbox cannot import JSON files directly, so this
//   wraps the dataset in a tiny module and registers a loader that
//   copies the data into the persistent state object.
// ------------------------------------------------------------

var RelicData = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('RelicDataLoader', message);
    } else {
      log('[Hoard Run] [RelicDataLoader] ℹ️ ' + message);
    }
  }

  var RELIC_CATALOG = [
    // Tempo & Action Economy
    {
      "id": "relic_quickcast_signet_C",
      "name": "Quickcast Signet",
      "rarity": "Common",
      "category": "Tempo",
      "price": 30,
      "text_in_run": "1/room, cast a cantrip as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },
    {
      "id": "relic_quickcast_signet_G",
      "name": "Quickcast Signet (Greater)",
      "rarity": "Greater",
      "category": "Tempo",
      "price": 50,
      "text_in_run": "1/room, cast a 1st–3rd-level spell as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },
    {
      "id": "relic_quickcast_signet_S",
      "name": "Quickcast Signet (Signature)",
      "rarity": "Signature",
      "category": "Tempo",
      "price": 70,
      "text_in_run": "1/room, cast any spell as a bonus action and ignore the no-second-leveled-spell rule that turn.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },
    {
      "id": "relic_surge_anklet_C",
      "name": "Surge Anklet",
      "rarity": "Common",
      "category": "Tempo",
      "price": 30,
      "text_in_run": "1/room, make one weapon attack as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Martial", "BonusAction"]
    },
    {
      "id": "relic_surge_anklet_G",
      "name": "Surge Anklet (Greater)",
      "rarity": "Greater",
      "category": "Tempo",
      "price": 50,
      "text_in_run": "1/room, make two weapon attacks as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Martial", "BonusAction"]
    },
    {
      "id": "relic_surge_anklet_S",
      "name": "Surge Anklet (Signature)",
      "rarity": "Signature",
      "category": "Tempo",
      "price": 70,
      "text_in_run": "1/room, gain haste (no concentration) until your next turn: +2 AC, adv. Dex saves, speed ×2, and one extra limited action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Martial", "Haste"]
    },
    {
      "id": "relic_reserve_snap_C",
      "name": "Reserve Snap",
      "rarity": "Common",
      "category": "Tempo",
      "price": 30,
      "text_in_run": "1/room, convert your bonus action into teleport 10 ft and Disengage.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Teleport", "Disengage"]
    },
    {
      "id": "relic_reserve_snap_G",
      "name": "Reserve Snap (Greater)",
      "rarity": "Greater",
      "category": "Tempo",
      "price": 50,
      "text_in_run": "1/room, teleport 20 ft; you do not provoke opportunity attacks until your turn ends.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Teleport", "Defense"]
    },
    {
      "id": "relic_reserve_snap_S",
      "name": "Reserve Snap (Signature)",
      "rarity": "Signature",
      "category": "Tempo",
      "price": 70,
      "text_in_run": "1/room as a bonus action or reaction, teleport 30 ft; the trigger attack or save auto-misses/fails and you avoid OAs until your next turn starts.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Teleport", "Reaction"]
    },

    // Defense & Sustain
    {
      "id": "relic_second_wind_flask_C",
      "name": "Second Wind Flask",
      "rarity": "Common",
      "category": "Defense",
      "price": 30,
      "text_in_run": "1/room (bonus action), heal 2d8 + PB.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "Sustain"]
    },
    {
      "id": "relic_second_wind_flask_G",
      "name": "Second Wind Flask (Greater)",
      "rarity": "Greater",
      "category": "Defense",
      "price": 50,
      "text_in_run": "1/room (bonus action), heal 4d8 + PB and gain temp HP equal to PB.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "TempHP"]
    },
    {
      "id": "relic_second_wind_flask_S",
      "name": "Second Wind Flask (Signature)",
      "rarity": "Signature",
      "category": "Defense",
      "price": 70,
      "text_in_run": "1/room (bonus action), heal 5d8 + PB, gain temp HP equal PB + spell mod, and end one listed condition.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "Cleanse"]
    },
    {
      "id": "relic_phoenix_bead_C",
      "name": "Phoenix Bead",
      "rarity": "Common",
      "category": "Defense",
      "price": 30,
      "text_in_run": "1/room, when you would drop to 0 HP, drop to 1 HP instead.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Survival", "Reaction"]
    },
    {
      "id": "relic_phoenix_bead_G",
      "name": "Phoenix Bead (Greater)",
      "rarity": "Greater",
      "category": "Defense",
      "price": 50,
      "text_in_run": "As common plus gain temp HP equal PB + spell mod and stand up without spending movement.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Survival", "TempHP"]
    },
    {
      "id": "relic_phoenix_bead_S",
      "name": "Phoenix Bead (Signature)",
      "rarity": "Signature",
      "category": "Defense",
      "price": 70,
      "text_in_run": "1/room, instead of dropping to 0 HP, end all conditions, set HP to PB + spell mod, and move up to your speed without provoking.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Survival", "Cleanse"]
    },
    {
      "id": "relic_counterglyph_C",
      "name": "Counterglyph",
      "rarity": "Common",
      "category": "Defense",
      "price": 30,
      "text_in_run": "1/room (reaction), gain +2 AC and advantage on one save until your next turn.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Reaction", "Buff"]
    },
    {
      "id": "relic_counterglyph_G",
      "name": "Counterglyph (Greater)",
      "rarity": "Greater",
      "category": "Defense",
      "price": 50,
      "text_in_run": "1/room (reaction), gain +5 AC vs one attack and Evasion on your next Dex save.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Reaction", "Evasion"]
    },
    {
      "id": "relic_counterglyph_S",
      "name": "Counterglyph (Signature)",
      "rarity": "Signature",
      "category": "Defense",
      "price": 70,
      "text_in_run": "1/room (reaction), negate one attack or single-target spell entirely and gain +2 AC until your next turn.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Reaction", "Spellguard"]
    },

    // Control & Reposition
    {
      "id": "relic_escapists_step_C",
      "name": "Escapist's Step",
      "rarity": "Common",
      "category": "Control",
      "price": 30,
      "text_in_run": "1/room (reaction), before an attack resolves teleport 10 ft and the attack misses.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Teleport", "Reaction"]
    },
    {
      "id": "relic_escapists_step_G",
      "name": "Escapist's Step (Greater)",
      "rarity": "Greater",
      "category": "Control",
      "price": 50,
      "text_in_run": "1/room (reaction), teleport 20 ft; the attack misses. End behind cover to stay hidden from that attacker until you move or act.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Teleport", "Stealth"]
    },
    {
      "id": "relic_escapists_step_S",
      "name": "Escapist's Step (Signature)",
      "rarity": "Signature",
      "category": "Control",
      "price": 70,
      "text_in_run": "1/room (reaction), teleport 30 ft, become invisible until your next turn, then move 10 ft without provoking; the attack misses.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Teleport", "Invisibility"]
    },
    {
      "id": "relic_gravitas_seal_C",
      "name": "Gravitas Seal",
      "rarity": "Common",
      "category": "Control",
      "price": 30,
      "text_in_run": "1/room, your next spell forces one target to make its first save at disadvantage.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Spell", "Disadvantage"]
    },
    {
      "id": "relic_gravitas_seal_G",
      "name": "Gravitas Seal (Greater)",
      "rarity": "Greater",
      "category": "Control",
      "price": 50,
      "text_in_run": "1/room, your next spell imposes disadvantage on up to two targets' first saves and gains +1 DC.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Spell", "Debuff"]
    },
    {
      "id": "relic_gravitas_seal_S",
      "name": "Gravitas Seal (Signature)",
      "rarity": "Signature",
      "category": "Control",
      "price": 70,
      "text_in_run": "1/room, choose one creature—it automatically fails the first save against your next spell.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Control", "Spell", "AutoFail"]
    },

    // Rerolls & Advantage
    {
      "id": "relic_encore_coin_C",
      "name": "Encore Coin",
      "rarity": "Common",
      "category": "Reroll",
      "price": 30,
      "text_in_run": "1/room, reroll one attack, save, or ability check you make.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Reroll", "Luck", "Self"]
    },
    {
      "id": "relic_encore_coin_G",
      "name": "Encore Coin (Greater)",
      "rarity": "Greater",
      "category": "Reroll",
      "price": 50,
      "text_in_run": "1/room, reroll one of your d20s or force an enemy within 60 ft to reroll one attack against you or an ally.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Reroll", "Luck", "Control"]
    },
    {
      "id": "relic_encore_coin_S",
      "name": "Encore Coin (Signature)",
      "rarity": "Signature",
      "category": "Reroll",
      "price": 70,
      "text_in_run": "1/room, turn one of your d20s into a 20 or force an enemy's d20 into a 1 (declare before the roll).",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Reroll", "Luck", "Control"]
    },
    {
      "id": "relic_curators_token_C",
      "name": "Curator's Token",
      "rarity": "Common",
      "category": "Reroll",
      "price": 30,
      "text_in_run": "Each shop: 1 free slot reroll.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Shop", "Reroll", "Economy"]
    },
    {
      "id": "relic_curators_token_G",
      "name": "Curator's Token (Greater)",
      "rarity": "Greater",
      "category": "Reroll",
      "price": 50,
      "text_in_run": "As common plus roll +1 extra option for each stocked slot and pick one.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Shop", "Reroll", "Economy"]
    },
    {
      "id": "relic_curators_token_S",
      "name": "Curator's Token (Signature)",
      "rarity": "Signature",
      "category": "Reroll",
      "price": 70,
      "text_in_run": "Each shop: 1 free full refresh and upgrade one stocked item by one rarity step (to max Signature).",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Shop", "Reroll", "Economy"]
    },

    // Recharge & Resource
    {
      "id": "relic_storm_dial_C",
      "name": "Storm Dial",
      "rarity": "Common",
      "category": "Resource",
      "price": 30,
      "text_in_run": "1/room, treat one Recharge ability as if you rolled a 6.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Resource", "Recharge", "Control"]
    },
    {
      "id": "relic_storm_dial_G",
      "name": "Storm Dial (Greater)",
      "rarity": "Greater",
      "category": "Resource",
      "price": 50,
      "text_in_run": "1/room, refresh up to two different Recharge abilities as if you rolled 6.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Resource", "Recharge", "Control"]
    },
    {
      "id": "relic_storm_dial_S",
      "name": "Storm Dial (Signature)",
      "rarity": "Signature",
      "category": "Resource",
      "price": 70,
      "text_in_run": "1/room, refresh all Recharge abilities and set one short-rest feature to available.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Resource", "Recharge", "Control"]
    },
    {
      "id": "relic_arcane_battery_C",
      "name": "Arcane Battery",
      "rarity": "Common",
      "category": "Resource",
      "price": 30,
      "text_in_run": "1/room, take one additional bonus action on your turn.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "BonusAction", "Resource"]
    },
    {
      "id": "relic_arcane_battery_G",
      "name": "Arcane Battery (Greater)",
      "rarity": "Greater",
      "category": "Resource",
      "price": 50,
      "text_in_run": "1/room, gain one additional action (Attack—one attack, Dash, Disengage, Use an Object, or cast a cantrip).",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Action", "Resource"]
    },
    {
      "id": "relic_arcane_battery_S",
      "name": "Arcane Battery (Signature)",
      "rarity": "Signature",
      "category": "Resource",
      "price": 70,
      "text_in_run": "1/room, gain an additional action and bonus action; the extra action may cast a 1st–3rd-level spell and ignores the no-second-leveled-spell rule.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Action", "Resource"]
    },

    // Economy
    {
      "id": "relic_midas_marker_C",
      "name": "Midas Marker",
      "rarity": "Common",
      "category": "Economy",
      "price": 30,
      "text_in_run": "+5 Scrip on each room clear.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency"]
    },
    {
      "id": "relic_midas_marker_G",
      "name": "Midas Marker (Greater)",
      "rarity": "Greater",
      "category": "Economy",
      "price": 50,
      "text_in_run": "+10 Scrip on each room clear and +10 more on miniboss or boss rooms.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency"]
    },
    {
      "id": "relic_midas_marker_S",
      "name": "Midas Marker (Signature)",
      "rarity": "Signature",
      "category": "Economy",
      "price": 70,
      "text_in_run": "Double all Scrip from room rewards for the rest of the run.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency"]
    },
    {
      "id": "relic_hags_chit_C",
      "name": "Hag's Chit",
      "rarity": "Common",
      "category": "Economy",
      "price": 30,
      "text_in_run": "Shops cost 10% less (minimum −5 Scrip).",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Discount", "Shop"]
    },
    {
      "id": "relic_hags_chit_G",
      "name": "Hag's Chit (Greater)",
      "rarity": "Greater",
      "category": "Economy",
      "price": 50,
      "text_in_run": "Shops cost 20% less (minimum −10 Scrip); vendor refresh costs 25.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Discount", "Shop"]
    },
    {
      "id": "relic_hags_chit_S",
      "name": "Hag's Chit (Signature)",
      "rarity": "Signature",
      "category": "Economy",
      "price": 70,
      "text_in_run": "Shops cost 30% less (minimum −10); first slot reroll per vendor is free; buy one item per visit at half price.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Discount", "Shop"]
    },

    // Crit & Momentum
    {
      "id": "relic_edge_sight_C",
      "name": "Edge Sight",
      "rarity": "Common",
      "category": "Momentum",
      "price": 30,
      "text_in_run": "1/room, declare Keen—your next weapon attack crits on 19–20.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Crit", "Martial"]
    },
    {
      "id": "relic_edge_sight_G",
      "name": "Edge Sight (Greater)",
      "rarity": "Greater",
      "category": "Momentum",
      "price": 50,
      "text_in_run": "1/room, your next weapon attack crits on 18–20 and gains +PB to hit.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Crit", "Martial"]
    },
    {
      "id": "relic_edge_sight_S",
      "name": "Edge Sight (Signature)",
      "rarity": "Signature",
      "category": "Momentum",
      "price": 70,
      "text_in_run": "1/room, declare a Perfect Strike—your next weapon attack this turn is an automatic critical on a hit.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Crit", "Martial"]
    },
    {
      "id": "relic_spell_keystone_C",
      "name": "Spell Keystone",
      "rarity": "Common",
      "category": "Momentum",
      "price": 30,
      "text_in_run": "1/room, your next spell attack has advantage or one target takes −2 on its first save versus your next spell.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Spell", "Accuracy"]
    },
    {
      "id": "relic_spell_keystone_G",
      "name": "Spell Keystone (Greater)",
      "rarity": "Greater",
      "category": "Momentum",
      "price": 50,
      "text_in_run": "1/room, your next spell attack has advantage and +PB to hit, or up to two targets take −2 on their first save versus your next spell.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Spell", "Accuracy"]
    },
    {
      "id": "relic_spell_keystone_S",
      "name": "Spell Keystone (Signature)",
      "rarity": "Signature",
      "category": "Momentum",
      "price": 70,
      "text_in_run": "1/room, choose: your next spell attack hits automatically or one creature automatically fails the first save versus your next spell.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Momentum", "Spell", "Accuracy"]
    }
  ];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function buildBucketsFrom(entries) {
    var buckets = {};
    (entries || []).forEach(function (entry) {
      var rarity = entry.rarity || 'Common';
      if (!buckets[rarity]) {
        buckets[rarity] = [];
      }
      buckets[rarity].push(deepClone(entry));
    });
    return buckets;
  }

  function getAll() {
    return deepClone(RELIC_CATALOG);
  }

  function getRarityBuckets() {
    return buildBucketsFrom(RELIC_CATALOG);
  }

  function register() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }

    var relics = getAll();
    state.HoardRun.relics = relics;
    state.HoardRun.relicBuckets = buildBucketsFrom(relics);
    info('Loaded ' + relics.length + ' relics.');
  }

  on('ready', register);

  return {
    getAll: getAll,
    getRarityBuckets: getRarityBuckets,
    register: register
  };
})();
