/**
 * BG3 HUD PF2e Adapter Module
 * Registers PF2e specific components with the BG3 HUD Core
 */

import { createPf2ePortraitContainer } from './components/containers/Pf2ePortraitContainer.js';
import { createPf2ePassivesContainer } from './components/containers/Pf2ePassivesContainer.js';
import { getPf2eRests } from './components/containers/Pf2eActionButtonsContainer.js';
import { ActiveEffectsContainer } from '/modules/bg3-hud-core/scripts/components/containers/ActiveEffectsContainer.js';
import { Pf2eFilterContainer } from './components/containers/Pf2eFilterContainer.js';
import { createPf2eWeaponSetContainer } from './components/containers/Pf2eWeaponSetContainer.js';
import { Pf2eInfoContainer } from './components/containers/Pf2eInfoContainer.js';
import { Pf2eAutoSort } from './features/Pf2eAutoSort.js';
import { Pf2eAutoPopulate } from './features/Pf2eAutoPopulate.js';
import { ShieldCoverService, PF2E_SHIELD_COVER_UUIDS } from './features/ShieldCoverService.js';
import { StrikeCardService } from './features/StrikeCardService.js';
import { isManagedEquipment, isTwoHanded as hasTwoHandTrait, isNativeTwoHanded } from './features/WeaponHandednessRules.js';
import { iteratePreparedSlots, resolveCastRank, summarizePreparedSpell } from './features/SpellCastRank.js';
import { registerSettings } from './utils/settings.js';
import { renderPf2eTooltip } from './utils/tooltipRenderer.js';
import { Pf2eMenuBuilder } from './components/menus/Pf2eMenuBuilder.js';
import { Pf2eTargetingRules } from './utils/Pf2eTargetingRules.js';
import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { resolvePf2eNotice } from './notice/resolveNotice.js';

const MODULE_ID = 'bg3-hud-pf2e';
const log = createLogger('bg3-hud-pf2e');

log.debug('Loading adapter');

/**
 * Register settings
 */
Hooks.once('init', () => {
    log.debug('Registering settings');
    registerSettings();
});

/**
 * Wait for core to be ready, then register PF2e components
 */
Hooks.on('bg3HudReady', async (BG3HUD_API) => {
    log.debug('Received bg3HudReady hook');

    // Verify we're in PF2e system
    if (game.system.id !== 'pf2e') {
        log.warn('Not running PF2e system, skipping registration');
        return;
    }

    log.debug('Registering PF2e components');

    // Create the portrait container class (extends core's PortraitContainer)
    const Pf2ePortraitContainer = await createPf2ePortraitContainer();

    // Create the passives container class (extends core's PassivesContainer)
    const Pf2ePassivesContainer = await createPf2ePassivesContainer();

    // Create the weapon set container class (extends core's WeaponSetContainer)
    const Pf2eWeaponSetContainer = await createPf2eWeaponSetContainer();

    BG3HUD_API.registerNamedHudParts({
        portrait: Pf2ePortraitContainer,
        passives: Pf2ePassivesContainer,
        weaponSet: Pf2eWeaponSetContainer,
        filter: Pf2eFilterContainer,
        characterInfo: Pf2eInfoContainer,
        activeEffects: ActiveEffectsContainer,
        rest: getPf2eRests
    });

    // Create and register the adapter instance
    const adapter = new Pf2eAdapter();
    BG3HUD_API.registerAdapter(adapter);

    // Register PF2e menu builder
    BG3HUD_API.registerMenuBuilder('pf2e', Pf2eMenuBuilder, { adapter: adapter });
    log.debug('Menu builder registered');

    // Register PF2e tooltip renderer
    const tooltipManager = BG3HUD_API.getTooltipManager();
    if (!tooltipManager) {
        log.error('TooltipManager not available, cannot register tooltip renderer');
    } else {
        BG3HUD_API.registerTooltipRenderer('pf2e', renderPf2eTooltip);
        log.debug('Tooltip renderer registered');
    }

    log.debug('Registration complete');

    // Register hook for spellcasting entry updates to refresh uses counter and depleted state
    Hooks.on('updateItem', (item, changes, options, userId) => {
        // Only handle spellcasting entries
        if (item.type !== 'spellcastingEntry') return;

        const actor = item.parent;
        if (!actor) return;

        // Get the hotbar app from ui
        const hotbarApp = ui.BG3HUD_APP;
        if (!hotbarApp?.currentActor?.id || hotbarApp.currentActor.id !== actor.id) return;

        const entrySlots = item.system?.slots ?? {};

        // Find all spell cells for this spellcasting entry
        const spellCells = document.querySelectorAll(`.bg3-grid-cell[data-spell-entry-id="${item.id}"]`);

        for (const cellElement of spellCells) {
            const spellId = cellElement.dataset.spellId;
            if (!spellId) continue;

            // Count total and remaining uses for this spell
            let total = 0;
            let remaining = 0;

            for (const { prep } of iteratePreparedSlots(entrySlots)) {
                if (prep?.id === spellId) {
                    total++;
                    if (!prep.expended) remaining++;
                }
            }

            // Update uses counter display (core renders it with class 'hotbar-item-uses')
            const usesElement = cellElement.querySelector('.hotbar-item-uses');
            if (usesElement) {
                usesElement.textContent = remaining.toString();
                // Update depleted class on uses element
                if (remaining === 0) {
                    usesElement.classList.add('depleted');
                } else {
                    usesElement.classList.remove('depleted');
                }
            }

            // Update depleted state - only apply to image, not whole cell
            // This ensures the uses counter remains visible
            const img = cellElement.querySelector('.hotbar-item');
            if (total > 0 && remaining === 0) {
                if (img) img.classList.add('depleted');
            } else {
                if (img) img.classList.remove('depleted');
            }
        }
    });

    // Signal that adapter registration is complete
    Hooks.call('bg3HudRegistrationComplete');
});

/**
 * PF2e Adapter Class
 * Handles system-specific interactions and data transformations
 */
class Pf2eAdapter {
    constructor() {
        this.MODULE_ID = MODULE_ID; // Expose for core to access
        this.systemId = 'pf2e';
        this.name = 'PF2e Adapter';

        // Initialize PF2e-specific features
        this.autoSort = new Pf2eAutoSort();
        this.autoPopulate = new Pf2eAutoPopulate();
        this.shieldCover = new ShieldCoverService();
        this.strikeCard = new StrikeCardService();

        // Targeting rules for target selector integration
        this.targetingRules = Pf2eTargetingRules;

        // Link autoPopulate to autoSort for consistent sorting
        this.autoPopulate.setAutoSort(this.autoSort);

        log.debug('Pf2eAdapter created with autoSort, autoPopulate, and targetingRules');
    }

    resolveNotice(changes, actor) {
        return resolvePf2eNotice(changes, actor);
    }

    isHeldItem(cell) {
        if (!cell || cell.isTwoHandedDuplicate) return false;
        const item = this._documentFromCell(cell);
        return this._isHeldDocument(item);
    }

    isTwoHanded(cell) {
        if (!cell || cell.isTwoHandedDuplicate) return false;
        if (cell.two) return true;
        const item = this._documentFromCell(cell);
        if (!item || item.type !== 'weapon') return false;
        return isNativeTwoHanded(item);
    }

    _documentFromCell(cell) {
        if (cell.itemType) {
            return {
                type: cell.itemType,
                system: {
                    usage: { value: cell.usage },
                    traits: { value: cell.traits || [] }
                },
                hands: cell.two ? '2' : undefined
            };
        }
        if (!cell.uuid || typeof fromUuidSync !== 'function') return null;
        try {
            return fromUuidSync(cell.uuid);
        } catch {
            return null;
        }
    }

    _isHeldDocument(item) {
        return isManagedEquipment(item);
    }

    /**
     * PF2e sheet drag: strike rows use `type: Action` with actor UUID + action index.
     * @param {object} dragData Parsed `text/plain` transfer JSON
     * @returns {Promise<null|{ document: foundry.documents.Item, type: 'Item', augment: Record<string, unknown> }>}
     */
    async resolveExternalDragData(dragData /* , event */) {
        if (dragData.type !== 'Action' || dragData.actorUUID === undefined) return null;
        const actor = await fromUuid(dragData.actorUUID);
        if (!actor) return null;
        const actionIndex = dragData.index;
        const strike = actor.system?.actions?.[actionIndex];
        if (!strike?.item) return null;
        return {
            document: strike.item,
            type: 'Item',
            augment: {
                pf2eActionIndex: actionIndex,
                pf2eStrikeSlug: strike.slug
            }
        };
    }

    /**
     * Get default portrait data configuration for PF2e
     * Called by core when user hasn't configured portrait data yet
     * @returns {Array<Object>} Default slot configurations
     */
    getPortraitDataDefaults() {
        return [
            { path: 'system.attributes.ac.value', icon: 'fas fa-shield-alt', color: '#4a90d9' },
            { path: '{{system.resources.heroPoints.value}}/{{system.resources.heroPoints.max}}', icon: 'fas fa-star', color: '#f1c40f' },
            { path: '', icon: '', color: '#ffffff' },
            { path: '', icon: '', color: '#ffffff' },
            { path: 'system.attributes.speed.total', icon: 'fas fa-running', color: '#2ecc71' },
            { path: '', icon: '', color: '#ffffff' }
        ];
    }

    /**
     * Handle cell click (use item/spell/action)
     * @param {GridCell} cell - The clicked cell
     * @param {MouseEvent} event - The click event
     */
    async onCellClick(cell, event) {
        const data = cell.data;
        if (!data) return;

        log.debug('Cell clicked:', data);

        // Handle different data types
        switch (data.type) {
            case 'Item':
                await this._useItem(data.uuid, event);
                break;
            case 'Strike':
                await this._useStrike(data, event);
                break;
            case 'Macro':
                await this._executeMacro(data.uuid);
                break;
            default:
                // Fallback: try to use as item UUID for backwards compatibility
                if (data.uuid) {
                    await this._useItem(data.uuid, event);
                } else {
                    log.warn('Unknown cell data type:', data.type);
                }
        }
    }

    /**
     * Get context menu items for a cell
     * @param {GridCell} cell - The cell to get menu items for
     * @returns {Array} Menu items
     */
    async getCellMenuItems(cell) {
        const data = cell.data;
        if (!data) return [];

        const items = [];
        if (!data.uuid) return items;

        const item = await fromUuid(data.uuid);
        const actor = item?.actor;

        // Shield-specific interactions
        if (item?.type === 'shield' && actor) {
            const attrShield = actor.attributes?.shield;
            const isThisShieldRaised = !!(attrShield?.itemId === item.id && attrShield?.raised);
            const coverUuid = PF2E_SHIELD_COVER_UUIDS.cover;
            const hasShieldCover = actor.itemTypes?.effect?.some(
                (e) => e.sourceId === coverUuid && e.getFlag?.(MODULE_ID, 'shieldCover'),
            );

            items.push({
                label: game.i18n.localize(
                    isThisShieldRaised ? `${MODULE_ID}.Context.LowerShield` : `${MODULE_ID}.Context.RaiseShield`,
                ),
                icon: 'fas fa-shield',
                onClick: async () => {
                    if (isThisShieldRaised) {
                        await this.shieldCover.lowerShield(actor);
                    } else {
                        await this.shieldCover.raiseShield(actor);
                    }
                }
            });

            items.push({
                label: game.i18n.localize(
                    hasShieldCover ? `${MODULE_ID}.Context.RemoveCover` : `${MODULE_ID}.Context.TakeCover`,
                ),
                icon: 'fas fa-person-shelter',
                onClick: async () => {
                    await this.shieldCover.takeCover(actor, item);
                }
            });
        }

        // Weapon interactions: toggle one-hand / two-hand grip
        if (item?.type === 'weapon' && actor && this._canToggleGrip(item)) {
            const nextHands = this._getNextHands(item);
            items.push({
                label: game.i18n.format(`${MODULE_ID}.Context.ToggleGrip`, { hands: nextHands }),
                icon: 'fas fa-hand',
                onClick: async () => {
                    await this._toggleGrip(item, nextHands);
                }
            });
        }

        // PF2e doesn't add extra context menu items by default
        // The core context menu already provides "Edit Item" which opens the sheet

        return items;
    }

    /**
     * Use a PF2e item
     * @param {string} uuid - Item UUID
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useItem(uuid, event) {
        const item = await fromUuid(uuid);
        if (!item) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemNotFound`));
            return;
        }

        log.debug('Using item:', item.name);

        // Resolve activity/strike for targeting checks
        let activity = null;
        if (item.actor && (item.type === 'weapon' || item.type === 'melee')) {
            const strike = item.actor.system?.actions?.find?.((s) => s.item?.id === item.id);
            if (strike) {
                activity = strike;
                // Ensure type is 'strike' for the targeting rules check
                if (!activity.type) {
                    activity = { ...strike, type: 'strike', original: strike };
                }
            }
        }

        // For shields, find the generated weapon strike for targeting
        if (item.actor && item.type === 'shield') {
            const strike = item.actor.system?.actions?.find?.((s) => s.item?.shield?.id === item.id);
            if (strike) {
                activity = strike;
                if (!activity.type) {
                    activity = { ...strike, type: 'strike', original: strike };
                }
            }
        }

        // Check if item needs targeting and target selector is enabled
        const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
        const needsTargeting = targetSelectorEnabled && this.targetingRules?.needsTargeting({ item, activity });

        if (needsTargeting && item.actor) {
            // Get the source token
            const sourceToken = item.actor.token?.object ??
                canvas?.tokens?.placeables?.find(t => t.actor?.id === item.actor.id) ??
                null;

            if (sourceToken) {
                try {
                    // Start target selection
                    const targets = await ui.BG3HOTBAR?.api?.startTargetSelection({
                        token: sourceToken,
                        item: item,
                        activity: activity
                    });

                    if (!targets?.placed && (!targets || targets.length === 0)) {
                        log.debug('Target selection cancelled');
                        return;
                    }

                    log.debug('Targets selected:', targets.map(t => t.name).join(', '));
                } catch (error) {
                    log.error('Target selection error:', error);
                    return;
                }
            }
        }

        try {
            // Special-case Take Cover action items to avoid dialogs; use shield-derived cover
            const slug = item.system?.slug || item.slug || item.name?.toLowerCase();
            if (item.type === 'action' && slug === 'take-cover') {
                const applied = await this.shieldCover.applyCoverEffect(item.actor);
                if (!applied) {
                    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionUnavailable`));
                }
                return;
            }

            // For weapons/melee strikes, render the strike chat card directly
            // This bypasses the AttackPopout dialog and posts inline MAP buttons to chat
            if (item.actor && (item.type === 'weapon' || item.type === 'melee')) {
                const strike = item.actor.system?.actions?.find?.((s) => s.item?.id === item.id);
                if (strike) {
                    return this.strikeCard.postStrike(item.actor, strike, event);
                }
            }

            // For shields, find the generated weapon strike (PF2e creates a weapon from shields via generateWeapon())
            // The generated weapon has a `shield` property pointing back to the original shield item
            if (item.actor && item.type === 'shield') {
                const strike = item.actor.system?.actions?.find?.((s) => s.item?.shield?.id === item.id);
                if (strike) {
                    return this.strikeCard.postStrike(item.actor, strike, event);
                }
            }

            // For spells, use the spellcasting entry's cast() method to properly consume slots
            if (item.type === 'spell' && item.actor) {
                const entryId = item.system?.location?.value;
                const entry = entryId ? item.actor.items.get(entryId) : null;

                if (entry && typeof entry.cast === 'function') {
                    const castOptions = resolveCastRank({
                        tradition: entry.system?.prepared?.value,
                        slots: entry.system?.slots ?? {},
                        itemId: item.id,
                        baseRank: Number(item.rank) || Number(item.system?.level?.value) || 1
                    });

                    // `null` only happens for a prepared caster with no
                    // remaining (non-expended) slot for this spell.
                    if (!castOptions) {
                        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.NoSlotsRemaining`));
                        return;
                    }

                    if (castOptions.slotId !== undefined) {
                        log.debug('Casting prepared spell at rank', castOptions.rank, 'slot', castOptions.slotId);
                    }
                    await entry.cast(item, castOptions);
                    return;
                }

                // Fallback: If no entry or cast method, use toMessage (won't consume)
                log.warn('Spell has no spellcasting entry with cast method, falling back to toMessage');
            }

            // For feats and action items, properly USE the action (apply effects, decrement frequency)
            if (item.type === 'feat' || item.type === 'action') {
                await this._useAction(item, event);
                return;
            }

            // For consumables, use the consume method if available
            if (item.type === 'consumable') {
                if (typeof item.consume === 'function') {
                    await item.consume();
                } else if (typeof item.toMessage === 'function') {
                    await item.toMessage(event, { create: true });
                }
                return;
            }

            if (typeof item.toMessage === 'function') {
                await item.toMessage(event, { create: true });
                return;
            }

            if (typeof item.roll === 'function') {
                await item.roll({ event });
                return;
            }

            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
        } catch (error) {
            log.error('Failed to use item', { uuid: item.uuid, name: item.name }, error);
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
        }
    }

    /**
     * Use a strike from stored strike reference data
     * @param {Object} strikeData - Strike reference data (actorId, itemId, slug, meleeOrRanged)
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useStrike(strikeData, event) {
        const { actorId, itemId, slug } = strikeData;

        // Resolve the actor
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActorNotFound`));
            return;
        }

        // Find the strike in actor.system.actions
        const actions = actor.system?.actions ?? [];
        const strike = actions.find(s => s.item?.id === itemId && s.slug === slug);

        if (!strike) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.StrikeNotFound`));
            return;
        }

        log.debug('Using strike:', strike.label);

        // Post the strike chat card (or quick-roll a variant on modifier-held clicks)
        return this.strikeCard.postStrike(actor, strike, event);
    }

    /**
     * Use a feat or action item properly (apply selfEffect, decrement frequency)
     * Uses PF2e's native rollItemMacro which handles all the proper logic
     * @param {Item} item - The feat or action item
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useAction(item, event) {
        log.debug('Using action via rollItemMacro:', item.name);

        // Use PF2e's native rollItemMacro which properly:
        // - Calls createUseActionMessage
        // - Decrements frequency
        // - Applies selfEffect
        if (typeof game.pf2e?.rollItemMacro === 'function') {
            await game.pf2e.rollItemMacro(item.uuid, event);
            return;
        }

        // Fallback if API not available
        log.warn('game.pf2e.rollItemMacro not available, using toMessage');
        await item.toMessage?.(event, { create: true });
    }

    /**
     * Execute a macro
     * @param {string} uuid - Macro UUID
     * @private
     */
    async _executeMacro(uuid) {
        const macro = await fromUuid(uuid);
        if (!macro) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.MacroNotFound`));
            return;
        }

        log.debug('Executing macro:', macro.name);
        await macro.execute();
    }

    /**
     * Transform a PF2e item to cell data format
     * Extracts all relevant data including uses, quantity, and depletion state
     * For prepared spells, returns PreparedSpell type with slot tracking
     * @param {Item} item - The item to transform
     * @returns {Promise<Object>} Cell data object
     */
    async transformItemToCellData(item) {
        if (!item) {
            log.warn('transformItemToCellData: No item provided');
            return null;
        }

        // SPELLS: Handle specially to support per-slot tracking
        if (item.type === 'spell') {
            return this._transformSpellToCellData(item);
        }

        const cellData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: 'Item',
            itemType: item.type
        };

        if (item.type === 'weapon') {
            cellData.two = isNativeTwoHanded(item);
            cellData.usage = item.system?.usage?.value;
        } else if (item.type === 'equipment') {
            cellData.usage = item.system?.usage?.value;
            cellData.traits = item.system?.traits?.value;
        }

        // Extract quantity (PF2e stores this in system.quantity)
        if (item.system?.quantity) {
            cellData.quantity = item.system.quantity;
        }

        // Extract uses (PF2e stores this in system.uses or system.frequency)
        if (item.system?.uses) {
            const maxUses = parseInt(item.system.uses.max) || 0;
            if (maxUses > 0) {
                const value = parseInt(item.system.uses.value) || 0;
                cellData.uses = {
                    value: value,
                    max: maxUses
                };
            }
        } else if (item.system?.frequency) {
            // Handle frequency-based uses (feats with limited uses per day/etc.)
            const maxUses = parseInt(item.system.frequency.max) || 0;
            if (maxUses > 0) {
                const value = parseInt(item.system.frequency.value) || 0;
                cellData.uses = {
                    value: value,
                    max: maxUses
                };
            }
        }

        return cellData;
    }

    /**
     * Transform a spell to cell data, handling prepared spells specially
     * @param {Item} spell - The spell item
     * @returns {Object} Cell data (PreparedSpell or Item type)
     * @private
     */
    _transformSpellToCellData(spell) {
        const actor = spell.actor;
        if (!actor) {
            return {
                uuid: spell.uuid,
                name: spell.name,
                img: spell.img,
                type: 'Item'
            };
        }

        // Check for focus spell first
        const isFocusSpell = spell.system?.traits?.value?.includes('focus');
        if (isFocusSpell) {
            const focusPool = actor.system?.resources?.focus;
            return {
                uuid: spell.uuid,
                name: spell.name,
                img: spell.img,
                type: 'Item',
                depleted: focusPool?.value === 0
            };
        }

        // Check if this is a prepared spell
        const entryId = spell.system?.location?.value;
        const entry = entryId ? actor.items.get(entryId) : null;

        if (entry?.type === 'spellcastingEntry') {
            const tradition = entry.system?.prepared?.value;

            // PREPARED CASTERS: Count total preparations and remaining (non-expended) casts
            if (tradition === 'prepared') {
                // Cantrips have unlimited casts - don't track uses
                // PF2e uses the 'cantrip' trait to identify cantrips
                const isCantrip = spell.system?.traits?.value?.includes('cantrip');
                if (isCantrip) {
                    return {
                        type: 'Item',
                        uuid: spell.uuid,
                        name: spell.name,
                        img: spell.img
                    };
                }

                const slots = entry.system?.slots ?? {};

                // Count all preparations of this spell across all ranks
                const { totalPreps, remainingCasts } = summarizePreparedSpell({ slots, spellId: spell.id });

                // Return Item type with uses counter (consolidated approach)
                if (totalPreps > 0) {
                    return {
                        type: 'Item',
                        uuid: spell.uuid,
                        entryId: entry.id,
                        spellId: spell.id,
                        name: spell.name,
                        img: spell.img,
                        uses: {
                            value: remainingCasts,
                            max: totalPreps
                        },
                        depleted: remainingCasts === 0
                    };
                }
            }
        }

        // Fallback: spontaneous, innate, or unprepared spells - use Item type
        return {
            uuid: spell.uuid,
            name: spell.name,
            img: spell.img,
            type: 'Item'
        };
    }

    /**
     * Auto-populate passives on token creation
     * Selects all feats that have no actions
     * @param {Token} token - The newly created token
     */
    async autoPopulatePassives(token) {
        const actor = token.actor;
        if (!actor) return;

        // Check if auto-populate passives is enabled
        if (!game.settings.get(MODULE_ID, 'autoPopulatePassivesEnabled')) {
            return;
        }

        // Get all feat items
        const feats = actor.items.filter(item => item.type === 'feat');

        // Filter to only feats without actions
        const passiveFeats = feats.filter(feat => {
            const actionCost = feat.system?.actions?.value ?? 0;
            return actionCost === 0; // No action cost = passive
        });

        // Save the passive UUIDs to actor flags
        const passiveUuids = passiveFeats.map(feat => feat.uuid);
        await actor.setFlag(MODULE_ID, 'selectedPassives', passiveUuids);
    }

    /**
     * Decorate a cell element with PF2e-specific dataset attributes
     * This allows filters to match cells by action cost, traits, spell level, etc.
     * @param {HTMLElement} cellElement - The cell element to decorate
     * @param {Object} cellData - The cell's data object
     */
    async decorateCellElement(cellElement, cellData) {
        if (!cellData) return;

        // Standard Item handling
        if (!cellData.uuid) return;

        // Get the item from UUID
        const item = await fromUuid(cellData.uuid);
        if (!item) return;

        // Add item type
        cellElement.dataset.itemType = item.type;

        // Add action cost 
        // - For actions/feats: system.actions.value (number: 1, 2, 3)
        // - For spells: system.time.value (string: "1", "2", "3", or descriptive like "reaction")
        let actionCost = item.system?.actions?.value ?? 0;

        // For spells, check system.time.value
        if (item.type === 'spell' && !actionCost) {
            const timeValue = item.system?.time?.value ?? '';
            // Parse numeric action costs (1, 2, 3)
            if (['1', '2', '3'].includes(timeValue)) {
                actionCost = parseInt(timeValue);
            }
        }

        if (actionCost > 0) {
            cellElement.dataset.actionCost = actionCost;
        }

        // Add traits (PF2e stores traits in system.traits.value as an array)
        const traits = item.system?.traits?.value ?? [];
        if (traits.length > 0) {
            cellElement.dataset.traits = traits.join(',');
        }

        // Add spell-specific attributes
        if (item.type === 'spell') {
            const actor = item.actor;
            const spellId = item.id;
            cellElement.dataset.spellId = spellId;
            let preparedRank = null;
            let totalPreps = 0;
            let expendedPreps = 0;

            // Check if it's a focus spell (use base rank)
            const isFocusSpell = item.system?.traits?.value?.includes('focus');
            if (isFocusSpell) {
                cellElement.dataset.isFocusSpell = 'true';
                cellElement.dataset.level = item.system?.level?.value ?? 0;

                // Focus Pool Check
                const focusPool = actor.system?.resources?.focus;
                if (focusPool && typeof focusPool.value === 'number') {
                    if (focusPool.value === 0) {
                        cellElement.dataset.expended = 'true';
                        cellElement.classList.add('expended');
                    }
                }
                return;
            }

            // For prepared spells, find which slot rank the spell is prepared in
            // and check if it has been expended
            if (actor) {
                const entryId = item.system?.location?.value;
                if (entryId) {
                    cellElement.dataset.spellEntryId = entryId;
                }

                const entry = entryId ? actor.items.get(entryId) : null;

                if (entry?.type === 'spellcastingEntry') {
                    const tradition = entry.system?.prepared?.value;

                    // For prepared casters, look up which slot the spell is in
                    if (tradition === 'prepared') {
                        const slots = entry.system?.slots ?? {};
                        const summary = summarizePreparedSpell({ slots, spellId });
                        preparedRank = summary.rank;
                        totalPreps = summary.totalPreps;
                        expendedPreps = summary.totalPreps - summary.remainingCasts;
                    }
                }
            }

            // Only mark depleted on image if all preparations are expended
            // Don't apply expended to cell - that would desaturate the uses counter too
            if (totalPreps > 0 && totalPreps === expendedPreps) {
                const img = cellElement.querySelector('.hotbar-item');
                if (img) img.classList.add('depleted');
            }



            // Cantrips (with 'cantrip' trait) should be level 0 for filtering
            const isCantrip = item.system?.traits?.value?.includes('cantrip');
            // Use preparation rank if found, cantrip = 0, otherwise fall back to base rank
            cellElement.dataset.level = isCantrip ? 0 : (preparedRank ?? item.system?.level?.value ?? 0);
        }
    }

    /**
     * Get display settings from the adapter
     * Called by core to determine what display options to apply
     * @returns {Object} Display settings object
     */
    getDisplaySettings() {
        return ui.BG3HOTBAR.api.getDisplaySettings(MODULE_ID);
    }

    /**
     * PF2e does not use dnd5e-style prepared/pact membership on item updates.
     * Prepared/expended state is tracked via spellcastingEntry slots + cell uses.
     * @param {Item} _item
     * @param {Actor} _actor
     * @returns {null}
     */
    resolveHotbarMembershipOnItemUpdate(_item, _actor) {
        return null;
    }

    /**
     * Can this weapon switch between 1H and 2H?
     * @param {Item} item
     * @returns {boolean}
     * @private
     */
    _canToggleGrip(item) {
        if (!item || item.type !== 'weapon') return false;
        const traits = item.system?.traits?.value || [];
        const hasTwoHandVariant = hasTwoHandTrait(item);
        const hasVersatile = traits.some((trait) => typeof trait === 'string' && trait.startsWith('versatile'));
        return hasTwoHandVariant || hasVersatile;
    }

    /**
     * Determine the next hands-held state for a weapon (flip 1 <-> 2).
     * Deliberately NOT the shared trait-aware WeaponHandednessRules.getHandsHeld:
     * this is a user-driven explicit toggle ("switch to the other grip"), so it
     * must always invert the current explicit state. getHandsHeld instead
     * computes the trait-based *default* grip, which can equal the current
     * state (e.g. a two-hand-trait weapon explicitly held 1H) and would fail
     * to flip anything in that case.
     * @param {Item} item
     * @returns {number}
     * @private
     */
    _getNextHands(item) {
        const current = Number(item.system?.equipped?.handsHeld) || 1;
        return current === 2 ? 1 : 2;
    }

    /**
     * Toggle weapon grip between one-hand and two-hand
     * @param {Item} item
     * @param {number} hands
     * @returns {Promise<void>}
     * @private
     */
    async _toggleGrip(item, hands) {
        if (!item?.actor) return;
        try {
            await item.update({
                'system.equipped.carryType': 'held',
                'system.equipped.handsHeld': hands,
                'system.equipped.inSlot': true
            });
        } catch (error) {
            log.error('Failed to toggle grip', { itemId: item.id, hands }, error);
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionFailed`));
            return;
        }

        // Slot fill / off-hand stash follows current grip (e.g. Longsword versatile → 2H)
        try {
            const weaponSets = ui.BG3HOTBAR.api.getWeaponSetComponent();
            if (weaponSets && typeof weaponSets.refreshTwoHandedDisplay === 'function') {
                await weaponSets.refreshTwoHandedDisplay();
            }
        } catch (error) {
            log.warn('Grip changed but weapon-set refresh failed', { itemId: item.id, hands }, error);
        }
    }

}

