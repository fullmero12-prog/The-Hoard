# Hoard Card System Reference (Roll20)

This document translates the Hoard roguelike ruleset into a set of Roll20-ready card decks, currencies, and procedures.  Use it as the authoritative reference while building decks and configuring automation inside the VTT.

## Core Currencies and Tokens

| Resource | Scope | Default Gain | Default Spend | Notes |
| --- | --- | --- | --- | --- |
| **Scrip** | In-run | ~20 per room, +40 on the boss | Relics, Boons, Upgrades, shop rerolls | Liquid currency that resets each run.
| **FSE** | Meta (Hub) | +1 per room, +2 miniboss, +5 boss, +3 first clear | Minting relics, facility upgrades | Track per player between runs.
| **Squares** | Meta catalyst | 50% drop on miniboss/boss | Signature minting or convert via Bongo | Convertible to 15 Scrip or 5 FSE.
| **Reroll Tokens** | Per run | 1 from Hall Staging Alcove (Lv 5) + other sources | Reroll a shop slot (15 Scrip) or a single d20 | Hand out as cards or tokens.

**Default dial:** A = 20 FSE per successful run.  Adjust the drop rates above if you tune the difficulty or pacing.

## Deck Overview

| Deck | Purpose | Draw Logic | Pricing / Rewards |
| --- | --- | --- | --- |
| **Relics** (Common/Greater/Signature) | Fast, strong in-run pickups. Some can be Minted. | Each shop visit reveals 4 slots. Roll rarity per slot (default: C 55% / G 35% / S 10%) and draw from the matching deck. | Common 25, Greater 45, Signature 80 Scrip. Reroll slot for 15 Scrip (max 2/visit). Full refresh (all 5 slots) for 35 Scrip (max 1/visit).
| **Boons** (Ancestor-specific) | Modify the chosen Ancestor loadout. | Special slot result “Boon.” Draw 1–3 options from the Ancestor’s pool (rarity suggestion: C 45% / G 40% / S 15%). | Common 35, Greater 55, Signature 90 Scrip. Restrict stacking as needed.
| **Weapon/Focus Upgrades** | Generic upgrades by weapon or focus (e.g., Staff, Orb, Greataxe). | Special slot result “Upgrade.” Draw 1–2 upgrades that match the equipped weapon/focus. | Basic 40, Advanced 70, Premium 100 Scrip (use tiers instead of rarity).
| **Keepsakes** | Post-boss reward; unlock Ancestor choice + 1/LR move. | Award on Champion defeat; no shop draw. | N/A. Each card records the guarantee and the long-rest power.
| **Room Cards** | Script a Corridor run (6–7 per Corridor). | Reveal sequentially. Each shows setup text, hazards, enemies, and rewards. | Default rewards: +1 FSE per room, +2 miniboss, +5 boss, +3 first clear; Square 50% on miniboss/boss.
| **Enemy Cards** | Condensed stat blocks. | Referenced by Room cards. Include attack summaries, traits, drops, and tags. | Drops may include Scrip/FSE when per-enemy.
| **Stone Tongue Slabs** | Collectible alphabet puzzle (A→Z). | Place in rooms or caches. Reveal when discovered. | Each card: letter, sentence, vocabulary list, art, placement note.
| **Shop Control Cards** | Automation helpers (optional). | Coin flip for Special slot, rarity roll cards, reroll tokens. | Use as GM tools to streamline draw procedures.

## Card Schemas

### Relics

- **Name**
- **Rarity**: Common / Greater / Signature
- **Type Tags**: Mobility, Sustain, Burst, Defense, Economy, Control, Anti-Boss, etc.
- **In-Run Text**: Concrete mechanics (charges, triggers, limits such as “once per room”).
- **Minted Text**: Convert in-run cadence (“once per room”) to out-of-run cadence (“once per short rest”). No attunement cost by default.
- **Mint Cost**: Derive from dial A (Common 0.5×A, Greater 1.25×A, Signature 3×A + 1 Square).
- **Notes**: Clarify stacking rules and interactions.

### Boons

- **Name**
- **Rarity**: Common / Greater / Signature
- **Ancestor**: e.g., Seraphine the Firewright, Morvox the Tiny Tyrant, Varek the Stoneshaper, Kaelith the Crimson.
- **Hook**: Short summary (“Amplifies Stoke,” “Adds +1 attack,” “Detonate blinds,” etc.).
- **Effect Text**: Mechanics, action economy, save DC (usually 8 + PB + casting stat or ancestor-specific).
- **Stacking Notes**: Record exclusivity (e.g., limit extra attack sources).

### Weapon / Focus Upgrades

- **Name**
- **Weapon/Focus Tag**: Staff, Orb, Greataxe, Rapier, etc.
- **Tier**: Basic / Advanced / Premium (priced 40 / 70 / 100 Scrip).
- **Effect Text**: Gameplay change (“Your staff attack becomes an extra attack once/turn”).
- **Synergy Tags**: Optional pointers to Ancestors to highlight combos.

### Keepsakes

- **Name**
- **Ancestor**
- **Guarantee**: “Appears in your starting choices every run.”
- **1/Long Rest Move**: Out-of-run ability (e.g., Kaelith’s Finale Shot crit trigger).

### Room Cards

- **Room Number & Title**
- **Memory Beat**: Narrative hook (1–2 lines).
- **Setup & Terrain**: Hazards, interactables, special rules (“Hold the doors,” “Brace the seam,” etc.).
- **Enemies**: Enemy names and counts; reference matching Enemy cards.
- **Rewards**: Scrip and FSE values, Square drop chance, other loot.
- **Notes**: Variant dials or reminders.

### Enemy Cards

- **Name & Type** (e.g., *Rot Husk — Undead Minion*)
- **Role**: Minion / Elite / Boss
- **AC / HP / Speed**
- **Attacks & DCs**: Simplify to core options; include recharge icons.
- **Traits**: Resistances, immunities, hazards triggered.
- **Drops**: Scrip or FSE per enemy, if applicable.
- **Tags**: Corridor, damage type, faction.

### Stone Tongue Slabs

- **Letter** (A–Z)
- **Sentence**
- **Content Words**: Unique list tied to the cipher letter.
- **Art**: Slab illustration.
- **Tag**: Placement or Corridor note.

### Shop Control Helpers

- **Special Slot Coin**: 50/50 Boon vs Upgrade.
- **Rarity Roll Card**: Use weighted cards for Relic slots (C/G/S).
- **Reroll Token Card**: Issue to players; discard on spend.

## Facilities & Weekly Effects

### Hall Staging Alcove (Level 5)

- **Always On**: First run each Bastion turn grants 20 temp HP and 1 Reroll Token.
- **Order — Empower: Loadout Bias (7 days)**: Pick one dial before the next run.
  - Starter Stipend (50 Scrip)
  - Advantage on first initiative roll and no surprise
  - +1 extra Reroll Token
  - Variant: “Push the Dial” grants two picks.

### Subastion’s Mint Annex (Level 13)

- **Order — Trade: Golden Hour (7 days)**: One Mint receives a 50% FSE discount this week (Square still required for Signature).

## Shop Procedure (GM Reference)

1. **Enter Shop** after Room 3 (mandatory) and optionally after Room 5.
2. **Deal 4 Relic slots**. Roll rarity per slot with deck weights above.
3. **Flip Special Coin** to determine Boon or Upgrade.
4. **If Boon**: Draw 1–3 cards from the active Ancestor’s Boon deck; player may buy one.
5. **If Upgrade**: Draw 1–2 cards that match the player’s current weapon/focus.
6. **Purchases** are paid in Scrip. Players may reroll a single slot (15 Scrip, max 2 per visit) or perform one full refresh (35 Scrip).
7. **Squares Conversion (Bongo)**: 1 Square → 15 Scrip or 5 FSE, player choice.

## Minting Procedure (Hub Phase)

1. **Eligibility**: Only Relics purchased and used in the just-completed run may be minted.
2. **Costs** (A = 20 FSE):
   - Common: 10 FSE (0.5×A)
   - Greater: 25 FSE (1.25×A)
   - Signature: 60 FSE + 1 Square (3×A + 1 Square)
3. **Golden Hour Discount**: If active, one Mint costs 50% FSE (Squares unaffected).
4. **Dusting**: Destroy a Minted Relic to refund 50% of its FSE cost.
5. **Conversion**: Replace “once per room” with “once per short rest” for out-of-run play; no attunement slot required.

## Start-of-Run Flow

1. Apply Hall Staging Alcove benefits (temp HP, reroll tokens, Loadout Bias bonuses).
2. Present 2–3 Ancestor Loadout cards (Keepsakes guarantee the linked Ancestor is included).
3. Enter the Corridor and resolve Room cards in order.
4. Trigger Shops after the specified rooms; use Boon/Upgrade decks as directed.
5. Defeat the boss to earn FSE, a chance at a Square, and a Keepsake (on Champion clears).
6. Return to the Hub for Minting, FSE spending, and facility orders.

## Implementation Notes for Roll20

- Create one Roll20 deck per card category. Tag cards with searchable keywords (e.g., `Relic|Mobility|Signature`).
- Maintain a GM-only handout with dial values, price tables, and procedure reminders.
- Provide API macro buttons for shop management (draw slots, reroll, refresh) and currency adjustments.
- Enemy cards may link to full stat block handouts or include condensed text directly on the card.
