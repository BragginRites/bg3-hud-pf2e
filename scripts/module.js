/**
 * BG3 HUD PF2e Adapter Module
 * Registers PF2e specific components with the BG3 HUD Core
 */

import { createPf2ePortraitContainer } from './components/containers/Pf2ePortraitContainer.js';
import { createPf2ePassivesContainer } from './components/containers/Pf2ePassivesContainer.js';
import { Pf2eActionButtonsContainer } from './components/containers/Pf2eActionButtonsContainer.js';
import { Pf2eFilterContainer } from './components/containers/Pf2eFilterContainer.js';
import { createPf2eWeaponSetContainer } from './components/containers/Pf2eWeaponSetContainer.js';
import { Pf2eInfoContainer } from './components/containers/Pf2eInfoContainer.js';
import { Pf2eAutoSort } from './features/Pf2eAutoSort.js';
import { Pf2eAutoPopulate } from './features/Pf2eAutoPopulate.js';
import { registerSettings } from './utils/settings.js';
import { renderPf2eTooltip } from './utils/tooltipRenderer.js';
import { Pf2eMenuBuilder } from './components/menus/Pf2eMenuBuilder.js';
import { Pf2eTargetingRules } from './utils/Pf2eTargetingRules.js';

const MODULE_ID = 'bg3-hud-pf2e';

console.log('BG3 HUD PF2e | Loading adapter');

/**
 * Register settings
 */
Hooks.once('init', () => {
    console.log('BG3 HUD PF2e | Registering settings');
    registerSettings();
});

/**
 * Wait for core to be ready, then register PF2e components
 */
Hooks.on('bg3HudReady', async (BG3HUD_API) => {
    console.log('BG3 HUD PF2e | Received bg3HudReady hook');

    // Verify we're in PF2e system
    if (game.system.id !== 'pf2e') {
        console.warn('BG3 HUD PF2e | Not running PF2e system, skipping registration');
        return;
    }

    console.log('BG3 HUD PF2e | Registering PF2e components');

    // Create the portrait container class (extends core's PortraitContainer)
    const Pf2ePortraitContainer = await createPf2ePortraitContainer();

    // Create the passives container class (extends core's PassivesContainer)
    const Pf2ePassivesContainer = await createPf2ePassivesContainer();

    // Create the weapon set container class (extends core's WeaponSetContainer)
    const Pf2eWeaponSetContainer = await createPf2eWeaponSetContainer();

    // Register PF2e portrait container (includes health display)
    BG3HUD_API.registerPortraitContainer(Pf2ePortraitContainer);

    // Register PF2e passives container (feat selection)
    BG3HUD_API.registerPassivesContainer(Pf2ePassivesContainer);

    // Register PF2e weapon set container
    BG3HUD_API.registerWeaponSetContainer(Pf2eWeaponSetContainer);

    // Register PF2e action buttons container (rest/turn buttons)
    BG3HUD_API.registerActionButtonsContainer(Pf2eActionButtonsContainer);

    // Register PF2e filter container (action costs, traits, spell levels)
    BG3HUD_API.registerFilterContainer(Pf2eFilterContainer);

    // Register PF2e info container (abilities, skills, saves)
    BG3HUD_API.registerInfoContainer(Pf2eInfoContainer);

    // Create and register the adapter instance
    const adapter = new Pf2eAdapter();
    BG3HUD_API.registerAdapter(adapter);

    // Register PF2e menu builder
    BG3HUD_API.registerMenuBuilder('pf2e', Pf2eMenuBuilder, { adapter: adapter });
    console.log('BG3 HUD PF2e | Menu builder registered');

    // Register PF2e tooltip renderer
    const tooltipManager = BG3HUD_API.getTooltipManager();
    if (!tooltipManager) {
        console.error('BG3 HUD PF2e | TooltipManager not available, cannot register tooltip renderer');
    } else {
        BG3HUD_API.registerTooltipRenderer('pf2e', renderPf2eTooltip);
        console.log('BG3 HUD PF2e | Tooltip renderer registered');
    }

    console.log('BG3 HUD PF2e | Registration complete');

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

        // Targeting rules for target selector integration
        this.targetingRules = Pf2eTargetingRules;

        // Link autoPopulate to autoSort for consistent sorting
        this.autoPopulate.setAutoSort(this.autoSort);

        console.log('BG3 HUD PF2e | Pf2eAdapter created with autoSort, autoPopulate, and targetingRules');
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

        console.log('PF2e Adapter | Cell clicked:', data);

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
                    console.warn('PF2e Adapter | Unknown cell data type:', data.type);
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
            const coverUuid = 'Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi';
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
                        await this._lowerShield(actor);
                    } else {
                        await this._raiseShield(actor);
                    }
                }
            });

            items.push({
                label: game.i18n.localize(
                    hasShieldCover ? `${MODULE_ID}.Context.RemoveCover` : `${MODULE_ID}.Context.TakeCover`,
                ),
                icon: 'fas fa-person-shelter',
                onClick: async () => {
                    await this._takeCover(actor, item);
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

        console.log('PF2e Adapter | Using item:', item.name);

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

                    // If user cancelled (empty array returned when cancelled), abort item use
                    if (!targets || targets.length === 0) {
                        console.log('PF2e Adapter | Target selection cancelled');
                        return;
                    }

                    console.log('PF2e Adapter | Targets selected:', targets.map(t => t.name).join(', '));
                } catch (error) {
                    console.error('PF2e Adapter | Target selection error:', error);
                    return;
                }
            }
        }

        try {
            // Special-case Take Cover action items to avoid dialogs; use shield-derived cover
            const slug = item.system?.slug || item.slug || item.name?.toLowerCase();
            if (item.type === 'action' && slug === 'take-cover') {
                const applied = await this._applyCoverEffect(item.actor);
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
                    // Handle modifier key overrides for quick rolling
                    // We must pass a sanitized event to prevent PF2e from interpreting modifiers as Roll Mode overrides (e.g. Ctrl=Blind)
                    if (event.shiftKey || event.ctrlKey || event.altKey) {
                        const options = {
                            event: {
                                shiftKey: false,
                                ctrlKey: false,
                                altKey: false,
                                metaKey: false,
                                type: 'click',
                                preventDefault: () => { },
                                stopPropagation: () => { }
                            }
                        };

                        if (event.shiftKey) return strike.variants[0]?.roll(options);
                        if (event.ctrlKey) return strike.variants[1]?.roll(options);
                        if (event.altKey) return strike.variants[2]?.roll(options);
                    }

                    await this._postStrikeChatCard(item.actor, strike);
                    return;
                }
            }

            // For shields, find the generated weapon strike (PF2e creates a weapon from shields via generateWeapon())
            // The generated weapon has a `shield` property pointing back to the original shield item
            if (item.actor && item.type === 'shield') {
                const strike = item.actor.system?.actions?.find?.((s) => s.item?.shield?.id === item.id);
                if (strike) {
                    // Handle modifier key overrides for quick rolling
                    if (event.shiftKey || event.ctrlKey || event.altKey) {
                        const options = {
                            event: {
                                shiftKey: false,
                                ctrlKey: false,
                                altKey: false,
                                metaKey: false,
                                type: 'click',
                                preventDefault: () => { },
                                stopPropagation: () => { }
                            }
                        };

                        if (event.shiftKey) return strike.variants[0]?.roll(options);
                        if (event.ctrlKey) return strike.variants[1]?.roll(options);
                        if (event.altKey) return strike.variants[2]?.roll(options);
                    }

                    await this._postStrikeChatCard(item.actor, strike);
                    return;
                }
            }

            // For spells, use the spellcasting entry's cast() method to properly consume slots
            if (item.type === 'spell' && item.actor) {
                const entryId = item.system?.location?.value;
                const entry = entryId ? item.actor.items.get(entryId) : null;

                if (entry && typeof entry.cast === 'function') {
                    // Get the spell's rank (level in PF2e terminology)
                    const rank = item.system?.level?.value ?? item.rank ?? 1;
                    await entry.cast(item, { rank, consume: true });
                    return;
                }

                // Fallback: If no entry or cast method, use toMessage (won't consume)
                console.warn('PF2e Adapter | Spell has no spellcasting entry with cast method, falling back to toMessage');
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
            console.error('[bg3-hud-pf2e] Failed to use item', { uuid: item.uuid, name: item.name }, error);
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

        console.log('PF2e Adapter | Using strike:', strike.label);

        // Handle modifier key overrides for quick rolling
        if (event.shiftKey || event.ctrlKey || event.altKey) {
            const options = {
                event: {
                    shiftKey: false,
                    ctrlKey: false,
                    altKey: false,
                    metaKey: false,
                    type: 'click',
                    preventDefault: () => { },
                    stopPropagation: () => { }
                }
            };

            if (event.shiftKey) return strike.variants[0]?.roll(options);
            if (event.ctrlKey) return strike.variants[1]?.roll(options);
            if (event.altKey) return strike.variants[2]?.roll(options);
        }

        // Post the strike chat card
        await this._postStrikeChatCard(actor, strike);
    }

    /**
     * Use a feat or action item properly (apply selfEffect, decrement frequency)
     * Uses PF2e's native rollItemMacro which handles all the proper logic
     * @param {Item} item - The feat or action item
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useAction(item, event) {
        console.log('PF2e Adapter | Using action via rollItemMacro:', item.name);

        // Use PF2e's native rollItemMacro which properly:
        // - Calls createUseActionMessage
        // - Decrements frequency
        // - Applies selfEffect
        if (typeof game.pf2e?.rollItemMacro === 'function') {
            await game.pf2e.rollItemMacro(item.uuid, event);
            return;
        }

        // Fallback if API not available
        console.warn('PF2e Adapter | game.pf2e.rollItemMacro not available, using toMessage');
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

        console.log('PF2e Adapter | Executing macro:', macro.name);
        await macro.execute();
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
        if (!cellData || !cellData.uuid) return;

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
            let preparedRank = null;

            // Check if it's a focus spell (use base rank)
            const isFocusSpell = item.system?.traits?.value?.includes('focus');
            if (isFocusSpell) {
                cellElement.dataset.isFocusSpell = 'true';
                cellElement.dataset.level = item.system?.level?.value ?? 0;
                return;
            }

            // For prepared spells, find which slot rank the spell is prepared in
            if (actor) {
                const entryId = item.system?.location?.value;
                const entry = entryId ? actor.items.get(entryId) : null;

                if (entry?.type === 'spellcastingEntry') {
                    const tradition = entry.system?.prepared?.value;

                    // For prepared casters, look up which slot the spell is in
                    if (tradition === 'prepared') {
                        const slots = entry.system?.slots ?? {};
                        for (let rank = 0; rank <= 10; rank++) {
                            const slotKey = `slot${rank}`;
                            const slotData = slots[slotKey];
                            const preparedList = slotData?.prepared;

                            if (!preparedList) continue;

                            const preparedArray = Array.isArray(preparedList)
                                ? preparedList
                                : Object.values(preparedList);

                            // Check if this spell is prepared in this slot
                            for (const prep of preparedArray) {
                                if (prep?.id === spellId) {
                                    preparedRank = rank;
                                    break;
                                }
                            }
                            if (preparedRank !== null) break;
                        }
                    }
                }
            }

            // Use preparation rank if found, otherwise fall back to base rank
            cellElement.dataset.level = preparedRank ?? item.system?.level?.value ?? 0;
        }
    }

    /**
     * Get display settings from the adapter
     * Called by core to determine what display options to apply
     * @returns {Object} Display settings object
     */
    getDisplaySettings() {
        return {
            showItemNames: game.settings.get(MODULE_ID, 'showItemNames'),
            showItemUses: game.settings.get(MODULE_ID, 'showItemUses')
        };
    }

    /**
     * Transform a PF2e item to cell data format
     * Extracts all relevant data including uses and quantity
     * @param {Item} item - The item to transform
     * @returns {Promise<Object>} Cell data object
     */
    async transformItemToCellData(item) {
        if (!item) {
            console.warn('Pf2e Adapter | transformItemToCellData: No item provided');
            return null;
        }

        const cellData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: 'Item'
        };

        // Extract quantity (PF2e stores this in system.quantity)
        if (item.system?.quantity) {
            cellData.quantity = item.system.quantity;
        }

        // Extract uses (PF2e stores this in system.uses)
        if (item.system?.uses) {
            const maxUses = parseInt(item.system.uses.max) || 0;
            if (maxUses > 0) {
                const value = parseInt(item.system.uses.value) || 0;

                cellData.uses = {
                    value: value,
                    max: maxUses
                };
            }
        }

        return cellData;
    }

    /**
     * Raise Shield via PF2e action macro
     * @param {Actor} actor
     * @returns {Promise<void>}
     * @private
     */
    async _raiseShield(actor) {
        const raiseAction = game.pf2e?.actions?.raiseAShield;
        if (!raiseAction) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionUnavailable`));
            return;
        }
        await raiseAction({ actors: [actor] });
    }

    /**
     * Lower Shield by removing the Raise a Shield effect
     * @param {Actor} actor
     * @returns {Promise<void>}
     * @private
     */
    async _lowerShield(actor) {
        const raiseEffect = actor.itemTypes?.effect?.find(
            (e) =>
                e.slug === 'raise-a-shield' ||
                e.slug === 'effect-raise-a-shield' ||
                e.sourceId === 'Compendium.pf2e.equipment-effects.Item.2YgXoHvJfrDHucMr',
        );
        if (!raiseEffect) return;
        try {
            await raiseEffect.delete();
        } catch (error) {
            console.error(`[${MODULE_ID}] Failed to lower shield`, { actorId: actor.id }, error);
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionFailed`));
        }
    }

    /**
     * Take Cover via PF2e action macro
     * @param {Actor} actor
     * @returns {Promise<void>}
     * @private
     */
    async _takeCover(actor, shieldOverride = null) {
        const applied = await this._applyCoverEffect(actor, shieldOverride);
        if (!applied) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionUnavailable`));
        }
    }

    /**
     * Apply cover effect based on held shield (tower = greater, otherwise standard)
     * @param {Actor} actor
     * @param {Item} shieldOverride
     * @returns {Promise<boolean>} true if applied
     * @private
     */
    async _applyCoverEffect(actor, shieldOverride = null) {
        if (!actor) return false;

        const shield = shieldOverride ?? actor.heldShield ?? null;
        const baseItem = shield?.system?.baseItem ?? '';
        const hasTowerTrait = !!shield?.system?.traits?.value?.some?.((t) => t === 'tower' || t === 'tower-shield');
        const isTowerShield = hasTowerTrait || ['tower-shield', 'fortress-shield'].includes(baseItem);
        const coverSelection = isTowerShield ? { bonus: 4, level: 'greater' } : { bonus: 2, level: 'standard' };

        const coverUuid = 'Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi';
        const existing = actor.itemTypes?.effect?.find(
            (e) => e.sourceId === coverUuid && e.getFlag?.(MODULE_ID, 'shieldCover'),
        );
        if (existing) {
            await existing.delete();
            return true;
        }

        try {
            const effect = await fromUuid(coverUuid);
            if (!effect) return false;

            const data = { ...effect.toObject(), _id: null };

            // Pre-select the cover level to avoid prompting the user
            const rule = Array.isArray(data.system?.rules)
                ? data.system.rules.find((r) => r?.key === 'ChoiceSet')
                : null;
            if (rule) {
                rule.selection = coverSelection;
            }

            // Tag tower shields for parity with system behavior
            if (isTowerShield && data.system?.traits) {
                const otherTags = Array.isArray(data.system.traits.otherTags) ? data.system.traits.otherTags : [];
                data.system.traits.otherTags = Array.from(new Set([...otherTags, 'tower-shield']));
            }

            data.flags = data.flags ?? {};
            data.flags[MODULE_ID] = {
                ...(data.flags[MODULE_ID] ?? {}),
                shieldCover: true,
            };

            await actor.createEmbeddedDocuments('Item', [data]);
            return true;
        } catch (error) {
            console.warn(`[${MODULE_ID}] Failed to apply cover effect`, error);
            return false;
        }
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
        const hasTwoHandVariant = traits.some((trait) => typeof trait === 'string' && trait.startsWith('two-hand'));
        const hasVersatile = traits.some((trait) => typeof trait === 'string' && trait.startsWith('versatile'));
        return hasTwoHandVariant || hasVersatile;
    }

    /**
     * Determine the next hands-held state for a weapon (flip 1 <-> 2)
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
            console.error(`[${MODULE_ID}] Failed to toggle grip`, { itemId: item.id, hands }, error);
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActionFailed`));
        }
    }

    /**
     * Post a strike chat card directly to chat
     * This bypasses the AttackPopout dialog and shows inline MAP buttons
     * @param {Actor} actor - The actor making the strike
     * @param {Object} strike - The strike action from actor.system.actions
     * @returns {Promise<void>}
     * @private
     */
    async _postStrikeChatCard(actor, strike) {
        const meleeOrRanged = strike.item.isMelee ? 'melee' : 'ranged';
        const identifier = `${strike.item.id}.${strike.slug}.${meleeOrRanged}`;

        // Only pass essential data - no description to keep the card clean
        const templateData = { actor, strike, identifier };

        // Use PF2e's strike-card template
        const content = await foundry.applications.handlebars.renderTemplate(
            'systems/pf2e/templates/chat/strike-card.hbs',
            templateData
        );

        const token = actor.token ?? actor.getActiveTokens(true, true).shift() ?? null;
        const chatData = {
            speaker: ChatMessage.getSpeaker({ actor, token }),
            content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        };

        // Respect roll mode settings
        const rollMode = game.settings.get('core', 'rollMode');
        if (['gmroll', 'blindroll'].includes(rollMode)) {
            chatData.whisper = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
        }
        if (rollMode === 'blindroll') {
            chatData.blind = true;
        }

        await ChatMessage.create(chatData);
    }
}

