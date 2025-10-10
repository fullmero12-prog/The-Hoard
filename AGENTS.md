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
