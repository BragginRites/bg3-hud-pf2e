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
