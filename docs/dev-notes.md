# Dev Notes

## July 2024

- Relic automation landed. `RelicItemManager` now calls into `RelicBinder` to grant inventory rows and token actions on the Roll20 D&D 5e sheet whenever a relic is purchased or issued via dev tools. Older state blobs created before this release may lack the normalized relic schema—use `!giverelic <Relic>` or the shop flow once to refresh the records per character.

### Relic Manager Usage Notes

`RelicItemManager` exposes a thin API for other modules and dev tools:

* `RelicItemManager.grantRelic({ playerId, characterId, relicId })` — normalizes the relic id, adds it to `state.HoardRun.players[playerId].relics`, and forwards the request to `RelicBinder` so the D&D 5e sheet gains the matching inventory row and token action. Provide both identifiers when possible; the manager falls back to whichever is present.
* `RelicItemManager.removeRelic({ playerId, characterId, relicId })` — removes the relic from player state and instructs `RelicBinder` to clear the sheet row/action. Use during refunds, resets, or when a relic is consumed.
* `RelicItemManager.getRelicIds(playerId)` — returns the normalized relic id list for reporting or validation.

`RelicBinder` handles the Roll20-specific automation. It creates or updates the "HR Relic" repeating inventory entry and ensures the associated ability button (`HR Relic: <Name>`) stays in sync. When adding new relic data, double-check the payload contains the `inventory` and `ability` descriptors expected by the binder so automation continues to fire.
