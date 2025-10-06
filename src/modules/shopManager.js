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

  function canonAncestorName(name) {
    return (name || '').replace(/[^A-Za-z0-9]/g, '');
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

    const decks = (state.HoardRun && state.HoardRun.boons) || {};
    const deck = decks[ancestorKey];
    if (!deck) {
      return null;
    }

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

    return {
      id: clone.id || (ancestorKey + '_' + label + '_' + randomInteger(10000)),
      name: clone.name,
      data: clone,
      deckSource: 'Boons.' + ancestorKey + '.' + label,
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
      type,
      rarity,
      cardId: id,
      cardName: name,
      price
    };

    if (card.isStub) {
      slot.isStub = true;
      slot.cardData = card.data || null;
      slot.deckSource = card.deckSource || null;
    }

    if (extras) {
      Object.keys(extras).forEach(key => {
        slot[key] = extras[key];
      });
    }

    return slot;
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

  function openFor(playerid) {
    const shop = getPlayerShop(playerid);
    if (!shop.slots || !shop.slots.length) {
      generateShop(playerid);
    }
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

    let description = extractCardDescription(slot, card);
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
    const description = extractCardDescription(slot, card);

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
      playerState.relics.push(record);
    } else if (slot.type === "boon") {
      playerState.boons.push(record);
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
          openFor(id);
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

