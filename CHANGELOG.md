## [0.6.0] - 2026-07-24

Requires **bg3-hud-core 0.6.0**.

Mostly a housekeeping release, plus a couple of fixes you might notice.

### Fixed
- **Players can open the Display menu**: The Display settings menu was locked to GMs, so players couldn't set their own preferences (item names, item uses, health overlay, portrait source). It's now available to everyone, and each player's choices apply only to their own view.
- **Invalid-target messages**: When the target selector rejected a target (no actor, not visible, must be an enemy/ally, etc.), it showed a raw text code instead of the proper message. These now read correctly.

### Changed
- **Quieter console**: Routine console messages are now hidden unless you turn on the new Debug Logging setting in the Core module. Warnings and errors still show.
- **Under-the-hood cleanup**: Removed unused code and tidied duplicated logic (prepared-spell slot handling, weapon/shield quick-roll shortcuts). No change to how the HUD works.

### Fixed
- **Two-handed weapons in the carousel**: Detects native `held-in-two-hands` (Maul), `two-hand-dX` traits (War Axe), and current 2H grip (`handsHeld`, e.g. Longsword via grip toggle). Those fill both pair slots with a faded off-hand copy and equip with two hands held.
- **Heightened / prepared slot casting**: Prepared slot ids are preserved when `prepared` is stored as an object, so heightened ranks consume the correct slot. Spontaneous casts prefer the highest affordable rank.
- **Prepared spell auto-populate**: Respects the Filter Prepared Spells settings so prep casters only get spells actually prepared for the day (unless the filter is disabled).


## [0.3.1] - 2026-07-13

Requires **bg3-hud-core 0.4.3**.

### Changed
- **Foundry v14 ready**: Verified and working on Foundry v14, and still fully supported on v13. Item tooltips now have a safety net so descriptions keep showing even if a future Pathfinder 2e update changes how they are prepared.

## [0.3.0] - 2026-04-29

### Changed
- Keeps pace with core 0.3.0: dragging strikes from the Actions tab onto the hotbar still works; passives and portrait (token vs portrait art) still behave as before — same tricks, internals tidied to match the shared HUD codebase.

## [Branch Update: main] - 2026-04-28

### Changed
- Branch update commit for `main` to capture current in-progress module changes.

## [0.2.6] - 2026-04-25

### Fixed
- **Manifest URLs**: Updated manifest and download URLs in `module.json` to ensure correct update path for users.

## [0.2.5] - 2026-04-24

### Changed
- **Info Panel Redesign**: Complete overhaul of the character info panel with a minimalist, at-a-glance layout.
  - Reordered layout: Ability Scores -> Saving Throws -> Skills.
  - Horizontal Saving Throws: Redesigned saves into a horizontal row with d20 modifier overlays.
  - Simplified skills grid into a 3-column layout.
  - Proficiency indicators using color-coded d20 icons (Blue for Trained, Purple for Expert, Gold for Master).
  - **UI Localization**: Updated localization for settings, context menus, and tooltips, and others.


## [0.2.4] - 2026-04-22

### Added
- **Dynamic Skill Support**: Refactored skill rendering to dynamically pull from the actor's skills record, enabling support for all skills including **Lore** skills.
- **Proficiency Borders**: Swapped proficiency icons/letters for colored borders (Blue=Trained, Gold=Expert, Purple=Master, Red=Legendary).
- **Ability Scores**: Added display of raw ability scores alongside modifiers.

### Fixed
- **Proficiency Layout**: Refactored the proficiency display to use the core border-based Denotation system for a cleaner UI.


## [0.2.3] - 2026-01-28

### Changed
- **Dependency Update**: Updated core dependency to version 0.2.3, which includes:
  - Fix for target selector min targets not updating when max is reduced (Issue #23).
  - Fix for "Hide When BG3 HUD Visible" setting not working correctly (Issue #8).
- **Discord Link Updated**: Updated community Discord invite link.

## [0.2.2] - 2026-01-14

### Changed
- **Dependency Update**: Updated core dependency to version 0.2.2, which includes:
  - Fix for portrait data badge colors resetting on HP change.

## [0.2.1] - 2026-01-10

### Changed
- **Core Updates**: Updated to support BG3 HUD Core 0.2.1 features:
  - **GM Portrait Data Override**: GMs can now enforce a uniform portrait data configuration for all players.
  - **Show/Hide Filter Icons**: Support for toggling filter icon visibility.
  - **Portrait Alignment**: Improved portrait container alignment.
- **Dependency Update**: Updated core dependency to version 0.2.1.

### Fixed
- **Touch Range**: Touch range now returns 1 grid square instead of feet.
- **Numeric Range Conversion**: Range values now correctly convert from feet to grid squares.
- **Range Comparison**: Fixed unit mismatch when comparing target distance to range requirements.

## [0.1.9] - 2026-01-04

### Added
- **Animated Portrait Support**: Uses core's `_createMediaElement()` for WEBM/MP4 animated token support. Health overlay bend mask skipped for video (incompatible technique).

## [0.1.8] - 2025-12-25

> 🎄 **Merry Christmas and Happy Holidays!** 🎄

### Added
- **Consolidated Prepared Spell Tracking**: Prepared spells now display as a single cell per unique spell with a uses counter showing remaining/total preparations (e.g., "2/3"). Casting consumes the first available non-expended slot. This replaces the previous per-slot tracking system for a cleaner, more intuitive experience similar to D&D 5e.
- **Dynamic Uses Counter Updates**: Spell uses counters now update in real-time when spells are cast, without requiring a full hotbar re-render.
- **Spell Rank Grouping**: Spell rank filters (I-X) are now grouped under an expandable "Spell Ranks" button to reduce filter bar clutter. Cantrips and Focus remain standalone.

### Fixed
- **Cantrip Detection**: Fixed cantrips to use proper trait-based detection (`cantrip` trait) instead of spell rank. Cantrips now correctly show as unlimited-use spells without a uses counter.
- **Cantrip Sorting**: Cantrips now properly sort as rank 0 (first in spell lists) instead of being mixed with leveled spells.
- **Cantrip Filtering**: Fixed cantrip filter to correctly identify all cantrips using the `cantrip` trait.
- **Depleted Visual State**: Spell depletion now only desaturates the icon image, not the entire cell. The uses counter remains visible and turns red when depleted, making it clear when spells are exhausted.
- **Heightened Spell Slots**: Fixed issue where heightened spells consumed the wrong spell slot (Issue #8). Spells prepared at higher ranks now correctly consume the heightened slot level instead of the base spell level.

### Changed
- **Discord Link Updated**: Updated community Discord invite link.

## [0.1.7] - 2025-12-21
### Changed
- **Dialog Synchronization**: All dialogs are now synchronized to use consistent `DialogV2` styling and behavior (Issue #11).
- **Manifest Updates**: Updated manifest URL to point to `latest` release for easier updates (Issue #10).

## [0.1.6] - 2025-12-20
### Changed
- **DialogV2 Migration**: Updated dialogs to use core's new `DialogV2`-based utilities for consistent Foundry V13 styling:
  - Passives selection dialog now uses `showSelectionDialog()`.
  - Auto-populate configuration dialog now uses `showAutoPopulateConfigDialog()`.

## [0.1.5] - 2025-12-18
### Added
- **Spell Rank Filters**: Replaced trait filters with spell rank filters (C, I, II, III, etc.) that show centered text labels. Cantrips use "C", ranks 1-10 use Roman numerals.
- **Focus Spell Pips**: Focus spell filter now shows focus pool pips (value/max).
- **Action Economy Tracking**: Action filters now track remaining actions. Pips decrease as actions are used (read from `actionsUsed` actor flag).
- **"Actions" Auto-Populate**: New combined "Actions" option that includes weapon strikes, action items, feats with action costs, and consumables with actions.

### Fixed
- **Spell Preparation Filter**: Fixed prepared spell filtering to correctly check if a spell is actually slotted in the spellcasting entry's prepared slots.
- **Preparation Rank Display**: Spell rank filters now match spells by their preparation rank (e.g., Heal at 4th rank), not base rank.
- **Spell Action Costs**: Fixed action cost detection for spells to read from `system.time.value` instead of `system.actions.value`.
- **Spell Consumption**: Casting a spell from the HUD now properly consumes the spell slot via `entry.cast()`.
- **Range Calculation**: Fixed range to convert feet to grid squares (60ft ÷ 5 = 12 squares), ensuring correct range indicator display and range checking regardless of scene configuration.
- **Range Check Distance**: Fixed distance calculation to use edge-to-edge grid-based measurement consistently.
- **Feat/Action Usage**: Feats and actions with selfEffect (like Everstand Stance) now properly apply their effects and decrement frequency via `game.pf2e.rollItemMacro`.
- **Strike Drag-and-Drop**: Fixed dragging strikes from PF2e character sheet Actions tab to the hotbar (core now handles `type: 'Action'` drag data).

### Changed
- **Filter Order**: Reordered filters to: Action pips → Weapons/Actions/Feats → Focus → Spell Ranks.
- **Spell Color**: Changed spell filter color from purple to consistent blue (#3497d9).

## [0.1.4] - 2025-12-17
### Changed
- **Dependency Update**: Updated core dependency to version 0.1.4.

## [0.1.3] - 2025-12-17
### Added
- **Prepared Spell Filtering**: Separate settings for Players (default: on) and NPCs (default: off) to filter spell containers to only show prepared spells. Spontaneous, innate, and focus spells are always included. (Closes #5)

## [0.1.2] - 2025-12-16
### Added
- **Strike Modifier Overrides**: Added modifier key shortcuts for strikes:
  - **Shift+Click**: Rolls the primary attack (MAP 0).
  - **Ctrl+Click**: Rolls the MAP -5 variant.
  - **Alt+Click**: Rolls the MAP -10 variant.
  - Modifier keys are sanitized to prevent unintended "GM Roll" or "Blind Roll" behavior.

## [0.1.1] - 2025-12-15
### Added
- Initial modular release of `bg3-hud-pf2e`.
- Provides the PF2e system adapter for the BG3 Inspired HUD.
- Requires `bg3-hud-core` to function.