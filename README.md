# The Hoard Roguelike Mode

This repository captures design notes and implementation guides for "The Hoard," a roguelike-inspired game mode layered onto Dungeons & Dragons 5e for use inside Roll20. The material here converts sprawling design prompts into structured documentation so the tabletop team can collaborate on scripts, card decks, and facility systems.

* `docs/` — Reference documentation for currencies, decks, facilities, and sandbox troubleshooting.
* `LICENSE` — Licensing information.

As implementation assets (Roll20 macros, card templates, API scripts) are produced they should be stored alongside this documentation.

## Relic Item Pipeline (In Progress)

The legacy effect engine has been retired in favor of a new relic-item pipeline. Relic grants now focus on cataloging which keepsakes the players own, and the forthcoming automation layer will sync inventory, token actions, and sheet attributes once it ships. Until that work lands, GMs should continue to apply relic adjustments manually when testing the run.
