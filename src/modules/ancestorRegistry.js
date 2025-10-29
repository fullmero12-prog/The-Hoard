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

    entry.boons = entry.boons || null;

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
      html: '<div style="font-family:inherit;font-size:13px;line-height:1.25;"><h3 style="margin:0 0 6px 0;">Vladren Moroi — The Crimson Tide</h3><b>Crimson Pact.</b> Excess healing becomes <b>temp HP</b> (cap <b>5×PB + spell mod</b>). While you have Pact temp HP: <b>+1 AC</b>; your <b>necrotic ignores resistance</b> (treat immunity as resistance).<br><br><b>Transfusion (Bonus, 1/turn).</b> One creature within <b>60 ft</b> makes a <b>Con save</b>. Fail: <b>2d8 necrotic + PB</b> (success half). You <b>heal</b> for the damage dealt. If the target is <b>½ HP or less</b>, Transfusion deals <b>+1d8 necrotic</b>.<br><br><b>Sanguine Pool (Reaction, 1/room).</b> When you take damage, become <b>blood mist</b> until the start of your next turn: <b>resistance to all</b>, you can <b>move through creatures</b>, you <b>can’t cast leveled spells or make attacks</b>, and <b>enemies can’t make OAs</b> against you.<br><br><b>Hemoplague (1/room).</b> <b>20-ft radius</b> point within 60 ft, Con save → target is <b>Plagued</b> until end of next turn (<b>+PB damage</b> from all sources), then it takes <b>6d6 necrotic</b> (success <b>3d6</b>). You <b>heal</b> for the total necrotic; excess healing becomes <b>Pact temp HP</b>.</div>',
      alwaysPreparedSpells: [],
      empowerments: []
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
    if (typeof BoonData !== 'undefined' && BoonData && typeof BoonData.getDecks === 'function') {
      return BoonData.getDecks();
    }

    var decks = {};
    var keys = Object.keys(_entries);
    for (var i = 0; i < keys.length; i += 1) {
      var entry = _entries[keys[i]];
      var deckKey = entry.boonKey;
      var stored = entry.boons ? clone(entry.boons) : { Common: [], Greater: [], Signature: [] };
      decks[deckKey] = stored;
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

