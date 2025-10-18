# The Hoard Roguelike Mode

This repository captures design notes and implementation guides for "The Hoard," a roguelike-inspired game mode layered onto Dungeons & Dragons 5e for use inside Roll20. The material here converts sprawling design prompts into structured documentation so the tabletop team can collaborate on scripts, card decks, and facility systems.

* `docs/` — Reference documentation for currencies, decks, facilities, and sandbox troubleshooting.
* `LICENSE` — Licensing information.

As implementation assets (Roll20 macros, card templates, API scripts) are produced they should be stored alongside this documentation.

## Relic Item Pipeline (Roll20 Automation)

The legacy effect engine has been retired in favor of a Roll20-focused relic-item pipeline. Relic grants now record ownership, sync the "HR Relic" inventory rows on the D&D 5e by Roll20 sheet, and mirror token actions via the automation helpers bundled in this repo. GMs can grant relics through the shop or dev tools and watch the binder update character journals, inventories, and abilities without additional macro work. Existing runs created before the pipeline update may need each player to re-run `!giverelic` (or rebuy relics) so their sheets receive the new schema-driven inventory rows.
