# AGENTS.md – The Hoard (Roll20 Mod Project)

## 🎯 Project Overview
**The Hoard** is a Roll20 API mod that powers a roguelike game mode for Dungeons & Dragons 5e campaigns.

Players run through a series of rooms (“Corridors”), earning currencies, relics, and boons.  
The system automates room rewards, shop offerings, and event handling for Roll20.

## 🧩 Architecture
All logic is modularized under `/src/modules/`:

| Module | Responsibility |
|---------|----------------|
| `stateManager.js` | Tracks player state and currencies (Scrip, FSE, Squares, rerolls, etc). |
| `deckManager.js` | Draws from Roll20 card decks for Relics, Boons, and Upgrades. |
| `boonManager.js` | Handles post-room boon choices, Scrip costs, and effect tracking. |
| `shopManager.js` | Implements Bing, Bang & Bongo unified shop rules and reroll logic. |
| `roomManager.js` | Controls progression, room rewards, and shop triggers (after Room 3 & 5). |
| `uiManager.js` | Centralizes chat output styling for consistent UI/UX across modules. |
| `main.js` | Entry point; registers all modules and initializes the system on ready. |

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
| `!startrun` | Begin a new Hoard Run. |
| `!nextr room|miniboss|boss` | Advance to the next room. |
| `!openshop` | Open Bing, Bang & Bongo unified shop. |
| `!offerboons <Ancestor>` | Offer boons after room completion. |
| `!chooseboon <CardID>` | Accept boon choice. |
| `!tradeSquares scrip|fse` | Convert Squares into Scrip or FSE. |

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
