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
