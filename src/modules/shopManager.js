// ------------------------------------------------------------
// Shop Manager (Unified: Bing, Bang & Bongo)
// ------------------------------------------------------------
// What this does (in simple terms):
//   Builds and manages the 4-slot shop shown after Room 3 and 5.
//   Handles Relics, Boons, rerolls, and Bongo’s Square trades.
//
//   Bing = Relics  (3 slots)
//   Bang = Boon   (Always offered, fixed price)
//   Bongo = Square trade counter
// ------------------------------------------------------------

var ShopManager = (function () {

  const RELIC_RARITY_WEIGHTS = { C: 45, G: 40, S: 15 };
  const RELIC_PRICES = { C: 30, G: 50, S: 70 };
  const BOON_PRICE = 65;
  const BOON_RARITY_WEIGHTS = { C: 45, G: 40, S: 15 };
  const COST_REROLL_SLOT = 15;
  const COST_REROLL_FULL = 35;
  const MAX_SLOT_REROLLS = 2;
  const MAX_FULL_REROLLS = 1;

  const SHOP_RARITY_STYLES = {
    Common: {
      bg: '#0f2d1f',
      fg: '#e7fff1',
      border: '#1f6844',
      badgeBg: '#1aa567',
      badgeFg: '#ffffff',
      buttonBg: '#1aa567',
      buttonBorder: '#0d4a32',
      buttonFg: '#ffffff'
    },
    Greater: {
      bg: '#0e2140',
      fg: '#e6f2ff',
      border: '#1d4e89',
      badgeBg: '#2a7bdc',
      badgeFg: '#ffffff',
      buttonBg: '#2a7bdc',
      buttonBorder: '#163c9d',
      buttonFg: '#ffffff'
    },
    Signature: {
      bg: '#3b2208',
      fg: '#fff2e0',
      border: '#7a4513',
      badgeBg: '#ff8a00',
      badgeFg: '#1f1203',
      buttonBg: '#ff8a00',
      buttonBorder: '#aa5500',
      buttonFg: '#1f1203'
    },
    Upgrade: {
      bg: '#241b38',
      fg: '#f4edff',
      border: '#4a3281',
      badgeBg: '#7f5af0',
      badgeFg: '#ffffff',
      buttonBg: '#7f5af0',
      buttonBorder: '#4f2fc1',
      buttonFg: '#ffffff'
    },
    Utility: {
      bg: '#1b2428',
      fg: '#f0f3f5',
      border: '#36535f',
      badgeBg: '#4a6570',
      badgeFg: '#f0f3f5',
      buttonBg: '#35515c',
      buttonBorder: '#4a6b77',
      buttonFg: '#f0f3f5'
    }
  };

  function deepClone(value) {
    if (value === null || typeof value === 'undefined') {
      return value;
    }
    if (typeof value !== 'object') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeEffectId(value) {
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    if (typeof value === 'string') {
      return value.trim() || null;
    }
    return String(value);
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  function decodeHtmlEntities(text) {
    if (!text) {
      return '';
    }
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function normalizeGMNotes(raw) {
    if (!raw) {
      return '';
    }

    var text = String(raw).trim();
    if (!text) {
      return '';
    }

    try {
      text = decodeURIComponent(text);
    } catch (err) {
      // ignore decode errors, keep original text
    }

    text = decodeHtmlEntities(text);

    if (/^<[^>]+>/.test(text)) {
      text = text.replace(/<[^>]*>/g, '');
    }

    return text.trim();
  }

  function extractCardText(card) {
    if (!card) {
      return '';
    }

    if (card.text_in_run) {
      return card.text_in_run;
    }
    if (card.description) {
      return card.description;
    }
    if (typeof card.get === 'function') {
      var noteText = normalizeGMNotes(card.get('notes'));
      if (noteText) {
        return noteText;
      }

      var gmnoteText = normalizeGMNotes(card.get('gmnotes'));
      if (gmnoteText) {
        return gmnoteText;
      }
    }

    return '';
  }

  function extractRelicDescription(slot, card) {
    if (slot && slot.relicAdapter && slot.relicAdapter.inventory && slot.relicAdapter.inventory.description) {
      return slot.relicAdapter.inventory.description;
    }
    if (slot && slot.cardData && slot.cardData.inventory && slot.cardData.inventory.description) {
      return slot.cardData.inventory.description;
    }
    if (slot && slot.cardData && slot.cardData.text_in_run) {
      return slot.cardData.text_in_run;
    }
    if (slot && slot.cardData && slot.cardData.description) {
      return slot.cardData.description;
    }
    if (slot && slot.description) {
      return slot.description;
    }

    return extractCardText(card);
  }

  function extractBoonDescription(slot, card) {
    if (slot && slot.cardData && slot.cardData.text_in_run) {
      return slot.cardData.text_in_run;
    }
    if (slot && slot.cardData && slot.cardData.description) {
      return slot.cardData.description;
    }
    if (slot && slot.description) {
      return slot.description;
    }

    return extractCardText(card);
  }

  function findEffectIdInObject(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    var queue = [value];
    while (queue.length) {
      var current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(current, 'effectId')) {
        var candidate = normalizeEffectId(current.effectId);
        if (candidate) {
          return candidate;
        }
      }

      if (Object.prototype.hasOwnProperty.call(current, 'effect_id')) {
        var candidate = normalizeEffectId(current.effect_id);
        if (candidate) {
          return candidate;
        }
      }

      if (Object.prototype.hasOwnProperty.call(current, 'id')) {
        var candidate = normalizeEffectId(current.id);
        if (candidate) {
          return candidate;
        }
      }

      for (var key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          queue.push(current[key]);
        }
      }
    }

    return null;
  }

  function resolveEffectIdFromCard(card) {
    if (!card || typeof card.get !== 'function') {
      return null;
    }

    var attr = normalizeEffectId(card.get('hr_effect_id'));
    if (attr) {
      return attr;
    }

    var gmnotes = normalizeGMNotes(card.get('gmnotes'));
    if (!gmnotes) {
      return null;
    }

    var parsed = safeJsonParse(gmnotes);
    if (parsed) {
      var fromObject = findEffectIdInObject(parsed);
      if (fromObject) {
        return fromObject;
      }
    }

    var match = gmnotes.match(/effect[_\-]?id"?\s*[:=]\s*"?([A-Za-z0-9_:\-]+)/i);
    if (match && match[1]) {
      return normalizeEffectId(match[1]);
    }

    return null;
  }

  function canonAncestorName(name) {
    return (name || '').replace(/[^A-Za-z0-9]/g, '');
  }

  function findBoonDeck(decks, key) {
    if (!decks || !key) {
      return null;
    }

    if (decks[key]) {
      return { name: key, deck: decks[key] };
    }

    const lower = String(key).toLowerCase();
    for (const label in decks) {
      if (!Object.prototype.hasOwnProperty.call(decks, label)) {
        continue;
      }
      if (String(label).toLowerCase() === lower) {
        return { name: label, deck: decks[label] };
      }
    }

    return null;
  }

  function getPlayerDisplayName(playerid) {
    const player = getObj("player", playerid);
    return player ? player.get("_displayname") : "Unknown";
  }

  function whisper(playerid, message) {
    const name = getPlayerDisplayName(playerid);
    sendChat("Hoard Run", `/w "${name}" ${message}`);
  }

  function whisperGM(message) {
    sendChat("Hoard Run", `/w gm ${message}`);
  }

  function isGMPlayer(playerid) {
    return typeof isGM === "function" ? isGM(playerid) : false;
  }

  /** Retrieve or initialize the persistent shop container */
  function getShopState() {
    StateManager.init();
    if (!state.HoardRun.shops) {
      state.HoardRun.shops = {};
    }
    return state.HoardRun.shops;
  }

  function getAncestorDeckInfo(playerid) {
    const fallbackAncestor = 'Azuren';
    let ancestorName = fallbackAncestor;

    try {
      const ps = StateManager.getPlayer(playerid);
      if (ps && ps.ancestor_id) {
        ancestorName = ps.ancestor_id;
      } else if (state.HoardRun && state.HoardRun.runFlow && state.HoardRun.runFlow.ancestor) {
        ancestorName = state.HoardRun.runFlow.ancestor;
      }
    } catch (err) {
      // default fallback already applied
    }

    const key = canonAncestorName(ancestorName);
    return {
      name: ancestorName,
      key: key || canonAncestorName(fallbackAncestor)
    };
  }

  function pickFromPool(pool) {
    if (!pool || !pool.length) {
      return null;
    }
    const index = randomInteger(pool.length) - 1;
    return pool[index];
  }

  function drawRelicFromCatalog(rarityLabel) {
    const label = rarityLabel || 'Common';
    let buckets = null;

    if (state.HoardRun && state.HoardRun.relicBuckets) {
      buckets = state.HoardRun.relicBuckets;
    } else if (typeof RelicData !== 'undefined' && RelicData.getRarityBuckets) {
      buckets = RelicData.getRarityBuckets();
    }

    if (!buckets || !buckets[label] || !buckets[label].length) {
      return null;
    }

    const entry = pickFromPool(buckets[label]);
    if (!entry) {
      return null;
    }

    const clone = JSON.parse(JSON.stringify(entry));
    if (clone && typeof clone === 'object') {
      if (!clone.effectId && clone.effect_id) {
        clone.effectId = clone.effect_id;
      }
      if (!clone.effectId && clone.id) {
        clone.effectId = clone.id;
      }
    }

    return {
      id: clone.id || (clone.name + '_' + label),
      name: clone.name,
      data: clone,
      deckSource: 'Relics.' + label,
      isStub: true
    };
  }

  function drawBoonFromCatalog(ancestorKey, rarityLabel, ancestorName) {
    if (!ancestorKey) {
      return null;
    }

    let decks = null;
    if (typeof BoonManager !== 'undefined' && BoonManager && typeof BoonManager.ensureDeckCache === 'function') {
      decks = BoonManager.ensureDeckCache(ancestorKey);
    } else {
      if (!state.HoardRun) {
        state.HoardRun = {};
      }
      decks = state.HoardRun.boons || {};
      if (!findBoonDeck(decks, ancestorKey) && typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getBoonDecks === 'function') {
        decks = AncestorRegistry.getBoonDecks() || {};
        state.HoardRun.boons = decks;
      }
    }

    const deckInfo = findBoonDeck(decks, ancestorKey);
    if (!deckInfo) {
      return null;
    }

    const deck = deckInfo.deck;
    const label = rarityLabel || 'Common';
    const pool = deck[label];
    if (!pool || !pool.length) {
      return null;
    }

    const entry = pickFromPool(pool);
    if (!entry) {
      return null;
    }

    const clone = JSON.parse(JSON.stringify(entry));
    if (ancestorName && !clone.ancestor) {
      clone.ancestor = ancestorName;
    }

    const resolvedKey = deckInfo.name || ancestorKey;

    return {
      id: clone.id || (resolvedKey + '_' + label + '_' + randomInteger(10000)),
      name: clone.name,
      data: clone,
      deckSource: 'Boons.' + resolvedKey + '.' + label,
      isStub: true
    };
  }

  /** Retrieves the current player's shop object */
  function getPlayerShop(playerid) {
    const store = getShopState();
    if (!store[playerid]) {
      store[playerid] = {
        tier: getShopTier(playerid),
        slots: [],
        rerollSlotCount: 0,
        rerollFullCount: 0
      };
    }
    return store[playerid];
  }

  function getKnownPlayerIds() {
    StateManager.init();
    const players = state.HoardRun.players || {};
    return Object.keys(players);
  }

  function getOnlinePlayerIds() {
    const roster = [];
    const players = findObjs({ _type: "player" }) || [];
    players.forEach(p => {
      try {
        if (p.get("online")) {
          roster.push(p.id);
        }
      } catch (err) {
        // ignore sandbox errors fetching online flag
      }
    });
    return roster;
  }

  function resolveShopTargets(args) {
    const tokens = (args || []).filter(Boolean);
    if (!tokens.length) {
      const known = getKnownPlayerIds();
      if (known.length) {
        return known;
      }
      return getOnlinePlayerIds();
    }

    const resolved = [];
    const seen = {};
    const candidates = findObjs({ _type: "player" }) || [];

    function push(id) {
      if (id && !seen[id]) {
        resolved.push(id);
        seen[id] = true;
      }
    }

    tokens.forEach(token => {
      const direct = state.HoardRun.players && state.HoardRun.players[token] ? token : null;
      if (direct) {
        push(direct);
        return;
      }

      const normalized = token.replace(/_/g, " ").toLowerCase();
      for (let i = 0; i < candidates.length; i += 1) {
        const player = candidates[i];
        const name = String(player.get("_displayname") || "").toLowerCase();
        if (name === normalized) {
          push(player.id);
          return;
        }
      }
    });

    return resolved;
  }

  /** Determine shop number (1 or 2) based on room index */
  function getShopTier(playerid) {
    const ps = StateManager.getPlayer(playerid);
    return ps.currentRoom >= 5 ? 2 : 1;
  }

  function rollByWeightTable(weights) {
    if (!weights) {
      return "C";
    }

    const total = (weights.C || 0) + (weights.G || 0) + (weights.S || 0);
    if (!total) {
      return "C";
    }

    const roll = randomInteger(total);
    let threshold = weights.C || 0;
    if (roll <= threshold) {
      return "C";
    }

    threshold += weights.G || 0;
    if (roll <= threshold) {
      return "G";
    }

    return "S";
  }

  /** Rolls rarity for a relic slot */
  function rollRelicRarity() {
    return rollByWeightTable(RELIC_RARITY_WEIGHTS);
  }

  /** Creates a generic slot payload */
  function buildSlot(type, rarity, card, price, extras) {
    if (!card) {
      return null;
    }

    var id = typeof card.id !== "undefined" ? card.id : "";
    var name = typeof card.get === "function" ? card.get("name") : card.name;
    var slot = {
      type: type,
      rarity: rarity,
      cardId: id,
      cardName: name,
      price: price
    };

    var payload = null;
    if (card.isStub) {
      slot.isStub = true;
      payload = card.data || null;
      slot.cardData = payload;
      slot.deckSource = card.deckSource || null;
    }

    if (extras) {
      Object.keys(extras).forEach(function (key) {
        if (key === "relicPayload") {
          return;
        }
        slot[key] = extras[key];
      });
    }

    if (type === "relic") {
      var relicPayload = null;
      if (extras && extras.relicPayload) {
        relicPayload = deepClone(extras.relicPayload);
      } else if (card.relicPayload) {
        relicPayload = deepClone(card.relicPayload);
      } else if (payload && typeof RelicData !== 'undefined' && RelicData && typeof RelicData.buildRelicPayload === 'function') {
        relicPayload = RelicData.buildRelicPayload(payload);
      }

      if (!relicPayload && typeof RelicData !== "undefined" && RelicData && typeof RelicData.buildRelicPayload === 'function') {
        var candidate = slot.relicId || (payload && payload.id) || null;
        if (!candidate && card && typeof card.get === "function") {
          var gmnotes = normalizeGMNotes(card.get('gmnotes'));
          var gmParsed = safeJsonParse(gmnotes);
          if (gmParsed && (gmParsed.id || gmParsed.relicId || gmParsed.name)) {
            candidate = gmParsed.id || gmParsed.relicId || gmParsed.name;
          }
        }
        if (!candidate && name) {
          candidate = name;
        }
        relicPayload = RelicData.buildRelicPayload(candidate);
      }

      if (relicPayload) {
        slot.relicId = relicPayload.id;
        slot.relicAdapter = deepClone(relicPayload);
        if (!slot.description && relicPayload.inventory && relicPayload.inventory.description) {
          slot.description = relicPayload.inventory.description;
        }
        if (!slot.cardData && payload) {
          slot.cardData = payload;
        }
        if (!slot.effectId) {
          slot.effectId = relicPayload.id;
        }
      }
    } else {
      var effectId = null;

      if (card.isStub) {
        if (payload && typeof payload === 'object') {
          if (!payload.effectId && payload.effect_id) {
            payload.effectId = payload.effect_id;
          }
          if (!payload.effectId && payload.id) {
            payload.effectId = payload.id;
          }
          effectId = normalizeEffectId(payload.effectId);
        }
        if (!effectId && card.effectId) {
          effectId = normalizeEffectId(card.effectId);
        }
      } else {
        effectId = resolveEffectIdFromCard(card);
      }

      if (!effectId && slot.cardData && slot.cardData.effectId) {
        effectId = normalizeEffectId(slot.cardData.effectId);
      }

      if (!effectId && extras && Object.prototype.hasOwnProperty.call(extras, 'effectId')) {
        effectId = normalizeEffectId(extras.effectId);
      }

      if (effectId) {
        slot.effectId = effectId;
      }
    }

    return slot;
  }

  function getRelicAdapterForSlot(slot, card) {
    if (!slot || slot.type !== "relic") {
      return null;
    }

    if (slot.relicAdapter) {
      return deepClone(slot.relicAdapter);
    }

    if (typeof RelicData === "undefined" || !RelicData || typeof RelicData.buildRelicPayload !== 'function') {
      return null;
    }

    if (slot.relicId) {
      var byId = RelicData.buildRelicPayload(slot.relicId);
      if (byId) {
        return byId;
      }
    }

    if (slot.cardData) {
      var fromData = RelicData.buildRelicPayload(slot.cardData);
      if (fromData) {
        return fromData;
      }
    }

    if (card && typeof card.get === "function") {
      var gmnotes = normalizeGMNotes(card.get('gmnotes'));
      var parsed = safeJsonParse(gmnotes);
      if (parsed) {
        var fromNotes = RelicData.buildRelicPayload(parsed.id || parsed.relicId || parsed.name || parsed);
        if (fromNotes) {
          return fromNotes;
        }
      }
    }

    if (slot.cardName) {
      var fromName = RelicData.buildRelicPayload(slot.cardName);
      if (fromName) {
        return fromName;
      }
    }

    return null;
  }

  /** Builds the boon slot */
  function createSpecialSlot(playerid) {
    const rarity = rollByWeightTable(BOON_RARITY_WEIGHTS);
    const rarityLabel = rarity === "C" ? "Common" : (rarity === "G" ? "Greater" : "Signature");
    const ancestorInfo = getAncestorDeckInfo(playerid);
    let card = null;

    if (ancestorInfo.key) {
      card = DeckManager.drawOne('Boons.' + ancestorInfo.key + '.' + rarityLabel);
    }

    if (!card) {
      card = drawBoonFromCatalog(ancestorInfo.key, rarityLabel, ancestorInfo.name);
    }

    if (!card) {
      return null;
    }

    const extras = {
      ancestorName: ancestorInfo.name,
      rarityName: rarityLabel
    };

    return buildSlot("boon", rarity, card, BOON_PRICE, extras);
  }

  /** Builds a relic slot */
  function createRelicSlot() {
    const rarity = rollRelicRarity();
    const deckName = rarity === "C"
      ? "Relics.Common"
      : rarity === "G"
        ? "Relics.Greater"
        : "Relics.Signature";
    let card = DeckManager.drawOne(deckName);
    if (!card) {
      const rarityLabel = rarity === "C" ? "Common" : (rarity === "G" ? "Greater" : "Signature");
      card = drawRelicFromCatalog(rarityLabel);
    }
    if (!card) return null;

    const extras = {};
    var price = RELIC_PRICES[rarity];
    if (card.isStub && card.data && typeof card.data.price === "number") {
      price = card.data.price;
    }

    if (card.isStub) {
      extras.isStub = true;
      extras.cardData = card.data;
      extras.deckSource = card.deckSource;
      if (card.relicPayload) {
        extras.relicPayload = card.relicPayload;
      }
    }

    return buildSlot("relic", rarity, card, price, extras);
  }

  /** Generates the 4-slot shop layout */
  function createSlots(playerid) {
    const slots = [];
    const special = createSpecialSlot(playerid);
    if (special) {
      slots.push(special);
    }

    for (let i = 0; i < 3; i++) {
      const relicSlot = createRelicSlot();
      if (relicSlot) {
        slots.push(relicSlot);
      }
    }

    return slots;
  }

  /** Generates a full 4-slot shop */
  function generateShop(playerid) {
    const tier = getShopTier(playerid);
    const shop = getPlayerShop(playerid);
    shop.tier = tier;
    shop.slots = createSlots(playerid);
    shop.rerollSlotCount = 0;
    shop.rerollFullCount = 0;
    return shop.slots;
  }

  /** Opens the shop UI, optionally forcing a fresh set of slots. */
  function openFor(playerid, forceRefresh) {
    let shop = getPlayerShop(playerid);
    if (forceRefresh) {
      generateShop(playerid);
    } else if (!shop.slots || !shop.slots.length) {
      generateShop(playerid);
    }
    shop = getPlayerShop(playerid);
    showShop(playerid, shop.slots);
    return shop.slots;
  }

  /** Shows the current shop offers in chat */
  function showShop(playerid, slots) {
    const displayName = getPlayerDisplayName(playerid) || "Player";
    const safeName = `"${String(displayName).replace(/"/g, '\\"')}"`;

    const shop = getPlayerShop(playerid);
    const existing = Array.isArray(slots) ? slots : null;
    const entries = existing && existing.length ? existing : (shop.slots.length ? shop.slots : generateShop(playerid));
    const currencies = StateManager.getCurrencies(playerid) || {};
    const scripTotal = typeof currencies.scrip !== "undefined" ? currencies.scrip : 0;

    const itemBlocks = (entries || []).map((slot, index) => renderShopSlot(slot, index)).join('');
    const itemsHTML = itemBlocks || '<div style="font-size:11px;opacity:0.75;">No offers are available right now.</div>';
    const footer = renderRerollSection(shop, entries || []);

    const body = '<div style="font-size:12px;line-height:1.4;">'
      + '<div style="margin-bottom:10px;font-size:11px;opacity:0.85;">Current Scrip: <b>' + htmlEscape(String(scripTotal)) + '</b></div>'
      + itemsHTML
      + footer
      + '</div>';

    const title = 'Unified Shop — Bing, Bang & Bongo';

    if (UIManager && UIManager.whisper) {
      UIManager.whisper(safeName, title, body);
      return;
    }

    const shell = (UIManager && UIManager.panel)
      ? UIManager.panel(title, body)
      : '<div style="border:1px solid #555;background:#111;padding:8px;color:#eee;">'
        + '<div style="font-weight:bold;margin-bottom:6px;">' + title + '</div>'
        + body
        + '</div>';

    sendChat('Hoard Run', `/w ${safeName} ${shell}`);
  }

  function rarityLabelFor(code) {
    const map = { C: "Common", G: "Greater", S: "Signature" };
    if (!code) {
      return "";
    }
    if (map[code]) {
      return map[code];
    }
    if (typeof code === "string" && map[code.charAt(0)]) {
      return map[code.charAt(0)];
    }
    return code;
  }

  function ensureListIncludes(list, value) {
    const tokens = (list || "").split(",").map(v => v.trim()).filter(Boolean);
    if (tokens.indexOf(value) === -1) {
      tokens.push(value);
    }
    return tokens.join(",");
  }

  function grantHandoutAccess(handout, playerid) {
    if (!handout || !playerid) {
      return;
    }

    const journals = handout.get("inplayerjournals");
    if (journals !== "all") {
      handout.set("inplayerjournals", ensureListIncludes(journals, playerid));
    }

    const control = handout.get("controlledby");
    if (control !== "all") {
      handout.set("controlledby", ensureListIncludes(control, playerid));
    }
  }

  function htmlEscape(text) {
    if (!text) {
      return "";
    }
    if (typeof _ !== "undefined" && _.escape) {
      return _.escape(text);
    }
    return String(text);
  }

  function normalizeDescription(text) {
    if (!text) {
      return "";
    }
    return htmlEscape(text).replace(/\r?\n/g, "<br>");
  }

  function extractCardDescription(slot, card) {
    if (slot && slot.cardData) {
      if (slot.cardData.text_in_run) {
        return slot.cardData.text_in_run;
      }
      if (slot.cardData.description) {
        return slot.cardData.description;
      }
      if (slot.cardData.text) {
        return slot.cardData.text;
      }
    }

    if (card && typeof card.get === "function") {
      const notes = card.get("notes");
      if (notes) {
        return notes;
      }
      const gmnotes = card.get("gmnotes");
      if (gmnotes) {
        try {
          const parsed = JSON.parse(gmnotes);
          if (parsed && parsed.text_in_run) {
            return parsed.text_in_run;
          }
          if (parsed && parsed.description) {
            return parsed.description;
          }
        } catch (err) {
          // ignore malformed gm notes (not JSON)
        }
      }
    }

    return "";
  }

  function slotTypeLabel(slot) {
    if (!slot) {
      return "Item";
    }
    if (slot.type === "relic") {
      return "Relic";
    }
    if (slot.type === "boon") {
      return "Boon";
    }
    if (slot.type === "upgrade") {
      return "Focus Upgrade";
    }
    return "Item";
  }

  function slotRarityLabel(slot) {
    if (!slot) {
      return "Common";
    }
    if (slot.type === "upgrade") {
      return "Upgrade";
    }
    return rarityLabelFor(slot.rarity) || "Common";
  }

  function slotStyleConfig(slot) {
    const key = slotRarityLabel(slot);
    return SHOP_RARITY_STYLES[key] || SHOP_RARITY_STYLES.Common;
  }

  function renderCommandButton(label, command, style) {
    const sanitized = (command || "").replace(/^!/, "");
    const cfg = style || SHOP_RARITY_STYLES.Utility;
    return '<span style="display:inline-block;margin:4px 4px 0 0;">'
      + '<span style="display:inline-block;padding:6px 10px;border-radius:6px;font-weight:700;font-size:11px;background:' + cfg.buttonBg + ';color:' + cfg.buttonFg + ';border:1px solid ' + cfg.buttonBorder + ';">'
      + '[' + htmlEscape(label) + '](!' + sanitized + ')'
      + '</span>'
      + '</span>';
  }

  function resolveSlotDescription(slot) {
    let card = null;
    if (slot && slot.cardId && typeof getObj === 'function') {
      try {
        card = getObj('card', slot.cardId);
      } catch (err) {
        card = null;
      }
    }

    let description = '';
    if (slot && slot.type === "relic") {
      description = extractRelicDescription(slot, card);
    } else if (slot && slot.type === 'boon') {
      description = extractBoonDescription(slot, card);
    } else {
      description = extractCardDescription(slot, card);
    }
    if (!description && slot && slot.cardData && slot.cardData.summary) {
      description = slot.cardData.summary;
    }

    if (!description) {
      if (slot && slot.type === 'upgrade') {
        description = 'Upgrade details will appear in your journal handout upon purchase.';
      } else if (slot && slot.type === 'boon') {
        description = 'Boon effects will match the ancestor handout you receive.';
      } else {
        description = 'No description is available yet. Consult the GM for details.';
      }
    }

    return normalizeDescription(description);
  }

  function renderShopSlot(slot, index) {
    if (!slot) {
      return '';
    }

    const style = slotStyleConfig(slot);
    const rarityText = slotRarityLabel(slot);
    const typeLabel = slotTypeLabel(slot);
    const slotNumber = index + 1;
    const name = htmlEscape(slot.cardName || 'Unknown Item');
    const badge = '<span style="padding:2px 6px;border-radius:6px;font-size:11px;font-weight:700;background:' + style.badgeBg + ';color:' + style.badgeFg + ';">'
      + htmlEscape(rarityText)
      + '</span>';

    const metaParts = [];
    metaParts.push('Slot ' + slotNumber);
    metaParts.push(typeLabel);
    if (slot.type !== 'upgrade') {
      metaParts.push('Rarity: ' + rarityText);
    }
    if (typeof slot.price !== 'undefined') {
      metaParts.push('Cost: ' + slot.price + ' Scrip');
    }
    if (slot.type === 'boon' && slot.ancestorName) {
      metaParts.push('Ancestor: ' + slot.ancestorName);
    }
    const meta = '<div style="font-size:11px;opacity:0.8;margin-bottom:6px;">' + htmlEscape(metaParts.join(' • ')) + '</div>';

    const description = resolveSlotDescription(slot);
    const command = '!buy ' + slot.type + ' ' + slot.cardId;
    const buttonLabel = typeof slot.price === 'number' ? ('Buy – ' + slot.price + ' Scrip') : 'Buy Item';
    const button = renderCommandButton(buttonLabel, command, style);

    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">'
      + '<div style="font-weight:700;font-size:14px;line-height:1.2;">' + name + '</div>'
      + badge
      + '</div>';

    return '<div style="border:1px solid ' + style.border + ';background:' + style.bg + ';color:' + style.fg + ';padding:10px 12px;border-radius:8px;margin-bottom:10px;">'
      + header
      + meta
      + '<div style="margin-bottom:8px;line-height:1.35;">' + description + '</div>'
      + button
      + '</div>';
  }

  function renderRerollSection(shop, entries) {
    const style = SHOP_RARITY_STYLES.Utility;
    const parts = [];
    parts.push('<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Rerolls & Trades</div>');
    parts.push('<div style="font-size:11px;opacity:0.85;margin-bottom:6px;">Slot rerolls remaining: ' + Math.max(0, MAX_SLOT_REROLLS - shop.rerollSlotCount) + ' (Cost ' + COST_REROLL_SLOT + ' Scrip each)</div>');

    let slotButtons = '';
    (entries || []).forEach((slot, idx) => {
      slotButtons += renderCommandButton('Reroll Slot ' + (idx + 1), '!reroll slot ' + (idx + 1), style);
    });
    if (!slotButtons) {
      slotButtons = '<div style="font-size:11px;opacity:0.7;">No slots are available to reroll.</div>';
    }
    parts.push(slotButtons);

    parts.push('<div style="margin-top:8px;font-size:11px;opacity:0.85;">Full refresh remaining: ' + Math.max(0, MAX_FULL_REROLLS - shop.rerollFullCount) + ' (Cost ' + COST_REROLL_FULL + ' Scrip)</div>');
    parts.push(renderCommandButton('Full Refresh', '!reroll full', style));

    parts.push('<div style="margin-top:10px;font-size:11px;opacity:0.85;">Trade a Square for currency:</div>');
    parts.push(renderCommandButton('Square → Scrip', '!tradeSquares scrip', style));
    parts.push(renderCommandButton('Square → FSE', '!tradeSquares fse', style));

    return '<div style="border:1px solid ' + style.border + ';background:' + style.bg + ';color:' + style.fg + ';padding:10px 12px;border-radius:8px;margin-top:12px;">'
      + parts.join('')
      + '</div>';
  }

  function ensureCardHandout(playerid, slot, card) {
    if (!slot || (slot.type !== "relic" && slot.type !== "boon")) {
      return;
    }

    const title = slot.cardName || (slot.cardData && slot.cardData.name);
    if (!title) {
      return;
    }

    let handout = findObjs({ _type: "handout", name: title })[0];
    if (!handout) {
      handout = createObj("handout", {
        name: title,
        archived: false,
        inplayerjournals: "",
        controlledby: ""
      });
    }

    const rarity = slot.cardData && slot.cardData.rarity
      ? slot.cardData.rarity
      : rarityLabelFor(slot.rarity);
    let description = '';
    if (slot.type === "relic") {
      description = extractRelicDescription(slot, card);
    } else if (slot.type === 'boon') {
      description = extractBoonDescription(slot, card);
    } else {
      description = extractCardDescription(slot, card);
    }

    if (description) {
      const rarityText = rarityLabelFor(rarity);
      const parts = [];
      parts.push('<div style="font-family:inherit;font-size:13px;line-height:1.3;">');
      parts.push('<h3 style="margin:0 0 6px 0;">' + htmlEscape(title) + (rarityText ? ' <span style="font-size:11px;font-weight:600;opacity:0.75;">(' + htmlEscape(rarityText) + ')</span>' : '') + '</h3>');
      parts.push('<div style="margin-bottom:8px;">' + normalizeDescription(description) + '</div>');
      parts.push('<div style="font-size:10px;opacity:0.6;">Auto-generated by Hoard Run.</div>');
      parts.push('</div>');
      handout.set("notes", parts.join(""));
    }

    grantHandoutAccess(handout, playerid);
    return handout;
  }

  /** Validates and locates a slot by card id */
  function findSlot(playerid, cardId) {
    const shop = getPlayerShop(playerid);
    const index = shop.slots.findIndex(s => s.cardId === cardId && !s.sold);
    if (index === -1) return null;
    return { index, slot: shop.slots[index], shop };
  }

  /** Purchase command handler */
  function purchase(playerid, type, cardId) {
    const data = findSlot(playerid, cardId);
    if (!data) {
      whisper(playerid, "That item is no longer available.");
      return;
    }

    const { slot, shop, index } = data;
    if (slot.type !== type) {
      whisper(playerid, "Invalid purchase type.");
      return;
    }

    const playerState = StateManager.getPlayer(playerid);
    if (slot.type === "relic" && playerState.relics.length >= 3) {
      whisper(playerid, "Relic cap reached (3).");
      return;
    }

    if (!StateManager.spendScrip(playerid, slot.price)) {
      return;
    }

    const card = getObj("card", cardId);
    if (!card && !slot.isStub) {
      whisper(playerid, "Could not find that card.");
      playerState.scrip += slot.price;
      return;
    }

    const record = { id: cardId, name: slot.cardName };
    if (slot.cardData) {
      record.data = slot.cardData;
      record.rarity = slot.rarity;
    }
    if (slot.type === "boon" && slot.ancestorName) {
      record.ancestor = slot.ancestorName;
    }

    if (slot.type === "relic") {
      record.description = extractRelicDescription(slot, card);
    } else if (slot.type === "boon") {
      record.description = extractBoonDescription(slot, card);
    }

    var relicAdapter = null;
    if (slot.type === "relic") {
      relicAdapter = getRelicAdapterForSlot(slot, card);
      if (!relicAdapter && typeof RelicData !== 'undefined' && RelicData && typeof RelicData.buildRelicPayload === 'function') {
        relicAdapter = RelicData.buildRelicPayload(record.name || slot.cardName);
      }
      if (relicAdapter) {
        record.relicId = relicAdapter.id;
        record.inventory = deepClone(relicAdapter.inventory);
        record.ability = deepClone(relicAdapter.ability);
      }
    } else {
      var recordEffectId = slot.effectId || null;
      if (!recordEffectId && slot.cardData && slot.cardData.effectId) {
        recordEffectId = slot.cardData.effectId;
      }
      if (!recordEffectId && card) {
        recordEffectId = resolveEffectIdFromCard(card);
      }
      recordEffectId = normalizeEffectId(recordEffectId);
      if (recordEffectId) {
        record.effectId = recordEffectId;
      }
    }

    if (slot.type === "relic") {
      var characterId = playerState ? playerState.boundCharacterId : null;
      var buyerName = getPlayerDisplayName(playerid);
      var relicName = slot.cardName || (relicAdapter && relicAdapter.name) || 'Unknown Relic';
      var relicId = null;

      if (relicAdapter && relicAdapter.id) {
        relicId = relicAdapter.id;
      } else if (slot.relicId) {
        relicId = slot.relicId;
      } else if (record && record.id) {
        relicId = record.id;
      } else if (slot.cardData && slot.cardData.id) {
        relicId = slot.cardData.id;
      } else if (slot.cardName) {
        relicId = slot.cardName;
      }

      var grantResult = null;
      if (typeof RelicItemManager !== 'undefined' && RelicItemManager && typeof RelicItemManager.grantRelic === 'function') {
        grantResult = RelicItemManager.grantRelic({
          playerId: playerid,
          characterId: characterId,
          relicId: relicId,
          displayName: relicName
        });
      } else {
        if (!playerState.relics || !Array.isArray(playerState.relics)) {
          playerState.relics = [];
        }
        var normalizedId = relicId ? String(relicId) : null;
        var exists = false;
        if (normalizedId) {
          for (var x = 0; x < playerState.relics.length; x += 1) {
            if (playerState.relics[x] === normalizedId) {
              exists = true;
              break;
            }
          }
        }
        if (!exists && normalizedId) {
          playerState.relics.push(normalizedId);
        }
        grantResult = { ok: !!normalizedId, warnings: ['manager_unavailable'], reason: normalizedId ? null : 'missing_relic' };
      }

      if (!grantResult || !grantResult.ok) {
        whisper(playerid, 'Relic purchase failed. Your Scrip has been refunded.');
        playerState.scrip += slot.price;
        return;
      }

      if (grantResult.alreadyOwned) {
        whisperGM('Relic "' + relicName + '" bought by ' + buyerName + ' was already recorded for that player.');
      }

      var warningMessages = {
        missing_character: 'has no bound character. Apply sheet changes manually.',
        binder_failed: 'could not sync to the character sheet automatically.',
        binder_unavailable: 'could not sync — RelicBinder unavailable.',
        state_unavailable: 'could not update Hoard Run state.',
        manager_unavailable: 'was granted without RelicItemManager; verify state manually.'
      };

      var warnings = grantResult.warnings || [];
      for (var w = 0; w < warnings.length; w += 1) {
        var code = warnings[w];
        if (Object.prototype.hasOwnProperty.call(warningMessages, code)) {
          whisperGM('Relic "' + relicName + '" for ' + buyerName + ' ' + warningMessages[code]);
        }
      }
    } else if (slot.type === "boon") {
      record.effectInstanceId = null;
      playerState.boons.push(record);

      var boonCharId = playerState && playerState.boundCharacterId;
      var boonName = slot.cardName || 'Ancestor Boon';
      var boonDescription = extractBoonDescription(slot, card);
      var buyer = getPlayerDisplayName(playerid);

      if (!boonCharId) {
        whisperGM('Boon "' + boonName + '" bought by ' + buyer + ' has no bound character. Token action not created.');
      } else {
        var effectApplied = false;
        var effectIdForBoon = normalizeEffectId(
          (record && record.effectId) ||
          slot.effectId ||
          (record && record.data && (record.data.effectId || record.data.id)) ||
          record.id ||
          cardId ||
          slot.cardName
        );

        if (effectIdForBoon && typeof EffectEngine !== 'undefined' && EffectEngine && typeof EffectEngine.apply === 'function') {
          var effectOptions = {
            characterId: boonCharId,
            card: record && record.data ? record.data : (slot.cardData || null),
            description: boonDescription,
            source: {
              type: 'boon',
              ancestor: slot.ancestorName || record.ancestor || null,
              playerId: playerid || null,
              playerName: buyer,
              boonId: record.id || (record.data && (record.data.id || record.data.cardId)) || null,
              boonName: boonName,
              rarity: record.rarity || slot.rarity || null,
              shopPurchase: true
            },
            boon: record
          };

          var boonEffectResult = EffectEngine.apply(effectIdForBoon, effectOptions);
          if (boonEffectResult && boonEffectResult.ok) {
            record.effectInstanceId = boonEffectResult.instanceId || null;
            effectApplied = true;
          } else {
            var effectReason = (boonEffectResult && boonEffectResult.reason) ? boonEffectResult.reason : 'unknown';
            whisperGM('EffectEngine could not apply boon "' + boonName + '" for ' + buyer + ' (reason: ' + effectReason + '). Falling back to legacy macro creation.');
          }
        } else if (effectIdForBoon && (typeof EffectEngine === 'undefined' || !EffectEngine || typeof EffectEngine.apply !== 'function')) {
          whisperGM('EffectEngine unavailable when granting boon "' + boonName + '" for ' + buyer + '. Falling back to legacy macro creation.');
        }

        if (!effectApplied) {
          var boonHelper = (typeof EffectAdaptersDnd5eRoll20 !== 'undefined') ? EffectAdaptersDnd5eRoll20 : null;
          if (!boonHelper) {
            whisperGM('Boon "' + boonName + '" for ' + buyer + ' could not auto-apply — helper unavailable.');
          } else {
            if (typeof boonHelper.ensureBoonAbility === 'function') {
              var boonAbility = boonHelper.ensureBoonAbility(boonCharId, {
                boonName: boonName,
                ancestor: slot.ancestorName,
                description: boonDescription
              });
              if (!boonAbility || !boonAbility.ok) {
                whisperGM('Boon "' + boonName + '" for ' + buyer + ' could not create a token action.');
              }
            }

            if (boonDescription && typeof boonHelper.needsAttributeAssistance === 'function' && boonHelper.needsAttributeAssistance(boonDescription)) {
              if (typeof boonHelper.appendBoonNote === 'function') {
                boonHelper.appendBoonNote(boonCharId, boonName + ': ' + boonDescription);
              }
              whisperGM('Boon "' + boonName + '" for ' + buyer + ' may require manual attribute adjustments.');
            }
          }
        }
      }
    } else if (slot.type === "upgrade") {
      if (!playerState.upgrades) {
        playerState.upgrades = [];
      }
      playerState.upgrades.push(record);
    }

    const handout = ensureCardHandout(playerid, slot, card);
    if (handout) {
      record.handoutId = handout.id;
    }

    shop.slots.splice(index, 1);

    if (StateManager.setPlayer) {
      StateManager.setPlayer(playerid, playerState);
    }

    const note = handout ? ' Handout shared to your journal.' : '';
    whisper(playerid, `Bought **${slot.cardName}** for ${slot.price} Scrip.${note}`);
    showShop(playerid, shop.slots);
  }

  /** Reroll / refresh handlers */
  function reroll(playerid, mode, target) {
    const shop = getPlayerShop(playerid);
    shop.tier = getShopTier(playerid);

    if (mode === "slot") {
      if (shop.rerollSlotCount >= MAX_SLOT_REROLLS) {
        whisper(playerid, "Slot reroll limit reached.");
        return;
      }

      const index = parseInt(target, 10) - 1;
      if (isNaN(index) || index < 0 || index >= shop.slots.length) {
        whisper(playerid, "Choose a valid slot number.");
        return;
      }

      if (!StateManager.spendScrip(playerid, COST_REROLL_SLOT)) {
        return;
      }

      const existing = shop.slots[index];
      let replacement = null;
      if (existing.type === "relic") {
        replacement = createRelicSlot();
      } else {
        replacement = createSpecialSlot(playerid);
      }

      if (!replacement) {
        whisper(playerid, "Unable to reroll that slot right now.");
        const ps = StateManager.getPlayer(playerid);
        ps.scrip += COST_REROLL_SLOT;
        if (StateManager.setPlayer) {
          StateManager.setPlayer(playerid, ps);
        }
        return;
      }

      shop.slots[index] = replacement;
      shop.rerollSlotCount += 1;
      showShop(playerid, shop.slots);
      return;
    }

    if (mode === "full") {
      if (shop.rerollFullCount >= MAX_FULL_REROLLS) {
        whisper(playerid, "Full refresh limit reached.");
        return;
      }

      if (!StateManager.spendScrip(playerid, COST_REROLL_FULL)) {
        return;
      }

      shop.slots = createSlots(playerid);
      shop.rerollFullCount += 1;
      shop.rerollSlotCount = 0;
      showShop(playerid, shop.slots);
      return;
    }

    whisper(playerid, "Unknown reroll mode. Use slot or full.");
  }

  /** Square exchange handler */
  function tradeSquares(playerid, target) {
    const totals = StateManager.getCurrencies(playerid) || {};
    if (!totals.squares || totals.squares <= 0) {
      whisper(playerid, "No Squares to trade.");
      return;
    }

    let gain = 0;
    if (target === "scrip") {
      gain = 15;
    } else if (target === "fse") {
      gain = 5;
    } else {
      whisper(playerid, "Choose scrip or fse for trades.");
      return;
    }

    const ps = StateManager.getPlayer(playerid);
    ps.squares = Math.max(0, (parseInt(ps.squares, 10) || 0) - 1);
    if (target === "scrip") {
      ps.scrip = (parseInt(ps.scrip, 10) || 0) + gain;
    } else {
      ps.fse = (parseInt(ps.fse, 10) || 0) + gain;
    }
    if (StateManager.setPlayer) {
      StateManager.setPlayer(playerid, ps);
    }
    whisper(playerid, `Traded 1 Square → +${gain} ${target.toUpperCase()}.`);
  }

  /** Command registration */
  function register() {
    StateManager.init();
    on("chat:message", (msg) => {
      if (msg.type !== "api") return;

      const parts = msg.content.trim().split(/\s+/);
      const command = parts[0];

      if (command === "!openshop") {
        if (!isGMPlayer(msg.playerid)) {
          whisper(msg.playerid, "⚠️ Only the GM can open the shop interface.");
          return;
        }

        const args = parts.slice(1);
        const targets = resolveShopTargets(args);

        if (!targets.length) {
          whisperGM("⚠️ No players matched that shop request.");
          return;
        }

        targets.forEach(id => {
          openFor(id, true);
        });
        return;
      }

      if (command === "!buy") {
        const [, type, cardId] = parts;
        if (!type || !cardId) return;
        purchase(msg.playerid, type.toLowerCase(), cardId);
      }

      if (command === "!reroll") {
        const [, mode, target] = parts;
        if (!mode) return;
        reroll(msg.playerid, mode.toLowerCase(), target);
      }

      if (command === "!tradeSquares") {
        const [, target] = parts;
        if (!target) return;
        tradeSquares(msg.playerid, target.toLowerCase());
      }
    });
  }

  return {
    generateShop,
    showShop,
    openFor,
    purchase,
    reroll,
    tradeSquares,
    register
  };

})();

