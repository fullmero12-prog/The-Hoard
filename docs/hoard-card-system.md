# Hoard Card System — Roll20 Build Guide

This document captures the current design for layering a roguelike progression loop on top of D&D 5e inside Roll20. It breaks the large design prompt into practical reference sections to inform card creation, macro scripting, and campaign operations.

## Core Resources

| Resource | Run Scope | Primary Use |
| --- | --- | --- |
| **Scrip** | In-run | Purchase Relics, Boons, Upgrades, or reroll shop slots/dice. |
| **FSE** | Meta | Earned from rooms, minibosses, bosses; spent in the Hub on Minting, facilities, and Hub upgrades. |
| **Squares** | Meta catalyst | 50% drop from mini/bosses; required for Signature Minting or can be traded via Bongo. |
| **Reroll Tokens** | In-run | Allow players to reroll a shop slot or a single d20 once. |

Default payout dials: successful run grants 20 FSE; expect ~20 Scrip per room plus 40 on the boss; Squares drop on a 50% chance from minibosses or bosses.

## Shop Loop Overview

1. **Enter Shop** after Room 3 (mandatory) and again after Room 5's social encounter (this is the Final Shop before the boss in Room 6).
2. **Deal Relics**: Generate three Relic slots. For each slot roll rarity using the 45% Common / 40% Greater / 15% Signature dial and draw from the matching deck.
3. **Offer Boon**: Draw a single ancestor-specific Boon using the same 45/40/15 rarity dial (C/G/S) and present it alongside the relics.
4. **Purchasing**: Players spend Scrip at the default prices listed per deck below.
5. **Rerolls**:
   * Single-slot reroll costs 15 Scrip, max twice per visit.
   * Full refresh (all four slots) costs 35 Scrip, max once per visit.
6. **Token Handling**: Track Reroll Tokens as consumable cards; Squares can be converted 1→15 Scrip or 1→5 FSE via Bongo.

## Deck Reference

The Roll20 implementation should maintain separate decks for each category. Tag cards with keywords (e.g., `Relic|Mobility|Signature`) to speed searching.

### Deck 1 — Relics

* **Purpose**: Fast, strong in-run power spikes. Some can later be Minted.
* **Rarity Spread**: Common, Greater, Signature.
* **Shop Pricing**: C 30 Scrip, G 50 Scrip, S 70 Scrip (matches Relics.json + DeckManager fallback data).
* **Schema**:
  * Name
  * Rarity
  * Type Tags (Mobility, Sustain, Burst, Defense, Economy, Control, Anti-Boss, etc.)
  * In-Run Text (explicit 5e mechanics, charges, cadence)
  * Minted Text (conversion rules: e.g., "Once per room" becomes "Once per short rest"; no attunement by default)
  * Mint Cost (Common 10 FSE, Greater 25 FSE, Signature 60 FSE + 1 Square)
  * Notes (stacking clarifications, conflicts)

### Deck 2 — Boons (Ancestor-Specific)

* **Purpose**: Modify the chosen Ancestor’s kit. Offered as a dedicated shop slot every visit.
* **Shop Pricing**: 65 Scrip flat (rarity does not alter cost).
* **Draw Rules**: Player’s selected Ancestor locks the available Boon pool. Present exactly one Boon in the shop.
* **Schema**:
  * Name
  * Rarity
  * Ancestor (Seraphine the Firewright, Morvox the Tiny Tyrant, Varek the Stoneshaper, Kaelith the Crimson, etc.)
  * Hook (short summary such as "Amplifies Stoke")
  * Effect Text (mechanics, action economy, save DC formula)
  * Stacking Rules (limits on overlapping upgrades)

Design cue: Signature Boons should dramatically change gameplay—think new actions, heavy control, or overcharge moments.

### Deck 3 — Weapon / Focus Upgrades

* **Purpose**: General upgrades for the current weapon/focus (Greataxe, Rapier, Longsword, Dagger, Bow, Staff, Orb, Talisman).
* **Status**: Not currently offered in the unified shop rotation but retained here for future design notes.
* **Pricing**: Basic 40, Advanced 70, Premium 100 Scrip (no rarity labels).
* **Draw Rules**: If re-enabled, draw 1–2 cards matching the equipped weapon/focus. DM selects deck for edge cases.
* **Schema**:
  * Name
  * Weapon/Focus Type
  * Tier (Basic/Advanced/Premium)
  * Effect Text (mechanical change; e.g., extra attack, spell bank)
  * Optional Synergy Tags (callouts for Ancestor interactions)

Staff upgrades lean toward melee-spell hybrids and stance windows; orb upgrades emphasize spell shaping and empowerment.

### Deck 4 — Keepsakes

* **Purpose**: Post-boss rewards used outside the Corridors.
* **Distribution**: Granted upon defeating a Champion; not part of the shop.
* **Schema**:
  * Name
  * Ancestor
  * Guarantee Text (ensures Ancestor appears in future starting choices)
  * 1/Long Rest Move (power usable in normal D&D play)

### Deck 5 — Room Cards

* **Purpose**: Script the memory-scenes forming a Corridor run (typically six rooms for Skafnir).
* **Use**: Reveal sequentially; include setup text, hazards, enemy list, and rewards.
* **Schema**:
  * Room Number & Title
  * Memory Beat (narrative anchor)
  * Setup & Terrain (hazards, interactables, special rules)
  * Enemies (names, counts, reference tags)
  * Rewards (Scrip, FSE, Square chance)
  * Notes (variant dials)

### Deck 6 — Enemy Cards

* **Purpose**: Condensed stat blocks for quick reference.
* **Schema**:
  * Name & Type (e.g., Rot Husk — Undead Minion)
  * Role (Minion/Elite/Boss)
  * AC / HP / Speed
  * Attacks & DCs (simplified, include recharge indicators)
  * Traits (resistances, immunities, hazards)
  * Drops (Scrip/FSE per enemy)
  * Tags (Corridor, damage types)

### Deck 7 — Stone Tongue Slabs

* **Purpose**: Collectible puzzles (A→Z) revealed through the Corridor.
* **Distribution**: Place across rooms and caches; reveal when discovered.
* **Schema**:
  * Letter
  * Sentence
  * Content Word List (unique mapping to the letter)
  * Art (slab image)
  * Placement Tag (Corridor reference)

### Deck 8 — Shop Control Cards (Optional)

* Helper deck to automate processes.
* Include coin flip card for Boon/Upgrade, rarity roll cards for Relic slots, Reroll Token cards for players.

## Facilities & Meta Systems

### Hall Staging Alcove (Level 5)

* **Always On**: First run each Bastion turn grants 20 temp HP and 1 Reroll Token.
* **Order – Empower: Loadout Bias (7 days)**: Choose one bonus for the next run—Starter Stipend (50 Scrip), advantage on first initiative + immune to surprise, or +1 Reroll Token. Variant "Push the Dial" allows two picks.

### Subastion’s Mint Annex (Level 13)

* **Order – Trade: Golden Hour (7 days)**: One Mint receives a 50% FSE discount that week (Signature still costs 1 Square).

### Minting Rules (Hub, Post-Run)

* **Eligibility**: Only Relics purchased and used that run can be Minted.
* **Costs**: Common 10 FSE, Greater 25 FSE, Signature 60 FSE + 1 Square. (Golden Hour halves the FSE for one Mint.)
* **Dusting**: Recoup 50% of Mint FSE cost; destroys the Relic.
* **Conversion**: In-run cadence ("once per room") converts to standard D&D pacing ("once per short rest"). No attunement required.

## Start-of-Run Flow

1. Apply Hall Staging Alcove benefits and any Loadout Bias bonuses.
2. Present 2–3 Ancestor Loadout cards (Keepsakes guarantee appearance of their Ancestor).
3. Enter the Corridor and resolve Room cards sequentially, running shops as described.
4. On boss defeat, award FSE, roll for Square drops, hand out Keepsakes if it is a Champion.
5. Return to the Hub for Minting, FSE spending, and facility orders.

## Implementation Tips

* Maintain a GM-only reference handout with dial values (A = 20, drop rates, pricing).
* Build API macro buttons for common actions: draw shop, flip Special slot, reroll, refresh, adjust Scrip/FSE, and manage Reroll Tokens.
* Enemy cards can link to full stat blocks stored in Roll20 handouts if more depth is required.
