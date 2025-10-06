// ------------------------------------------------------------
// Shop Manager (Unified: Bing, Bang & Bongo)
// ------------------------------------------------------------
// What this does (in simple terms):
//   Builds and manages the 5-slot shop shown after Room 3 and 5.
//   Handles Relics, Boons, Focus Upgrades, Rerolls, and Bongo’s Square trades.
//
//   Bing = Relics  (4 slots)
//   Bang = Special (Boon or Focus Upgrade)
//   Bongo = Square trade counter
// ------------------------------------------------------------

var ShopManager = (function () {

  const RELIC_RARITY_ROLLS = [
    { min: 1, max: 12, rarity: "C" },
    { min: 13, max: 18, rarity: "G" },
    { min: 19, max: 20, rarity: "S" }
  ];

  const RELIC_PRICES = { C: 30, G: 50, S: 70 };
  const BOON_PRICES = { C: 45, G: 70, S: 90 };
  const COST_REROLL_SLOT = 15;
  const COST_REROLL_FULL = 35;
  const MAX_SLOT_REROLLS = 2;
  const MAX_FULL_REROLLS = 1;

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

  /** Rolls rarity for a relic slot */
  function rollRelicRarity(shopTier) {
    const roll = randomInteger(20);
    let rarity = "C";
    RELIC_RARITY_ROLLS.forEach(r => {
      if (roll >= r.min && roll <= r.max) {
        rarity = r.rarity;
      }
    });
    if (shopTier === 1 && rarity === "S") {
      rarity = "G";
    }
    return rarity;
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

  /** Builds the special slot (boon or focus upgrade) */
  function createSpecialSlot(playerid, tier) {
    const coin = randomInteger(2);
    if (coin === 1) {
      // Heads = Boon
      let rarity;
      if (tier === 1) {
        rarity = randomInteger(2) === 1 ? "C" : "G";
      } else {
        const roll = randomInteger(100);
        if (roll <= 45) rarity = "C";
        else if (roll <= 85) rarity = "G";
        else rarity = "S";
      }

      const deckName = rarity === "C"
        ? "Boons.ActiveAncestor.Common"
        : rarity === "G"
          ? "Boons.ActiveAncestor.Greater"
          : "Boons.ActiveAncestor.Signature";

      const card = DeckManager.drawOne(deckName);
      if (!card) return null;
      return buildSlot("boon", rarity, card, BOON_PRICES[rarity]);
    }

    // Tails = Focus Upgrade
    const ps = StateManager.getPlayer(playerid);
    const focus = ps.focus || "Staff";
    const card = DeckManager.drawOne(`Upgrades.${focus}`);
    if (!card) return null;

    let price = 60;
    const notes = card.get("gmnotes");
    if (notes) {
      try {
        const parsed = JSON.parse(notes);
        if (parsed && typeof parsed.price === "number") {
          price = parsed.price;
        }
      } catch (err) {
        log(`Upgrade price parse failed for ${card.get("name")}: ${err.message}`);
      }
    }

    return buildSlot("upgrade", "—", card, price);
  }

  /** Builds a relic slot */
  function createRelicSlot(tier) {
    const rarity = rollRelicRarity(tier);
    const deckName = rarity === "C"
      ? "Relics.Common"
      : rarity === "G"
        ? "Relics.Greater"
        : "Relics.Signature";
    const card = DeckManager.drawOne(deckName);
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

  /** Generates the 5-slot shop layout */
  function createSlots(playerid, tier) {
    const slots = [];
    const special = createSpecialSlot(playerid, tier);
    if (special) {
      slots.push(special);
    }

    for (let i = 0; i < 4; i++) {
      const relicSlot = createRelicSlot(tier);
      if (relicSlot) {
        slots.push(relicSlot);
      }
    }

    return slots;
  }

  /** Generates a full 5-slot shop */
  function generateShop(playerid) {
    const tier = getShopTier(playerid);
    const shop = getPlayerShop(playerid);
    shop.tier = tier;
    shop.slots = createSlots(playerid, tier);
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
    const name = getPlayerDisplayName(playerid);

    const shop = getPlayerShop(playerid);
    const currencies = StateManager.getCurrencies(playerid) || {};
    const scripTotal = typeof currencies.scrip !== "undefined" ? currencies.scrip : 0;
    const entries = slots || (shop.slots.length ? shop.slots : generateShop(playerid));

    let html = `<div style="border:1px solid #555;background:#111;padding:5px;color:#eee">`;
    html += `<b>Unified Shop – Bing, Bang & Bongo</b><br><br>`;
    html += `<span style="color:#ffd700">Current Scrip: ${scripTotal}</span><br><br>`;

    entries.forEach((s, index) => {
      if (s.sold) return;
      const label = s.type === "relic"
        ? `Relic (${s.rarity})`
        : s.type === "boon"
          ? `Boon (${s.rarity})`
          : "Focus Upgrade";
      html += `[${label}: ${s.cardName} – ${s.price} Scrip](!buy ${s.type} ${s.cardId} ${s.price})<br>`;
    });

    html += `<hr><b>Rerolls</b><br>`;
    entries.forEach((s, index) => {
      if (s.sold) return;
      const displayIndex = index + 1;
      html += `[Slot ${displayIndex}](!reroll slot ${displayIndex}) `;
    });
    html += `– ${COST_REROLL_SLOT} Scrip (Used ${shop.rerollSlotCount}/${MAX_SLOT_REROLLS})<br>`;
    html += `[Full Refresh](!reroll full) – ${COST_REROLL_FULL} Scrip (Used ${shop.rerollFullCount}/${MAX_FULL_REROLLS})<br>`;
    html += `<hr>[Trade Square → Scrip](!tradeSquares scrip)<br>`;
    html += `[Trade Square → FSE](!tradeSquares fse)</div>`;

    sendChat("Hoard Run", `/w ${name} ${html}`);
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

    shop.slots.splice(index, 1);

    ensureCardHandout(playerid, slot, card);
    whisper(playerid, `Bought **${slot.cardName}** for ${slot.price} Scrip.`);
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
        replacement = createRelicSlot(shop.tier);
      } else {
        replacement = createSpecialSlot(playerid, shop.tier);
      }

      if (!replacement) {
        whisper(playerid, "Unable to reroll that slot right now.");
        const ps = StateManager.getPlayer(playerid);
        ps.scrip += COST_REROLL_SLOT;
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

      shop.slots = createSlots(playerid, shop.tier);
      shop.rerollFullCount += 1;
      shop.rerollSlotCount = 0;
      showShop(playerid, shop.slots);
      return;
    }

    whisper(playerid, "Unknown reroll mode. Use slot or full.");
  }

  /** Square exchange handler */
  function tradeSquares(playerid, target) {
    const ps = StateManager.getPlayer(playerid);
    if (ps.squares <= 0) {
      whisper(playerid, "No Squares to trade.");
      return;
    }

    let gain = 0;
    if (target === "scrip") {
      gain = 15;
      ps.scrip += gain;
    } else if (target === "fse") {
      gain = 5;
      ps.fse += gain;
    } else {
      whisper(playerid, "Choose scrip or fse for trades.");
      return;
    }

    ps.squares -= 1;
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

