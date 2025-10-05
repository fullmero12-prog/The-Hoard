# Hoard API Command Reference

The Roll20 Mod script in `scripts/hoard-card-manager.js` exposes chat commands that help the GM track currencies and reroll tokens during a run.  All commands start with `!hoard`.

> **Security:** Spending and award commands require a GM. Players may check their own totals and spend reroll tokens.  The script stores data in the persistent `state` object, so values survive script restarts.

## Command Summary

| Command | Description |
| --- | --- |
| `!hoard help` | Display quick usage information in chat.
| `!hoard status [--player "Name"]` | Show totals for all tracked players or a specific player.
| `!hoard award --player "Name" [--scrip N] [--fse N] [--squares N] [--rerolls N]` | Grant currencies or reroll tokens to a player (GM only).
| `!hoard spend --player "Name" [--scrip N] [--fse N] [--squares N] [--rerolls N]` | Spend resources from a player (GM only). Prevents negative totals.
| `!hoard set --player "Name" [--scrip N] [--fse N] [--squares N] [--rerolls N]` | Set exact values for a player (GM only).
| `!hoard reroll [--player "Name"] [--kind slot|die]` | Spend a reroll token. Defaults to the speaker if `--player` is omitted.

Values supplied to `--scrip`, `--fse`, `--squares`, and `--rerolls` are integers.  Prefix a number with `-` when reducing resources through `!hoard award` or `!hoard spend`.

## Examples

- `!hoard award --player "Kaelith" --scrip 20 --rerolls 1` — grant 20 Scrip and a reroll token.
- `!hoard spend --player "Seraphine" --scrip 45` — spend 45 Scrip on a Greater Relic.
- `!hoard reroll --kind slot` — the active speaker consumes one reroll token to reroll a shop slot.
- `!hoard status --player "Morvox"` — check Morvox’s meta currency totals.

## Output Formatting

Resource summaries are rendered as `Scrip / FSE / Squares / Rerolls` lines for each tracked player.  Reroll spend messages call out whether the reroll targeted a shop slot or a d20.

## Extending the Script

The script keeps configuration (rarity weights, dial A) inside a `CONFIG` object.  Extend it to add:

- Shop draw automation that pays the Scrip cost directly from tracked players.
- Additional currency types or weekly facility trackers.
- Logging of awards/spends by run number for post-game analysis.

Use the helper functions at the bottom of the script (`adjustResource`, `getOrCreatePlayerState`, etc.) when adding new commands.
