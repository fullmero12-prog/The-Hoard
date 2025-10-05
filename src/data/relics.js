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

  var RELIC_CATALOG = [
    {
      "id": "relic_quickcast_signet_C",
      "name": "Quickcast Signet",
      "rarity": "Common",
      "category": "Tempo",
      "price": 30,
      "text_in_run": "Once per room, you may cast a cantrip as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },
    {
      "id": "relic_quickcast_signet_G",
      "name": "Quickcast Signet (Greater)",
      "rarity": "Greater",
      "category": "Tempo",
      "price": 50,
      "text_in_run": "Twice per room, you may cast a cantrip as a bonus action. Regains 1 use after defeating an enemy.",
      "uses": { "cadence": "per_room", "value": 2 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },
    {
      "id": "relic_quickcast_signet_S",
      "name": "Quickcast Signet (Signature)",
      "rarity": "Signature",
      "category": "Tempo",
      "price": 70,
      "text_in_run": "Once per turn, cast any spell of 2nd level or lower as a bonus action (1/room).",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Tempo", "Casting", "BonusAction"]
    },

    {
      "id": "relic_second_wind_flask_C",
      "name": "Second Wind Flask",
      "rarity": "Common",
      "category": "Defense",
      "price": 25,
      "text_in_run": "Once per room, heal 2d8 HP as a bonus action.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "Sustain"]
    },
    {
      "id": "relic_second_wind_flask_G",
      "name": "Second Wind Flask (Greater)",
      "rarity": "Greater",
      "category": "Defense",
      "price": 45,
      "text_in_run": "Heal 4d8 HP and cleanse 1 condition once per room.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "Cleanse"]
    },
    {
      "id": "relic_second_wind_flask_S",
      "name": "Second Wind Flask (Signature)",
      "rarity": "Signature",
      "category": "Defense",
      "price": 70,
      "text_in_run": "Heal 5d8 HP, cleanse all conditions, and gain resistance to all damage until the start of your next turn (1/room).",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Defense", "Healing", "Cleanse", "Resistance"]
    },

    {
      "id": "relic_encore_coin_C",
      "name": "Encore Coin",
      "rarity": "Common",
      "category": "Reroll",
      "price": 30,
      "text_in_run": "Once per room, reroll any d20 you roll (you must use the new result).",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Reroll", "Dice", "Control"]
    },
    {
      "id": "relic_encore_coin_G",
      "name": "Encore Coin (Greater)",
      "rarity": "Greater",
      "category": "Reroll",
      "price": 50,
      "text_in_run": "Twice per room, reroll any d20 you or an ally roll.",
      "uses": { "cadence": "per_room", "value": 2 },
      "tags": ["Reroll", "Dice", "AllySupport"]
    },
    {
      "id": "relic_encore_coin_S",
      "name": "Encore Coin (Signature)",
      "rarity": "Signature",
      "category": "Reroll",
      "price": 70,
      "text_in_run": "Once per room, reroll any d20 (you choose which result to keep). If both are 20s, gain +1 FSE.",
      "uses": { "cadence": "per_room", "value": 1 },
      "tags": ["Reroll", "Luck", "ResourceGain"]
    },

    {
      "id": "relic_midas_marker_C",
      "name": "Midas Marker",
      "rarity": "Common",
      "category": "Economy",
      "price": 25,
      "text_in_run": "Gain +5 Scrip after every room.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency"]
    },
    {
      "id": "relic_midas_marker_G",
      "name": "Midas Marker (Greater)",
      "rarity": "Greater",
      "category": "Economy",
      "price": 45,
      "text_in_run": "Gain +10 Scrip after every room and +1 reroll token at the first shop.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency", "Reroll"]
    },
    {
      "id": "relic_midas_marker_S",
      "name": "Midas Marker (Signature)",
      "rarity": "Signature",
      "category": "Economy",
      "price": 70,
      "text_in_run": "Gain +15 Scrip after every room. Shop rerolls cost 0 once per visit.",
      "uses": { "cadence": "per_room", "value": 0 },
      "tags": ["Economy", "Currency", "Discount"]
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
    log('[RelicDataLoader] Loaded ' + relics.length + ' relics.');
  }

  on('ready', register);

  return {
    getAll: getAll,
    getRarityBuckets: getRarityBuckets,
    register: register
  };
})();
