# Hoard Run Commands

## Corridor Flow
- `!startrun` — Begin a new Hoard Run for the issuing player. Resets currencies, inventory, and room progress via `StateManager`.
- `!selectweapon <Weapon>` — Lock in the party's starting focus (Staff, Orb, Greataxe, Rapier, Bow).
- `!selectancestor <Name>` — Bind the Ancestor boon package tied to the chosen weapon.
- **Advance Room button (GM whisper)** — Progress the scripted Hoard Run flow (ancestor prompts, free boon phase, room counter). The button fires the legacy `!nextroom` command so totals stay in sync with manual advances without typing.
- `!nextr room|miniboss|boss` — Advance to the next room type using `RoomManager`. Shares the same `StateManager` helpers as the Advance Room button, so rewards and progress only trigger once per command.

## Shops & Economy
- `!openshop` — (GM only) Summon Bing, Bang & Bongo's shop interface for each active player.

## Boons
- `!offerboons <Ancestor> [free|shop]` — Present boon choices tied to the specified Ancestor. Use `free` (default) for post-room rewards or `shop` to charge Scrip by rarity.
- `!chooseboon <ChoiceIndex>` — Claim a boon from the current offering by its displayed index.

## Currency Utilities
- `!tradeSquares scrip|fse` — Convert Squares into the specified currency reward.

## Developer Utilities (GM Only)
- `!resetstate` — Wipe all Hoard Run data from the persistent state object.
- `!debugstate [playerName|playerId]` — Whisper the current Hoard Run state block (optionally filtered to a player).
- `!testshop` — Generate a mock Bing, Bang & Bongo shop for the first online player.
- `!testrelic` — Roll a random relic using DeckManager (falls back to static data if decks are missing).
- `!resethandouts` — Delete Hoard Run-generated handouts (boons, relics, kits) so journals are clean before a reset.
- `!givevladren` — Installs the Vladren Moroi kit on the issuing GM for testing the ancestor token actions.
- `!resetvladren` — Resets short-rest charges for Vladren Moroi features on the issuing GM.
- `!bindvladren` — Mirrors Vladren Moroi's token action buttons onto the currently selected PC (GM only).
- `!bindkit <Ancestor>` — (GM only) Mirrors the registered Ancestor kit abilities onto the selected PC token using `AncestorKits`. The mirrored macros live on the sheet's **Attributes & Abilities** tab and show up as token action buttons for that character.
