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
        
        // Link autoPopulate to autoSort for consistent sorting
        this.autoPopulate.setAutoSort(this.autoSort);
        
        console.log('BG3 HUD PF2e | Pf2eAdapter created with autoSort and autoPopulate');
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
            case 'Macro':
                await this._executeMacro(data.uuid);
                break;
            default:
                console.warn('PF2e Adapter | Unknown cell data type:', data.type);
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
            ui.notifications.warn('Item not found');
            return;
        }

        console.log('PF2e Adapter | Using item:', item.name);

        // PF2e items use .roll() or .toMessage() methods
        if (typeof item.roll === 'function') {
            await item.roll({ event });
        } else if (typeof item.toMessage === 'function') {
            await item.toMessage();
        } else {
            ui.notifications.warn('Item cannot be used');
        }
    }

    /**
     * Execute a macro
     * @param {string} uuid - Macro UUID
     * @private
     */
    async _executeMacro(uuid) {
        const macro = await fromUuid(uuid);
        if (!macro) {
            ui.notifications.warn('Macro not found');
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

        // Add action cost (PF2e uses system.actions.value: 1, 2, or 3)
        const actionCost = item.system?.actions?.value ?? 0;
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
            cellElement.dataset.level = item.system?.level?.value ?? 0;
            // Check if it's a focus spell
            if (item.system?.traits?.value?.includes('focus')) {
                cellElement.dataset.isFocusSpell = 'true';
            }
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
}

