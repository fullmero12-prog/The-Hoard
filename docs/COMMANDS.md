# Hoard Run Commands

## Corridor Flow
- `!startrun` — Begin a new Hoard Run for the issuing player. Resets currencies, inventory, and room progress.
- `!nextr room|miniboss|boss` — Advance to the next room type in the corridor and automatically award rewards.

## Shops & Economy
- `!openshop` — Summon Bing, Bang & Bongo's shop interface for purchases.

## Boons
- `!offerboons <Ancestor>` — Present boon choices tied to the specified Ancestor.
- `!chooseboon <CardID>` — Claim a boon from the current offering.

## Currency Utilities
- `!tradeSquares scrip|fse` — Convert Squares into the specified currency reward.

## Developer Utilities (GM Only)
- `!resetstate` — Wipe all Hoard Run data from the persistent state object.
- `!debugstate [playerName|playerId]` — Whisper the current Hoard Run JSON (optionally filtered to a player).
- `!testshop` — Generate a mock Bing, Bang & Bongo shop for the first online player.
