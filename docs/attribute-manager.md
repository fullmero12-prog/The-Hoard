# Attribute Manager

The Hoard sandbox now ships with an `AttributeManager` helper that mirrors the
quality-of-life features provided by the Roll20 community script
[ChatSetAttr](https://github.com/Roll20/roll20-api-scripts/tree/master/ChatSetAttr).
It gives our modules a safe, reusable way to create or update character sheet
attributes while still triggering sheet workers and handling repeating
sections.

> **Status Note (July 2024):** The relic-item pipeline now drives Roll20 sheet
> automation through `RelicItemManager` and `RelicBinder`. Relic grants patch
> the "HR Relic" inventory rows and token actions automatically on the D&D 5e
> by Roll20 character sheet.

## Why we added it

* **Sheet worker safety.** `AttributeManager.setAttributes` prefers
  `setWithWorker` so the official Roll20 sheets fire their automation when we
  touch a value.
* **Repeating sections without pain.** `AttributeManager.createRepeatingRow`
  generates the same style of row id that ChatSetAttr uses and writes every
  requested field in one shot. Modules no longer need to re-implement that
  boilerplate.
* **Drop-in fallbacks.** If LogManager or AttributeManager are absent (for
  example in unit-style tests), all helpers fall back to plain `createObj` / `set`
  calls so nothing crashes.

## API surface

```js
AttributeManager.setAttributes(charId, [
  { name: 'hp', current: 12, max: 12 },
  { name: 'ac', current: 16 }
]);

var row = AttributeManager.createRepeatingRow(charId, 'spell-cantrip', {
  spellname: 'Sacred Flame',
  spellprepared: 'on'
});
```

Both helpers accept an optional options object with a `useWorkers` flag if you
explicitly need to skip sheet workers.

## Existing integrations

* `SpellbookHelper` now lets the helper build always-prepared spell rows on the
  Roll20 5e sheet. If AttributeManager is not available the previous manual
  implementation is used.
* `EffectAdapters.dnd5e.roll20` uses the helper when adding global modifiers so
  that AC buffs and damage math respect sheet workers.

## Future use

Any module that needs to write attributes (boons, relics, dev tools, etc.) can
call `AttributeManager.setAttributes` for simple updates or
`AttributeManager.createRepeatingRow` for repeating sections. This keeps our
attribute handling consistent with the conventions laid out by ChatSetAttr
without pulling in the full script.
