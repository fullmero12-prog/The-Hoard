# The Hoard — Roll20 Roguelike Toolkit

This repository contains documentation and API scripting for running **The Hoard**, a roguelike-inspired game mode layered onto Dungeons & Dragons 5e inside Roll20.  The material is organized to make it easy for a GM to manage in-run currencies, card-driven shops, and long-term progression.

## Contents

- [`docs/hoard-card-system.md`](docs/hoard-card-system.md) — comprehensive overview of the card decks, currencies, and facility dials that power the mode.
- [`docs/api-commands.md`](docs/api-commands.md) — reference for chat commands exposed by the Roll20 API script.
- [`scripts/hoard-card-manager.js`](scripts/hoard-card-manager.js) — Roll20 Mod script that automates currency tracking and reroll token usage.

## Getting Started

1. Import the card decks and handouts described in the documentation into your Roll20 game.
2. Install the API script from `scripts/hoard-card-manager.js` into your game’s Mod Scripts tab.
3. Use the command reference to award currencies, spend shop resources, and manage reroll tokens during play.

Future updates will expand the automation coverage to include full shop slot generation and deck draws.
