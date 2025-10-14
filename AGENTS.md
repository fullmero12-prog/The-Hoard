# AGENTS.md – The Hoard (Roll20 Mod Project)

## 🎯 Project Overview
**The Hoard** is a Roll20 API mod that powers a roguelike game mode for Dungeons & Dragons 5e campaigns.

Players run through a series of rooms (“Corridors”), earning currencies, relics, and boons.  
The system automates room rewards, shop offerings, and event handling for Roll20.

## 🧩 Architecture
All logic is modularized under `/src/modules/` and `/src/data/`. The list below reflects the current Hoard sandbox build (Vladren Moroi kit, ancestor registries, and developer tools are now live).

| Module | Responsibility |
|---------|----------------|
| `main.js` | Entry point; registers all modules, seeds decks/data, and initializes Roll20 event hooks on ready. |
| `stateManager.js` | Tracks player state (Scrip, FSE, Squares, rerolls, boons, relics) and persists it across sessions via the `state` object. |
| `runFlowManager.js` | Controls the corridor run lifecycle, including ancestor/weapon selection, room advancement, and miniboss/boss pacing. |
| `roomManager.js` | Handles per-room reward logic, triggers post-room boons, and coordinates shop unlocks after Rooms 3 and 5. |
| `boonManager.js` | Handles post-room boon choices, Scrip costs, Vladren kit interactions, and effect tracking. |
| `deckManager.js` | Draws from Roll20 card decks for relics, boons, upgrades, and falls back to static data when decks are missing. |
| `shopManager.js` | Implements Bing, Bang & Bongo unified shop rules, reroll logic, and shared inventory between players. |
| `ancestorRegistry.js` | Defines ancestor metadata and kit bindings, powering `!selectancestor`, boon flavor, and kit mirroring. |
| `ancestorKits.core.js` / `.vladren.js` | Supplies reusable kit helpers plus Vladren Moroi's token action package (with reset/bind utilities). |
| `eventManager.js` | Provides a publish/subscribe layer for cross-module communication and developer tooling hooks. |
| `effectRegistry.js` / `effectEngine.js` / `effectAdapters.*` | Encapsulate mechanical effects, adapt them to Roll20 sheet macros, and execute them when boons/relics are acquired. |
| `spellbookHelper.js` | Utilities for writing spell and power macros into character sheets when relics or kits demand it. |
| `logManager.js` | Developer-facing logging with Roll20-safe guards and consistent prefixes. |
| `devTools.js` | GM-only utilities surfaced through `!debugstate`, `!resetstate`, and other maintenance commands. |
| `safetyGuards.js` | Protects against duplicate run instances, missing decks, and script restarts with actionable chat warnings. |
| `uiManager.js` | Centralizes chat output styling (headers, callouts, buttons) for consistent UI/UX across modules. |
| `/src/data/` | JSON-esque data catalogs (boon, relic, shop tables) used when decks are absent or to accelerate testing. |

---

## 🤖 Guidance for Code Agents

### Style & Syntax
- JavaScript, ES5-compatible (Roll20 sandbox).
- Use IIFE module pattern (`var ModuleName = (function(){ ... })();`).
- Prefer explicit `var` over `let`/`const`.
- Use single quotes for strings inside HTML or templates.
- Keep all HTML UI inside chat-safe strings.

### Comments
- Begin each file with a header block explaining what it does “in simple terms.”
- Use JSDoc-style `/** */` for public functions.
- Inline comments for reasoning when logic isn’t obvious.

### Dependencies
- Do **not** import npm packages or Node modules.  
- Only use Roll20 sandbox globals: `getObj`, `createObj`, `sendChat`, `state`, `on`, etc.

### Testing
- All commands are executed via Roll20 chat interface.
- Never use file I/O, `require()`, or external network requests.

---

## 🧠 Example Commands

| Command | Purpose |
|----------|----------|
| `!startrun` | Begin a new Hoard Run. Resets currencies, triggers ancestor/weapon selection prompts. |
| `!selectweapon <Weapon>` | (Players) Choose Staff, Orb, Greataxe, Rapier, or Bow to seed ancestor/kit pairing. |
| `!selectancestor <Name>` | (Players) Confirm the ancestor tied to the chosen weapon. |
| `!nextr room|miniboss|boss` | Advance to the next room milestone with run-safe state updates. |
| `!openshop` | Open Bing, Bang & Bongo unified shop for all tracked players. |
| `!offerboons <Ancestor> [free|shop]` | Offer ancestor-specific boons as free rewards or paid shop picks. |
| `!chooseboon <ChoiceIndex>` | Accept boon choice and trigger any linked effects/spellbook updates. |
| `!tradeSquares scrip|fse` | Convert Squares into Scrip or FSE using `StateManager` helper routines. |
| `!givecurrency <target> <type> <amount>` | GM utility to issue currencies directly for adjustments or testing. |
| `!giverelic <Relic Name>` | GM utility to grant a relic and apply its effect engine actions. |
| `!resetstate` | GM utility to wipe Hoard Run data and remove generated kit/relic macros. |

---

## 🚦 Priorities for AI Collaboration

1. **Preserve existing logic.** Don’t rewrite modules to use async/await or ES6.
2. **Improve clarity.** Expand comments and documentation instead of over-optimizing.
3. **Protect Roll20 sandbox safety.** No new globals or `eval` calls.
4. **Coordinate with ChatGPT.** When large structural changes are needed, confirm with ChatGPT (the primary design authority for this project).
5. **Commit messages:** Use concise, descriptive prefixes:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for logic cleanups

---

## 🪶 Maintainers
- **Primary Designer:** Josh Fullmer (Dungeon Master & Architect)
- **AI Collaborators:** ChatGPT (GPT-5), Cursor Agents (Code Assistants)
- **Versioning Goal:** Hoard Run v1.0 = fully modular, ready for Roll20 upload.

---

## ✅ Checklist for New Agents
- [ ] Read this document before making changes.
- [ ] Study `/docs/roll20-field-index.md` for Roll20 attribute references (required for effect adapters).
- [ ] Keep code ES5-compatible.
- [ ] Maintain separation of logic by module.
- [ ] Use `UIManager` for all player-facing chat output.
- [ ] Document any new commands in `/docs/COMMANDS.md`.

📁 Where to Put It

Place it in your project root:

The-Hoard/
│
├── AGENTS.md
├── README.md
├── LICENSE
├── docs/
└── src/
    └── modules/

🧠 Why This Matters

Once it’s there:

Cursor (and any other AI collaborator) will read it automatically.

It ensures your Roll20-safe modular pattern isn’t “optimized away.”

It helps reviewers understand how stateManager and the others tie together.

---

## 🧭 Cursor Context Quick Reference

- `src/main.js` – Bootstraps the script on ready, calling each subsystem’s register hook (loggers, guards, UI, adapters, registries, gameplay managers, dev tools) before whispering a GM status message, so load order and cross-module dependencies are satisfied up front.
- `src/modules/logManager.js` – Creates the global HRLog singleton with standardized severity icons, which other modules (e.g., SafetyGuards, AttributeManager, RunFlowManager) reuse for consistent logging without repeating formatting boilerplate.
- `src/modules/safetyGuards.js` – Installs a resilient isGM helper and the throttled HRChat queue; downstream modules route whispers through HRChat (e.g., UIManager, BoonManager, ShopManager) to avoid API spam while preserving GM checks.
- `src/modules/uiManager.js` – Centralizes chat presentation (panels, buttons, whispers, GM logs) and is the styling backbone used by RunFlowManager, RoomManager, BoonManager, ShopManager, and AncestorKits when they surface UI.
- `src/modules/attributeManager.js` – Wraps attribute lookup/creation, worker-safe updates, and repeating-row helpers, exposing utility that the D&D 5e effect adapter and SpellbookHelper rely on to safely edit sheets, while logging through LogManager when available.
- `src/modules/ancestorRegistry.js` – Stores every ancestor’s metadata, focus tags, and boon decks, exposing lookup helpers (get, getFocusEntries, getBoonDecks, etc.) consumed by RunFlowManager for selection prompts and by BoonManager/ShopManager for ancestor-specific card pulls.
- `src/modules/boonDataLoader.js` – Preloads the registry’s boon decks into state.HoardRun.boons so BoonManager and ShopManager have immediate access to weighted card data even if Roll20 decks are missing.
- `src/data/relics.js` – Supplies the static relic catalog, cloning it into persistent state and rarity buckets for DeckManager and ShopManager to draw from when Roll20 card decks are unavailable.
- `src/modules/effectRegistry.js` – Defines reusable effect payloads (abilities, attributes, adapters, notes) and exposes get/list so BoonManager and ShopManager can look up effect definitions before handing them to the EffectEngine; register() reports how many effects were prepared at startup.
- `src/modules/effectEngine.js` – Applies registry effects to characters: it mirrors sheet stats, updates attributes, manages token abilities/macros, appends GM notes, and delegates specialized patches to EffectAdapters. StateManager calls its removal helpers during resets, while BoonManager and ShopManager invoke apply() for new rewards.
- `src/modules/effectAdapters.js` – Tracks sheet-specific adapters, choosing the first detector that matches a character. EffectEngine calls apply/remove here to stay agnostic, and the adapter registry logs registrations for transparency.
- `src/modules/effectAdapters.dnd5e.roll20.js` – Registers the Roll20 5e adapter that manipulates repeating modifiers, ledgers, and custom attributes using AttributeManager helpers; it resolves effect IDs from cards and implements removal paths so EffectEngine can support that sheet.
- `src/modules/spellbookHelper.js` – Automates always-prepared spell rows on the Roll20 5e sheet and can patch or delete them later. AncestorKits (e.g., Vladren) use it on install, and StateManager calls its cleanup when resetting players.
- `src/modules/ancestorKits.core.js` – Provides the shared kit registry: it mirrors ancestor abilities onto characters, ties bound characters back into StateManager, and uses UIManager for GM prompts. RunFlowManager invokes AncestorKits.install, while the Vladren module and future kits register through this API.
- `src/modules/ancestorKits.vladren.js` – Registers Vladren Moroi’s kit via AncestorKits, builds roll templates, shares handouts, and seeds always-prepared spells with SpellbookHelper during installation so RunFlowManager’s auto-binding can mirror the full experience.
- `src/modules/stateManager.js` – Acts as the persistent run database: initializing containers, cloning default player state, managing currencies, binding characters, and coordinating resets. It collaborates with EffectEngine and SpellbookHelper on cleanup, serves RunFlowManager and RoomManager for progression, and powers ShopManager’s currency spending.
- `src/modules/runFlowManager.js` – Orchestrates the corridor lifecycle: it initializes shared run state, whispers controls via UIManager, funnels room advancement through RoomManager, and coordinates with StateManager for player data while querying AncestorRegistry and invoking AncestorKits to handle ancestor choices and kit mirroring; it registers all chat commands for the run flow.
- `src/modules/eventManager.js` – Listens for GM page changes and, depending on the map name, starts runs, advances rooms, triggers miniboss/boss flows via RoomManager, or opens shops through ShopManager, keeping the visual tabletop in sync with the automated systems.
- `src/modules/roomManager.js` – Drives per-room pacing and rewards: it calculates weighted currency payouts, updates StateManager, sends UI prompts, pings the GM about shop unlocks, and triggers BoonManager for ancestor boons, acting as the reward engine that RunFlowManager and EventManager call into.
- `src/modules/boonManager.js` – Handles boon offers and selections by pulling decks from AncestorRegistry/BoonDataLoader, filtering against StateManager history, rendering UI via UIManager, charging Scrip through StateManager, creating handouts, and applying mechanical effects through EffectRegistry/EffectEngine when players choose a boon.
- `src/modules/deckManager.js` – Serves as a generic card dealer, drawing from Roll20 decks or static data (RelicData) and providing rarity-weighted pulls. ShopManager uses it for relics/boons, and other systems can reuse its fallback stubs when decks are absent.
- `src/modules/shopManager.js` – Builds the four-slot Bing/Bang/Bongo shop: it persistently tracks offers via StateManager, sources relics/boons from DeckManager, BoonManager, and AncestorRegistry, applies relic effects through EffectRegistry/EffectEngine, updates journals, and exposes chat commands for opening, buying, rerolling, and trading squares while styling everything with UIManager.
- `src/modules/devTools.js` – Provides GM-only maintenance commands (!resetstate, !debugstate, !testshop, etc.), delegating work to StateManager, ShopManager, DeckManager, SpellbookHelper, and EffectEngine so admins can inspect or reset the run without touching core modules.
