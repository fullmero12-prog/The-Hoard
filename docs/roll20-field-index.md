# D&D 5E by Roll20 — Field Index

> Exhaustive attribute + repeating-section reference (PC & NPC) tailored for **The Hoard** adapters. ES5 sandbox. Checkbox values are `1` (checked) / empty (unchecked). Repeating rows use either `$0, $1, …` or a generated **RowID** (recommended).

* [Conventions & Gotchas](#conventions--gotchas)
* [Core (PC)](#core-pc)

  * [Identity, Level, Proficiency](#identity-level-proficiency)
  * [Ability Scores](#ability-scores)
  * [Saving Throws](#saving-throws)
  * [Skills](#skills)
  * [Initiative, AC, HP, Speed, Passive](#initiative-ac-hp-speed-passive)
  * [Currency](#currency)
* [Global Modifiers (PC)](#global-modifiers-pc)

  * [Show/Enable Flags](#showenable-flags)
  * [Global AC Mods](#global-ac-mods)
  * [Global Attack Mods](#global-attack-mods)
  * [Global Damage Mods](#global-damage-mods)
  * [Global Skill Mods](#global-skill-mods)
  * [Global Save Mods](#global-save-mods)
* [Attacks & Spellcasting (PC)](#attacks--spellcasting-pc)
* [Spells (PC & NPC)](#spells-pc--npc)

  * [Spellcasting Summary](#spellcasting-summary)
  * [Repeating Spell Sections](#repeating-spell-sections)
* [Resources (PC)](#resources-pc)

  * [Static Resources](#static-resources)
  * [Repeating Resources](#repeating-resources)
* [Tool Proficiencies & Custom Skills (PC)](#tool-proficiencies--custom-skills-pc)
* [Other Proficiencies & Languages (PC)](#other-proficiencies--languages-pc)

  * [Consolidated Lists](#consolidated-lists)
  * [Repeating Proficiencies](#repeating-proficiencies)
* [Inventory (PC)](#inventory-pc)

  * [Repeating Inventory Rows](#repeating-inventory-rows)
  * [Mods Parsing (itemmodifiers)](#mods-parsing-itemmodifiers)
* [Features & Traits (PC)](#features--traits-pc)
* [Sheet Behavior Flags / Options (PC)](#sheet-behavior-flags--options-pc)
* [NPC Sheet](#npc-sheet)

  * [Identity & Stat Block](#identity--stat-block)
  * [NPC Attributes](#npc-attributes)
  * [NPC Saves](#npc-saves)
  * [NPC Skills](#npc-skills)
  * [NPC Damage/Condition/Senses/Languages](#npc-damageconditionsenseslanguages)
  * [NPC Spellcasting Toggles & Globals](#npc-spellcasting-toggles--globals)
  * [NPC Traits & Reactions](#npc-traits--reactions)
  * [NPC Actions / Bonus / Legendary / Mythic](#npc-actions--bonus--legendary--mythic)
* [Roll Buttons (Macros / Token Actions)](#roll-buttons-macros--token-actions)
* [Minimal Recipes](#minimal-recipes)

  * [Create & Activate a Global AC Mod (+1)](#create--activate-a-global-ac-mod-1)
  * [Add an Always-Prepared Cantrip](#add-an-always-prepared-cantrip)
  * [Remove a Repeating Row](#remove-a-repeating-row)

---

## Conventions & Gotchas

* **Checkbox values:** `1` when checked; empty string when unchecked.
* **Repeating sections:** `repeating_<section>_<rowid>_<field>` where `<rowid>` is `$0`/`$1` or a generated RowID (preferred).
* **Show/Enable flags:** set to `1` to reveal global modifier sections.
* **Max fields:** access with `|max` (e.g., `@{selected|hp|max}`).

---

## Core (PC)

### Identity, Level, Proficiency

```
character_name
level
base_level
multiclass1_lvl
multiclass2_lvl
multiclass3_lvl
multiclass4_lvl
pb
inspiration
```

### Ability Scores

> `_base` = base score; plain name = total; `_bonus` = custom flat bonus; `_mod` = derived modifier

```
strength_base, strength, strength_bonus, strength_mod
dexterity_base, dexterity, dexterity_bonus, dexterity_mod
constitution_base, constitution, constitution_bonus, constitution_mod
intelligence_base, intelligence, intelligence_bonus, intelligence_mod
wisdom_base, wisdom, wisdom_bonus, wisdom_mod
charisma_base, charisma, charisma_bonus, charisma_mod
```

### Saving Throws

> `_save_bonus` (final), `_save_mod` (custom addend), plus `globalsavemod` & `death_save_mod`

```
strength_save_bonus, strength_save_mod
dexterity_save_bonus, dexterity_save_mod
constitution_save_bonus, constitution_save_mod
intelligence_save_bonus, intelligence_save_mod
wisdom_save_bonus, wisdom_save_mod
charisma_save_bonus, charisma_save_mod
globalsavemod
death_save_mod
```

### Skills

> `<skill>_bonus` (final), `<skill>_prof` (0/1), `<skill>_flat` (custom), `<skill>_type` (1=normal, 2=expertise)

```
acrobatics_bonus, acrobatics_prof, acrobatics_flat, acrobatics_type
animal_handling_bonus, animal_handling_prof, animal_handling_flat, animal_handling_type
arcana_bonus, arcana_prof, arcana_flat, arcana_type
athletics_bonus, athletics_prof, athletics_flat, athletics_type
deception_bonus, deception_prof, deception_flat, deception_type
history_bonus, history_prof, history_flat, history_type
insight_bonus, insight_prof, insight_flat, insight_type
intimidation_bonus, intimidation_prof, intimidation_flat, intimidation_type
investigation_bonus, investigation_prof, investigation_flat, investigation_type
medicine_bonus, medicine_prof, medicine_flat, medicine_type
nature_bonus, nature_prof, nature_flat, nature_type
perception_bonus, perception_prof, perception_flat, perception_type
performance_bonus, performance_prof, performance_flat, performance_type
persuasion_bonus, persuasion_prof, persuasion_flat, persuasion_type
religion_bonus, religion_prof, religion_flat, religion_type
sleight_of_hand_bonus, sleight_of_hand_prof, sleight_of_hand_flat, sleight_of_hand_type
stealth_bonus, stealth_prof, stealth_flat, stealth_type
survival_bonus, survival_prof, survival_flat, survival_type
```

### Initiative, AC, HP, Speed, Passive

```
initiative_bonus
initmod
init_tiebreaker
ac
speed
hp, hp|max, hp_temp
passive_wisdom
passiveperceptionmod
weighttotal
```

### Currency

```
cp, sp, ep, gp, pp
```

---

## Global Modifiers (PC)

### Show/Enable Flags

```
global_ac_mod_flag
global_attack_mod_flag
global_damage_mod_flag
global_skill_mod_flag
global_save_mod_flag
```

### Global AC Mods

```
repeating_acmod_$0_global_ac_name
repeating_acmod_$0_global_ac_val
repeating_acmod_$0_global_ac_active_flag
```

### Global Attack Mods

```
repeating_tohitmod_$0_global_attack_name
repeating_tohitmod_$0_global_attack_roll
repeating_tohitmod_$0_global_attack_active_flag
```

### Global Damage Mods

```
repeating_damagemod_$0_global_damage_name
repeating_damagemod_$0_global_damage_damage
repeating_damagemod_$0_global_damage_active_flag
```

### Global Skill Mods

```
repeating_skillmod_$0_global_skill_name
repeating_skillmod_$0_global_skill_roll
repeating_skillmod_$0_global_skill_active_flag
```

### Global Save Mods

```
repeating_savemod_$0_global_save_name
repeating_savemod_$0_global_save_roll
repeating_savemod_$0_global_save_active_flag
```

---

## Attacks & Spellcasting (PC)

### Repeating Attacks

```
repeating_attack_$0_attack
repeating_attack_$0_attack_dmg
repeating_attack_$0_attack_crit
```

---

## Spells (PC & NPC)

### Spellcasting Summary

```
spell_save_dc
spell_attack_bonus
lvl1_slots_total,   lvl1_slots_expended,   lvl1_slots_mod
lvl2_slots_total,   lvl2_slots_expended,   lvl2_slots_mod
lvl3_slots_total,   lvl3_slots_expended,   lvl3_slots_mod
lvl4_slots_total,   lvl4_slots_expended,   lvl4_slots_mod
lvl5_slots_total,   lvl5_slots_expended,   lvl5_slots_mod
lvl6_slots_total,   lvl6_slots_expended,   lvl6_slots_mod
lvl7_slots_total,   lvl7_slots_expended,   lvl7_slots_mod
lvl8_slots_total,   lvl8_slots_expended,   lvl8_slots_mod
lvl9_slots_total,   lvl9_slots_expended,   lvl9_slots_mod
```

### Repeating Spell Sections

> Sections: `repeating_spell-cantrip`, `repeating_spell-1` … `repeating_spell-9`

```
repeating_spell-<lvl>_$0_spellname
repeating_spell-<lvl>_$0_spellrange
repeating_spell-<lvl>_$0_spellcastingtime
repeating_spell-<lvl>_$0_spelltarget
repeating_spell-<lvl>_$0_spellduration
repeating_spell-<lvl>_$0_spellschool
repeating_spell-<lvl>_$0_spellritual
repeating_spell-<lvl>_$0_spellconcentration
repeating_spell-<lvl>_$0_spellcomp_v
repeating_spell-<lvl>_$0_spellcomp_s
repeating_spell-<lvl>_$0_spellcomp_m
repeating_spell-<lvl>_$0_spellcomp_materials
repeating_spell-<lvl>_$0_spell_ability
repeating_spell-<lvl>_$0_spelloutput
repeating_spell-<lvl>_$0_spellattack
repeating_spell-<lvl>_$0_spelldamage
repeating_spell-<lvl>_$0_spelldamage2
repeating_spell-<lvl>_$0_spelldamagetype
repeating_spell-<lvl>_$0_spelldamagetype2
repeating_spell-<lvl>_$0_spellhealing
repeating_spell-<lvl>_$0_spelldmgmod
repeating_spell-<lvl>_$0_spell_damage_progression
repeating_spell-<lvl>_$0_spellsave
repeating_spell-<lvl>_$0_spellsavesuccess
repeating_spell-<lvl>_$0_spelldescription
repeating_spell-<lvl>_$0_spellclass
repeating_spell-<lvl>_$0_spellsource
repeating_spell-<lvl>_$0_spellprepared
```

---

## Resources (PC)

### Static Resources

```
class_resource_name, class_resource, class_resource|max
other_resource_name, other_resource, other_resource|max
```

### Repeating Resources

```
repeating_resource_$0_resource_left_name
repeating_resource_$0_resource_left
repeating_resource_$0_resource_left|max
repeating_resource_$0_resource_right_name
repeating_resource_$0_resource_right
repeating_resource_$0_resource_right|max
```

---

## Tool Proficiencies & Custom Skills (PC)

```
repeating_tool_$0_toolname
repeating_tool_$0_toolbonus_base
repeating_tool_$0_toolattr_base
repeating_tool_$0_tool_mod
repeating_proficiencies_$0_output
```

---

## Other Proficiencies & Languages (PC)

### Consolidated Lists

```
other_languages
other_armor
other_weapon
other_other
```

### Repeating Proficiencies

```
repeating_proficiencies_$0_prof_type
repeating_proficiencies_$0_name
```

---

## Inventory (PC)

### Repeating Inventory Rows

```
repeating_inventory_$0_itemcount
repeating_inventory_$0_itemname
repeating_inventory_$0_itemweight
repeating_inventory_$0_equipped
repeating_inventory_$0_useasresource
repeating_inventory_$0_hasattack
repeating_inventory_$0_itemproperties
repeating_inventory_$0_itemmodifiers
repeating_inventory_$0_itemcontent
```

### Mods Parsing (itemmodifiers)

* `AC +n`, `Saving Throws +n`, `Spell Attack +n`, `Ability Checks +n`
* Specific saves: `Strength Save +n`, `Dexterity Save +n`, ...
* Ability scores: `Strength +n` (add) **or** `Strength: n` (set)
* Armor math when paired with base AC: `Item Type: Light/Medium/Heavy Armor`, `Shield`, `AC: n`

---

## Features & Traits (PC)

```
repeating_traits_$0_name
repeating_traits_$0_source
repeating_traits_$0_source_type
repeating_traits_$0_description
repeating_traits_$0_output
```

---

## Sheet Behavior Flags / Options (PC)

```
wtype
globalmagicmod
spell_dc_mod
initiative_bonus
initmod
init_tiebreaker
carrying_capacity_mod
```

---

## NPC Sheet

### Identity & Stat Block

```
npc
npc_name
npc_name_flag
npc_ac
actype
hp, hp|max
npc_hpformula
npc_speed
npc_challenge
npc_xp
token_size
```

### NPC Attributes

```
strength_base, strength_mod
dexterity_base, dexterity_mod
constitution_base, constitution_mod
intelligence_base, intelligence_mod
wisdom_base, wisdom_mod
charisma_base, charisma_mod
```

### NPC Saves

```
npc_str_save_base
npc_dex_save_base
npc_con_save_base
npc_int_save_base
npc_wis_save_base
npc_cha_save_base
```

### NPC Skills

```
npc_acrobatics_base
npc_animal_handling_base
npc_arcana_base
npc_athletics_base
npc_deception_base
npc_history_base
npc_insight_base
npc_intimidation_base
npc_investigation_base
npc_medicine_base
npc_nature_base
npc_perception_base
npc_performance_base
npc_persuasion_base
npc_religion_base
npc_sleight_of_hand_base
npc_stealth_base
npc_survival_base
```

### NPC Damage/Condition/Senses/Languages

```
npc_vulnerabilities
npc_resistances
npc_immunities
npc_condition_immunities
npc_senses
npc_languages
```

### NPC Spellcasting Toggles & Globals

```
npcspellcastingflag
spellcasting_ability
globalmagicmod
caster_level
spell_dc_mod
```

### NPC Traits & Reactions

```
repeating_npctrait_$0_name
repeating_npctrait_$0_description
repeating_npctrait_$0_npc_roll_output
repeating_npcreaction_$0_name
repeating_npcreaction_$0_description
repeating_npcreaction_$0_npc_roll_output
```

### NPC Actions / Bonus / Legendary / Mythic

```
repeating_npcaction_$0_name
repeating_npcaction_$0_npc_action
repeating_npcaction_$0_npc_dmg
repeating_npcaction_$0_npc_crit
repeating_npcaction_$0_attack_tohit
repeating_npcaction_$0_attack_target
repeating_npcaction_$0_attack_damage
repeating_npcaction_$0_attack_damagetype
repeating_npcaction_$0_attack_damage2
repeating_npcaction_$0_attack_damagetype2

repeating_npcbonusaction_$0_name
repeating_npcbonusaction_$0_npc_action

repeating_npcaction-l_$0_name
repeating_npcaction-l_$0_npc_action

repeating_npcaction-m_$0_name
repeating_npcaction-m_$0_npc_action
```

---

## Roll Buttons (Macros / Token Actions)

```
%{selected|strength}
%{selected|strength_save}
%{selected|acrobatics}
%{selected|initiative}
%{selected|death_save}
%{selected|hit_dice}
%{selected|repeating_attack_$0_attack}
%{selected|repeating_attack_$0_attack_dmg}
%{selected|repeating_attack_$0_attack_crit}
%{selected|repeating_traits_$0_output}
%{selected|repeating_tool_$0_tool}
%{selected|repeating_spell-3_$1_spell}
%{selected|repeating_spell-3_$1_output}
%{selected|npc_init}
%{selected|npc_str}
%{selected|npc_stealth}
%{selected|repeating_npcaction_$0_npc_action}
%{selected|repeating_npcaction_$0_npc_dmg}
%{selected|repeating_npcaction_$0_npc_crit}
```

---

## Minimal Recipes

### Create & Activate a Global AC Mod (+1)

```js
getOrCreateAttr(cid, 'global_ac_mod_flag', '1');
var row = generateRowID();
createObj('attribute', { _characterid: cid, name: 'repeating_acmod_'+row+'_global_ac_name',        current: 'Hoard Boon: Guarded' });
createObj('attribute', { _characterid: cid, name: 'repeating_acmod_'+row+'_global_ac_val',         current: 1 });
createObj('attribute', { _characterid: cid, name: 'repeating_acmod_'+row+'_global_ac_active_flag', current: 1 });
```

### Add an Always-Prepared Cantrip

```js
var row = generateRowID(), sec = 'repeating_spell-cantrip_'+row+'_';
createObj('attribute', { _characterid: cid, name: sec+'spellname',        current: 'Hoard Spark' });
createObj('attribute', { _characterid: cid, name: sec+'spelldescription', current: 'A crackle of arcane energy.' });
createObj('attribute', { _characterid: cid, name: sec+'spelloutput',      current: 'Spellcard' });
createObj('attribute', { _characterid: cid, name: sec+'spellprepared',    current: 1 });
```

### Remove a Repeating Row

```js
// Remove all attributes starting with the row prefix
removeRepeatingRow(cid, 'acmod', rowId); // helper provided by AttributeManager/EffectAdapter
```
